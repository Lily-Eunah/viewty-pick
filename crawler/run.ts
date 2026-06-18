import { runSheetImport } from './sheets/import';
import { CoupangAdapter, NaverAdapter, OliveYoungAdapter, RetailerAdapter, PriceOffer, FetchOutcome } from './adapters/index';
import { clearNaverSearchCache } from './adapters/naver';
import { readInspectionRows, upsertInspection, approvalOverrides, InspectionItem } from './sheets/inspection';
import { applyManualOverrides, normalizePrice } from './core/normalize';
import { runHealthCheck, resolveListingOutcome } from './core/healthcheck';
import { recalculateViewtyScores } from './core/score';
import { sendDailySummary, sendCriticalAlarm } from './core/notify';
import { isSupabaseServerConfigured, supabaseServer } from '../lib/supabase/server';
import { loadMockDB, saveMockDB } from '../lib/supabase/mockDb';
import { Listing, Product, PriceSnapshot, CurrentPrice, ManualOverride, RetailerAllowlist, Badge, ProductBadge, ScoreConfig } from '../lib/types';

export interface CrawlTarget {
  mockMode: boolean;     // --test / CRAWLER_MODE=mock → adapters AND persistence are mocked
  useSupabase: boolean;  // persist to Supabase (false in mock mode → local mock DB)
  projectRef: string;    // Supabase project ref for the startup banner
  refused: boolean;      // true → a non-CI, non-allowed run would write to prod → abort
}

/**
 * Resolve where this crawl run reads/writes, with the production-write guard.
 * Pure (env in, decision out) so it is unit-testable. Mock mode NEVER touches
 * Supabase; a real Supabase write needs CI=true or CRAWLER_ALLOW_PROD_WRITE=true.
 */
export function resolveCrawlTarget(env: Record<string, string | undefined>, supabaseConfigured: boolean): CrawlTarget {
  const mockMode = env.VIEWTYPICK_MOCK_MODE === 'true' || env.CRAWLER_MODE === 'mock';
  const useSupabase = supabaseConfigured && !mockMode;
  const projectRef = (env.NEXT_PUBLIC_SUPABASE_URL || '').match(/https?:\/\/([^.]+)\./)?.[1] ?? 'none';
  const inCi = !!env.CI && env.CI !== 'false' && env.CI !== '0';
  const refused = useSupabase && !inCi && env.CRAWLER_ALLOW_PROD_WRITE !== 'true';
  return { mockMode, useSupabase, projectRef, refused };
}

export async function crawlPipeline(): Promise<void> {
  // Set test/mock environment override if --test flag is passed
  if (typeof process !== 'undefined' && process.argv && process.argv.includes('--test')) {
    process.env.VIEWTYPICK_MOCK_MODE = 'true';
    process.env.CRAWLER_MODE = 'mock';
    console.log('[Pipeline] Enforcing TEST/MOCK mode via CLI argument.');
  }

  // CLI options for limited / controlled runs (ops rollout Phase E):
  //   --only=key1,key2   restrict to these product_keys (scopes ALL writes:
  //                      snapshots, scores, current_prices, listing updates —
  //                      other active products are left untouched)
  //   --skip-import      skip the Step-1 sheet import
  //   --max-coupang=N    crawl at most N coupang listings (hourly-limit / timeout)
  //   --no-notify        suppress Discord summary + critical alerts
  const argv = (typeof process !== 'undefined' && process.argv) ? process.argv : [];
  const getArg = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const onlyKeys = getArg('only')?.split(',').map((s) => s.trim()).filter(Boolean) ?? null;
  const maxCoupangRaw = getArg('max-coupang');
  const maxCoupang = maxCoupangRaw ? parseInt(maxCoupangRaw, 10) : Infinity;
  const notifyEnabled = !argv.includes('--no-notify');
  const isPlaceholder = (v?: string) => !v || /placeholder|example|dummy|your-/.test(v);
  const coupangConfigured = !isPlaceholder(process.env.COUPANG_ACCESS_KEY) && !isPlaceholder(process.env.COUPANG_SECRET_KEY);
  let coupangCount = 0;

  // ── Persistence target & production-write guard ─────────────────────────────
  // --test mocks the ADAPTERS; it MUST also mock the WRITE path, otherwise a local
  // run with a real .env overwrites production. In mock mode both the sheet import
  // and the snapshot/current_price persistence go to the LOCAL mock DB — never
  // Supabase. A real Supabase write from an interactive local run additionally
  // requires CRAWLER_ALLOW_PROD_WRITE=true; CI/cron set CI=true to bypass.
  const { mockMode, useSupabase, projectRef, refused } = resolveCrawlTarget(process.env, !!isSupabaseServerConfigured());
  const skipImport = argv.includes('--skip-import') || mockMode; // mock never imports to prod

  const startTime = Date.now();
  console.log('[Pipeline] Starting daily price sync pipeline...');
  console.log(`[Pipeline] mode=${mockMode ? 'TEST/MOCK' : 'LIVE'} · persistence=${useSupabase ? `Supabase[${projectRef}]` : 'local mock DB'}`);

  // Refuse an accidental production write from a non-CI, non-allowed local run.
  if (refused) {
    console.error(`[Pipeline] REFUSED — this run would WRITE to PRODUCTION Supabase [${projectRef}].`);
    console.error('  Set CRAWLER_ALLOW_PROD_WRITE=true to confirm an intentional production write.');
    console.error('  (CI sets CI=true to bypass; --test / mock mode writes to the local mock DB instead.)');
    return;
  }

  if (onlyKeys) console.log(`[Pipeline] LIMITED MODE — only products: ${onlyKeys.join(', ')}`);
  if (skipImport) console.log('[Pipeline] --skip-import set: skipping sheet import');
  if (maxCoupangRaw) console.log(`[Pipeline] --max-coupang=${maxCoupang}`);
  if (!coupangConfigured) console.log('[Pipeline] Coupang API key not configured — coupang listings will be skipped');
  if (!notifyEnabled) console.log('[Pipeline] --no-notify set: Discord summary/alerts suppressed');

  // Fresh Naver Shopping search cache per run (brand store + OliveYoung listings
  // of the same product share one search → one API call per product).
  clearNaverSearchCache();

  // Step 1: Run Sheet Import (skippable for limited/controlled runs)
  if (!skipImport) {
    try {
      const importStats = await runSheetImport();
      if (importStats.errorCount > 0) {
        console.warn(`[Pipeline] Sheet import finished with ${importStats.errorCount} validation warnings.`);
      }
    } catch (e: unknown) {
      const err = e as Error;
      console.error('[Pipeline] Sheet Import failed. Proceeding with existing database state...', err);
      if (notifyEnabled) await sendCriticalAlarm('Sheet Import Failure', `Import run crashed: ${err.message}`);
    }
  }

  // Data containers for processing
  let products: Product[] = [];
  let listings: Listing[] = [];
  let manualOverrides: ManualOverride[] = [];
  let allowlist: RetailerAllowlist[] = [];
  let badges: Badge[] = [];
  let productBadges: ProductBadge[] = [];
  let scoreConfigs: ScoreConfig[] = [];
  let sellers: { id: number; slug: string; name: string }[] = [];
  let previousSnapshots: PriceSnapshot[] = [];

  // Step 2: Load Active Metadata from DB
  if (useSupabase) {
    try {
      console.log('[Pipeline] Fetching active products and metadata from Supabase...');
      const pRes = await supabaseServer.from('products').select('*').eq('is_active', true);
      const lRes = await supabaseServer.from('listings').select('*').eq('is_active', true);
      const oRes = await supabaseServer.from('manual_overrides').select('*').eq('is_active', true);
      const alRes = await supabaseServer.from('retailer_allowlist').select('*').eq('is_active', true);
      const bRes = await supabaseServer.from('badges').select('*');
      const pbRes = await supabaseServer.from('product_badges').select('*');
      const sRes = await supabaseServer.from('sellers').select('id, slug, name');
      const cfgRes = await supabaseServer.from('score_config').select('*');

      if (pRes.error || lRes.error || oRes.error || alRes.error || bRes.error || pbRes.error || sRes.error || cfgRes.error) {
        throw new Error('Supabase metadata fetch failed');
      }

      products = pRes.data || [];
      listings = lRes.data || [];
      manualOverrides = oRes.data || [];
      allowlist = alRes.data || [];
      badges = bRes.data || [];
      productBadges = pbRes.data || [];
      sellers = sRes.data || [];
      scoreConfigs = cfgRes.data || [];

      // Fetch last normal snapshots for historic comparisons
      const snapRes = await supabaseServer
        .from('price_snapshots')
        .select('*')
        .order('crawled_at', { ascending: false });
      previousSnapshots = snapRes.data || [];

    } catch (e: unknown) {
      console.error('[Pipeline] Supabase connection failed:', e);
      return;
    }
  } else {
    console.log('[Pipeline] Loading active products and metadata from Local Mock DB...');
    const db = loadMockDB();
    products = db.products.filter((p) => p.is_active);
    listings = db.listings.filter((l) => l.is_active);
    manualOverrides = db.manual_overrides.filter((o) => o.is_active);
    allowlist = db.retailer_allowlist.filter((al) => al.is_active);
    badges = db.badges;
    productBadges = db.product_badges;
    scoreConfigs = db.score_config;
    sellers = db.sellers;
    previousSnapshots = db.price_snapshots;
  }

  // Limited mode: restrict to the selected products so that aggregation, scores,
  // current_prices and listing updates downstream all operate on this subset
  // only — the other active products are not read or written this run.
  if (onlyKeys) {
    const keep = new Set(onlyKeys);
    products = products.filter((p) => keep.has(p.product_key));
    const keepIds = new Set(products.map((p) => p.id));
    listings = listings.filter((l) => keepIds.has(l.product_id));
    const missing = onlyKeys.filter((k) => !products.some((p) => p.product_key === k));
    if (missing.length) console.warn(`[Pipeline] --only keys not found among active products: ${missing.join(', ')}`);
    console.log(`[Pipeline] Limited to ${products.length} products / ${listings.length} listings.`);
  }

  // Step 2.6: Inspection OX approvals → synthesized price overrides.
  // The operator approves a held (warning) price with O in the `inspection` tab;
  // here we read those approvals and apply each as a price manual_override so the
  // (possibly operator-edited) estimated price promotes to a displayable 'ok'.
  // Candidates written back to the tab are collected during the crawl loop below.
  const inspectionCandidates: InspectionItem[] = [];
  if (!mockMode) {
    try {
      const rows = await readInspectionRows();
      const oOverrides = approvalOverrides(rows, products, sellers);
      if (oOverrides.length > 0) {
        manualOverrides.push(...oOverrides);
        console.log(`[Pipeline] Applied ${oOverrides.length} inspection O-approval(s) as price overrides.`);
      }
    } catch (e) {
      console.warn('[Pipeline] Inspection approvals read failed (continuing):', (e as Error).message);
    }
  }

  // Step 3: Initialize Adapters
  const adapters: Record<string, RetailerAdapter> = {
    oliveyoung: new OliveYoungAdapter(),
    coupang: new CoupangAdapter(),
    naver: new NaverAdapter(),
  };

  const newSnapshots: PriceSnapshot[] = [];
  const updatedListings: Listing[] = [...listings];
  let successCount = 0;
  let warningCount = 0;
  let failureCount = 0;
  // OK_NO_OFFER bookkeeping — informational only (NOT failures). disappeared =
  // listings that had a real price last run and now legitimately have no offer.
  let noOfferCount = 0;
  const disappearedOffers: string[] = [];
  // DATA_ERROR bookkeeping — operator-facing data problems (e.g. a Coupang
  // share short-link with no productId). Not failures: fail_count stays 0 and
  // the listing stays active (link-only); surfaced in the daily summary so the
  // operator fixes the sheet URL.
  const dataErrors: string[] = [];

  // Step 4: Crawl Prices Listing by Listing
  console.log(`[Pipeline] Beginning crawl of ${listings.length} active listings...`);
  
  for (const listing of listings) {
    const product = products.find((p) => p.id === listing.product_id);
    const seller = sellers.find((s) => s.id === listing.seller_id);

    if (!product || !seller) {
      console.warn(`[Pipeline] Product ID ${listing.product_id} or Seller ID ${listing.seller_id} not found for listing. Skipping.`);
      failureCount++;
      continue;
    }

    const adapter = adapters[seller.slug];
    if (!adapter) {
      console.warn(`[Pipeline] No adapter found for seller slug: ${seller.slug}. Skipping.`);
      failureCount++;
      continue;
    }

    // Coupang gate: skip if no API key, and cap calls per run (hourly limit /
    // command timeout). Skipped, not failed — no fail_count increment.
    if (seller.slug === 'coupang') {
      if (!coupangConfigured) {
        console.log(`[Pipeline] Skip coupang ${listing.link_key} — no API key.`);
        continue;
      }
      if (coupangCount >= maxCoupang) {
        console.log(`[Pipeline] Skip coupang ${listing.link_key} — max-coupang=${maxCoupang} reached.`);
        continue;
      }
      coupangCount++;
    }

    let offer: PriceOffer;
    try {
      // 4.1 Crawl using adapter
      offer = await adapter.fetchOffer(listing);

      // 4.2 Apply active overrides (a manual price flips no_offer → ok)
      offer = applyManualOverrides(product, listing, offer, manualOverrides);

      // 4.2b Classify the fetch outcome. A successful fetch with no qualified
      // offer ('no_offer') is NOT a failure — it resets fail_count and leaves the
      // listing active (link-only). Only thrown errors (catch below) and bad
      // priced data (healthcheck 'failed') advance the §4.4 failure staircase.
      const outcome: FetchOutcome = offer.outcome ?? (offer.matchExcluded ? 'no_offer' : 'ok');

      if (outcome === 'no_offer' || outcome === 'data_error') {
        // Both are successful (or skipped) fetches with no qualified offer: reset
        // the failure streak and keep the listing active (link-only). data_error
        // additionally records an operator-facing data problem.
        const res = resolveListingOutcome(listing, outcome);
        const listIdx = updatedListings.findIndex((l) => l.id === listing.id);
        if (listIdx >= 0) {
          updatedListings[listIdx].fail_count = res.fail_count;
          updatedListings[listIdx].is_active = res.is_active;
        }
        if (outcome === 'data_error') {
          dataErrors.push(`${product.name} @ ${seller.name} (${listing.link_key}): ${offer.sourceText ?? 'data error'}`);
        } else {
          noOfferCount++;
        }

        // Trust-first: if this listing had a real price last run, drop it (no
        // stale carry-over) and surface the transition as a daily-summary INFO
        // line (not an alert). Record a no_offer snapshot on first observation or
        // on transition only (steady-state link-only listings don't re-log daily).
        const prevSnap = previousSnapshots.find((s) => s.listing_id === listing.id) || null;
        const prevWasPriced = !!prevSnap && prevSnap.status !== 'no_offer' && prevSnap.sale_price !== null;
        if (prevWasPriced) {
          disappearedOffers.push(`${product.name} @ ${seller.name} (${listing.link_key})`);
        }
        if (!prevSnap || prevSnap.status !== 'no_offer') {
          const noOfferId = useSupabase ? 0 : previousSnapshots.length + newSnapshots.length + 1;
          newSnapshots.push({
            id: noOfferId,
            listing_id: listing.id,
            product_id: product.id,
            crawled_at: new Date().toISOString(),
            regular_price: null,
            sale_price: null,
            base_unit_price: null,
            effective_unit_price: null,
            unit_price: null,
            unit_price_reliable: true,
            promo_type: 'none',
            promo_text: null,
            min_quantity: null,
            paid_quantity: null,
            free_quantity: null,
            total_quantity: null,
            total_ml: null,
            in_stock: false,
            source_text: offer.sourceText,
            parse_confidence: 'high',
            status: 'no_offer',
            shipping_fee: null,
            shipping_note: null,
            matched_url: null,
            matched_mall_name: null,
            image_url: null,
          });
        }
        continue;
      }

      // 4.3 Normalize raw prices
      const norm = normalizePrice(product, offer);

      // 4.4 Historic snapshots comparison
      const prevSnap = previousSnapshots.find((s) => s.listing_id === listing.id) || null;

      // 4.5 Healthcheck gates
      const check = runHealthCheck(product, listing, offer, norm, prevSnap, allowlist);

      const snapshotId = useSupabase ? 0 : previousSnapshots.length + newSnapshots.length + 1;
      const snapshot: PriceSnapshot = {
        id: snapshotId,
        listing_id: listing.id,
        product_id: product.id,
        crawled_at: new Date().toISOString(),
        regular_price: norm.regular_price,
        sale_price: norm.sale_price,
        base_unit_price: norm.base_unit_price,
        effective_unit_price: norm.effective_unit_price,
        unit_price: norm.unit_price,
        unit_price_reliable: norm.unit_price_reliable,
        promo_type: norm.promo_type,
        promo_text: norm.promo_text,
        min_quantity: norm.min_quantity,
        paid_quantity: norm.paid_quantity,
        free_quantity: norm.free_quantity,
        total_quantity: norm.total_quantity,
        total_ml: norm.total_ml,
        in_stock: norm.in_stock,
        source_text: offer.sourceText,
        parse_confidence: norm.parse_confidence,
        status: check.status,
        shipping_fee: null,
        shipping_note: norm.shipping_note,
        matched_url: offer.matchedUrl ?? null,
        matched_mall_name: offer.matchedMallName ?? null,
        image_url: offer.imageUrl ?? null,
      };

      // Cache the latest matched offer link + image on the listing (redirect /
      // display fallback). For OliveYoung the buy button is ALWAYS the curator
      // affiliate_url: the redirect route prefers affiliate_url over
      // latest_matched_url, so caching the Naver-sourced link here is audit-only
      // and never shadows the curator.
      const matchIdx = updatedListings.findIndex((l) => l.id === listing.id);
      if (matchIdx >= 0) {
        if (offer.matchedUrl) updatedListings[matchIdx].latest_matched_url = offer.matchedUrl;
        if (offer.imageUrl) updatedListings[matchIdx].latest_image_url = offer.imageUrl;
      }

      if (check.status === 'failed') {
        // FETCH_FAILED via bad priced data (parse/math error on a data-bearing
        // response) — advances the §4.4 failure staircase.
        console.error(`[Pipeline] Listing ${listing.link_key} failed health check: ${check.message}`);
        failureCount++;

        // Handle failure count increment
        const failMgmt = resolveListingOutcome(listing, 'failed');
        const listIdx = updatedListings.findIndex((l) => l.id === listing.id);
        if (listIdx >= 0) {
          updatedListings[listIdx].fail_count = failMgmt.fail_count;
          updatedListings[listIdx].is_active = failMgmt.is_active;
        }

        if (failMgmt.should_notify && notifyEnabled) {
          await sendCriticalAlarm(
            `Listing Failed Gating: ${listing.link_key}`,
            `Error: ${check.message}\nFail count: ${failMgmt.fail_count}\nIs Active: ${failMgmt.is_active}`
          );
        }

        // If keeping previous price
        if (failMgmt.use_previous_price && prevSnap) {
          snapshot.regular_price = prevSnap.regular_price;
          snapshot.sale_price = prevSnap.sale_price;
          snapshot.base_unit_price = prevSnap.base_unit_price;
          snapshot.effective_unit_price = prevSnap.effective_unit_price;
          snapshot.unit_price = prevSnap.unit_price;
          snapshot.unit_price_reliable = prevSnap.unit_price_reliable;
          snapshot.matched_url = prevSnap.matched_url;
          snapshot.matched_mall_name = prevSnap.matched_mall_name;
          snapshot.promo_type = prevSnap.promo_type;
          snapshot.promo_text = prevSnap.promo_text;
          snapshot.status = 'warning';
          newSnapshots.push(snapshot);
          successCount++;
        }
      } else {
        // Validation succeeded
        successCount++;
        if (check.status === 'warning') warningCount++;

        // A held (warning) price with a value → inspection candidate: the crawler
        // pre-fills it into the OX tab so the operator can approve (O) / reject (X).
        if (check.status === 'warning' && snapshot.sale_price != null) {
          inspectionCandidates.push({
            product_key: product.product_key,
            product_name: product.name,
            seller: seller.slug,
            estimated_price: snapshot.sale_price,
            source: offer.matchedMallName ?? offer.storeName ?? '',
            reason: (check.message ?? offer.inspectionWarning ?? '').slice(0, 300),
            link: offer.matchedUrl ?? listing.affiliate_url ?? listing.url ?? '',
          });
        }

        // Reset fail count
        const listIdx = updatedListings.findIndex((l) => l.id === listing.id);
        if (listIdx >= 0) {
          updatedListings[listIdx].fail_count = 0;
        }

        newSnapshots.push(snapshot);
      }

    } catch (err: unknown) {
      // FETCH_FAILED via thrown error (HTTP error / timeout / block / can't parse
      // a response that should carry data) — advances the §4.4 staircase.
      console.error(`[Pipeline] Failed to gather details for listing ${listing.link_key}:`, err);
      failureCount++;

      // Execute fail handler
      const failMgmt = resolveListingOutcome(listing, 'failed');
      const listIdx = updatedListings.findIndex((l) => l.id === listing.id);
      if (listIdx >= 0) {
        updatedListings[listIdx].fail_count = failMgmt.fail_count;
        updatedListings[listIdx].is_active = failMgmt.is_active;
      }
      if (failMgmt.should_notify && notifyEnabled) {
        await sendCriticalAlarm(
          `Listing Fetch Failed: ${listing.link_key}`,
          `Error: ${err instanceof Error ? err.message : String(err)}\nFail count: ${failMgmt.fail_count}\nIs Active: ${failMgmt.is_active}`
        );
      }
    }
  }

  // Step 5: Price Aggregation (Determine Lowest Prices per Product)
  const currentPrices: CurrentPrice[] = [];
  for (const prod of products) {
    const prodListings = updatedListings.filter((l) => l.product_id === prod.id && l.is_active);
    const prodSnaps = newSnapshots.filter(
      (s) =>
        prodListings.some((l) => l.id === s.listing_id) &&
        // §1 compromise: a price-sound row stays comparable even with a volume
        // mismatch (status='warning', unit_price_reliable=false). Its base/effective
        // prices feed the lowest-price comparison; only ml-based unit_price (null
        // here) is excluded. Genuinely bad rows (failed / low confidence / OOS) drop.
        (s.status === 'ok' || (s.status === 'warning' && s.unit_price_reliable === false)) &&
        s.in_stock !== false &&
        s.parse_confidence !== 'low'
    );

    if (prodSnaps.length === 0) {
      // §2.4 trust-first: no listing has a displayable (ok-latest) price this run
      // — e.g. the offer(s) disappeared (no_offer) or the listings deactivated.
      // Clear the summary instead of leaving a stale lowest price in place.
      currentPrices.push({
        product_id: prod.id,
        base_lowest_price: null,
        base_lowest_seller: null,
        base_lowest_listing_id: null,
        promo_lowest_unit_price: null,
        promo_lowest_seller: null,
        promo_label: null,
        has_promotion: false,
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      continue;
    }

    // Determine base lowest price
    let baseLowestPrice: number | null = null;
    let baseLowestSeller: string | null = null;
    let baseLowestListingId: number | null = null;

    // Filter snapshots containing normal base prices
    const basePrices = prodSnaps.filter((s) => s.base_unit_price !== null);
    if (basePrices.length > 0) {
      basePrices.sort((a, b) => a.base_unit_price! - b.base_unit_price!);
      const cheapest = basePrices[0];
      baseLowestPrice = cheapest.base_unit_price;
      baseLowestListingId = cheapest.listing_id;
      
      const cheapestListing = listings.find((l) => l.id === cheapest.listing_id);
      const cheapestSeller = cheapestListing ? sellers.find((s) => s.id === cheapestListing.seller_id) : null;
      baseLowestSeller = cheapestSeller ? cheapestSeller.name : '誘몄젙';
    }

    // Determine promotion-effective lowest unit price
    let promoLowestPrice: number | null = null;
    let promoLowestSeller: string | null = null;
    let promoLabel: string | null = null;
    let hasPromo = false;

    const promoPrices = prodSnaps.filter((s) => s.effective_unit_price !== null);
    if (promoPrices.length > 0) {
      promoPrices.sort((a, b) => a.effective_unit_price! - b.effective_unit_price!);
      const cheapestPromo = promoPrices[0];
      promoLowestPrice = cheapestPromo.effective_unit_price;
      promoLabel = cheapestPromo.promo_text;
      hasPromo = cheapestPromo.promo_type !== 'none' && cheapestPromo.promo_type !== 'unknown';

      const cheapestListing = listings.find((l) => l.id === cheapestPromo.listing_id);
      const cheapestSeller = cheapestListing ? sellers.find((s) => s.id === cheapestListing.seller_id) : null;
      promoLowestSeller = cheapestSeller ? cheapestSeller.name : '誘몄젙';
    }

    currentPrices.push({
      product_id: prod.id,
      base_lowest_price: baseLowestPrice,
      base_lowest_seller: baseLowestSeller,
      base_lowest_listing_id: baseLowestListingId,
      promo_lowest_unit_price: promoLowestPrice,
      promo_lowest_seller: promoLowestSeller,
      promo_label: promoLabel,
      has_promotion: hasPromo,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  // Step 6: Recalculate Viewty Scores (DESIGN.md 짠8)
  console.log('[Pipeline] Calculating Viewty Scores...');
  const calculatedScores = recalculateViewtyScores(
    products,
    updatedListings,
    newSnapshots,
    scoreConfigs,
    productBadges,
    badges
  );

  const updatedProducts = products.map((prod) => {
    const score = calculatedScores[prod.id];
    return {
      ...prod,
      viewty_score: score !== undefined ? score : prod.viewty_score,
    };
  });

  // Step 7: Save Results
  if (useSupabase) {
    try {
      console.log('[Pipeline] Persisting snapshots and current prices to Supabase...');
      
      // Update listing fail counts + cached matched-offer link (redirect fallback).
      // latest_matched_url is the Coupang search deeplink / Naver matched link; it
      // must be persisted or the /go redirect can never fall back to it.
      const crawledAt = new Date().toISOString();
      for (const list of updatedListings) {
        await supabaseServer.from('listings').update({
          fail_count: list.fail_count,
          is_active: list.is_active,
          latest_matched_url: list.latest_matched_url ?? null,
          latest_image_url: list.latest_image_url ?? null,
          // Freshness: record when this listing was last processed (was never
          // written before → last_crawled_at stayed NULL for all rows).
          last_crawled_at: crawledAt,
        }).eq('id', list.id);
      }

      // Upsert Products score
      for (const prod of updatedProducts) {
        await supabaseServer.from('products').update({
          viewty_score: prod.viewty_score,
        }).eq('id', prod.id);
      }

      // Bulk insert snapshots
      if (newSnapshots.length > 0) {
        // Strip out temporary client IDs if necessary, though generate_always identity handles id
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const snapsToInsert = newSnapshots.map(({ id: _, ...rest }) => rest);
        const { error } = await supabaseServer.from('price_snapshots').insert(snapsToInsert);
        if (error) throw error;
      }

      // Bulk upsert current_prices
      for (const price of currentPrices) {
        const { error } = await supabaseServer.from('current_prices').upsert(price, { onConflict: 'product_id' });
        if (error) throw error;
      }

      // Log crawl run summary
      await supabaseServer.from('crawl_runs').insert({
        // started_at is TIMESTAMPTZ — must be an ISO string, not the epoch number
        // (the raw number silently failed to record, leaving crawl_runs empty).
        started_at: new Date(startTime).toISOString(),
        finished_at: new Date().toISOString(),
        status: 'completed',
        total_links: listings.length,
        success_count: successCount,
        warning_count: warningCount,
        failure_count: failureCount,
        summary: { durationMs: Date.now() - startTime },
      });

    } catch (e: unknown) {
      const err = e as Error;
      console.error('[Pipeline] Supabase persistence crashed:', err);
      if (notifyEnabled) await sendCriticalAlarm('Supabase Pipeline Error', `Failed to write crawl results: ${err.message}`);
      return;
    }
  } else {
    // Save to local Mock DB
    console.log('[Pipeline] Persisting snapshots and current prices to Local JSON file...');
    const db = loadMockDB();
    
    // Merge updates
    db.listings = db.listings.map((orig) => {
      const updated = updatedListings.find((l) => l.id === orig.id);
      return updated
        ? { ...orig, fail_count: updated.fail_count, is_active: updated.is_active, latest_matched_url: updated.latest_matched_url ?? orig.latest_matched_url ?? null, latest_image_url: updated.latest_image_url ?? orig.latest_image_url ?? null }
        : orig;
    });

    db.products = db.products.map((orig) => {
      const updated = updatedProducts.find((p) => p.id === orig.id);
      return updated ? { ...orig, viewty_score: updated.viewty_score } : orig;
    });

    db.price_snapshots.push(...newSnapshots);

    db.current_prices = db.current_prices.map((orig) => {
      const updated = currentPrices.find((cp) => cp.product_id === orig.product_id);
      return updated ? { ...orig, ...updated } : orig;
    });

    // If new products got current price entries that didn't exist
    currentPrices.forEach((cp) => {
      if (!db.current_prices.some((c) => c.product_id === cp.product_id)) {
        db.current_prices.push(cp);
      }
    });

    saveMockDB(db);
  }

  // Step 8: Trigger Page Revalidation (ISR on-demand)
  console.log('[Pipeline] Triggering revalidation of web routes...');
  try {
    // In a real execution environment:
    // const revalSecret = process.env.REVALIDATE_SECRET;
    // await fetch('https://viewtypick.com/api/revalidate', { method: 'POST', body: JSON.stringify({ secret: revalSecret }) });
  } catch (e) {
    console.error('[Pipeline] Route revalidation failed', e);
  }

  // Step 8.5: Upsert held (warning) prices into the inspection OX tab (preserving
  // the operator's existing O/X). Best-effort; never blocks the run.
  let pendingInspection = 0;
  const inspectionPending: string[] = [];
  if (!mockMode) {
    try {
      const res = await upsertInspection(inspectionCandidates);
      pendingInspection = res.pending;
      for (const c of inspectionCandidates) {
        inspectionPending.push(`${c.product_name} @ ${c.seller} ≈${c.estimated_price?.toLocaleString('ko-KR') ?? '-'}원 (${c.source || '?'})`);
      }
      console.log(`[Pipeline] Inspection tab upserted: ${res.written} row(s), ${res.pending} pending O/X.`);
    } catch (e) {
      console.warn('[Pipeline] Inspection tab write failed (continuing):', (e as Error).message);
    }
  }

  // Step 9: Send Daily Alerting Summary
  const duration = (Date.now() - startTime) / 1000;
  if (notifyEnabled) {
    await sendDailySummary({
      totalLinks: listings.length,
      successCount,
      warningCount,
      failureCount,
      durationSeconds: duration,
      noOfferCount,
      disappearedOffers,
      dataErrors,
      pendingInspectionCount: pendingInspection,
      inspectionItems: inspectionPending,
    });
  }

  console.log(
    `[Pipeline] Sync complete! Success rate: ${Math.round((successCount / listings.length) * 100)}% ` +
    `(no-offer/link-only: ${noOfferCount}, disappeared: ${disappearedOffers.length})`
  );
}

// Allow running via tsx
if (require.main === module) {
  crawlPipeline()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Pipeline] Critical Pipeline Crash:', err);
      process.exit(1);
    });
}
