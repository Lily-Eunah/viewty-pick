import { runSheetImport } from './sheets/import';
import { CoupangAdapter, NaverAdapter, OliveYoungAdapter, RetailerAdapter, PriceOffer } from './adapters/index';
import { applyManualOverrides, normalizePrice } from './core/normalize';
import { runHealthCheck, handleConsecutiveFailures } from './core/healthcheck';
import { recalculateViewtyScores } from './core/score';
import { sendDailySummary, sendCriticalAlarm } from './core/notify';
import { isSupabaseServerConfigured, supabaseServer } from '../lib/supabase/server';
import { loadMockDB, saveMockDB } from '../lib/supabase/mockDb';
import { Listing, Product, PriceSnapshot, CurrentPrice, PromoType, ManualOverride, RetailerAllowlist, Badge, ProductBadge, ScoreConfig } from '../lib/types';

export async function crawlPipeline(): Promise<void> {
  const startTime = Date.now();
  console.log('[Pipeline] Starting daily price sync pipeline...');

  // Step 1: Run Sheet Import
  try {
    const importStats = await runSheetImport();
    if (importStats.errorCount > 0) {
      console.warn(`[Pipeline] Sheet import finished with ${importStats.errorCount} validation warnings.`);
    }
  } catch (e: any) {
    console.error('[Pipeline] Sheet Import failed. Proceeding with existing database state...', e);
    await sendCriticalAlarm('Sheet Import Failure', `Import run crashed: ${e.message}`);
  }

  const useSupabase = isSupabaseServerConfigured();
  
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

    } catch (e: any) {
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

  // Step 3: Initialize Adapters
  const adapters: Record<string, RetailerAdapter> = {
    oliveyoung: new OliveYoungAdapter(),
    coupang: new CoupangAdapter(),
    naver: new NaverAdapter(),
  };

  const newSnapshots: PriceSnapshot[] = [];
  const updatedListings: Listing[] = [...listings];
  const mockDbLogs: any[] = [];

  let successCount = 0;
  let warningCount = 0;
  let failureCount = 0;

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

    let offer: PriceOffer;
    try {
      // 4.1 Crawl using adapter
      offer = await adapter.fetchOffer(listing);

      // 4.2 Apply active overrides
      offer = applyManualOverrides(product, listing, offer, manualOverrides);

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
      };

      if (check.status === 'failed') {
        console.error(`[Pipeline] Listing ${listing.link_key} failed health check: ${check.message}`);
        failureCount++;
        
        // Handle failure count increment
        const failMgmt = handleConsecutiveFailures(listing, prevSnap);
        const listIdx = updatedListings.findIndex((l) => l.id === listing.id);
        if (listIdx >= 0) {
          updatedListings[listIdx].fail_count = failMgmt.fail_count;
          updatedListings[listIdx].is_active = failMgmt.is_active;
        }

        if (failMgmt.should_notify) {
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

        // Reset fail count
        const listIdx = updatedListings.findIndex((l) => l.id === listing.id);
        if (listIdx >= 0) {
          updatedListings[listIdx].fail_count = 0;
        }

        newSnapshots.push(snapshot);
      }

    } catch (err: any) {
      console.error(`[Pipeline] Failed to gather details for listing ${listing.link_key}:`, err);
      failureCount++;

      // Execute fail handler
      const prevSnap = previousSnapshots.find((s) => s.listing_id === listing.id) || null;
      const failMgmt = handleConsecutiveFailures(listing, prevSnap);
      const listIdx = updatedListings.findIndex((l) => l.id === listing.id);
      if (listIdx >= 0) {
        updatedListings[listIdx].fail_count = failMgmt.fail_count;
        updatedListings[listIdx].is_active = failMgmt.is_active;
      }
    }
  }

  // Step 5: Price Aggregation (Determine Lowest Prices per Product)
  const currentPrices: CurrentPrice[] = [];
  for (const prod of products) {
    const prodListings = updatedListings.filter((l) => l.product_id === prod.id && l.is_active);
    const prodSnaps = newSnapshots.filter(
      (s) => prodListings.some((l) => l.id === s.listing_id) && s.status !== 'failed'
    );

    if (prodSnaps.length === 0) {
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
      baseLowestSeller = cheapestSeller ? cheapestSeller.name : '미정';
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
      promoLowestSeller = cheapestSeller ? cheapestSeller.name : '미정';
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

  // Step 6: Recalculate Viewty Scores (DESIGN.md §8)
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
      
      // Update listing fail counts
      for (const list of updatedListings) {
        await supabaseServer.from('listings').update({
          fail_count: list.fail_count,
          is_active: list.is_active,
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
        const snapsToInsert = newSnapshots.map(({ id, ...rest }) => rest);
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
        started_at: startTime,
        finished_at: new Date().toISOString(),
        status: 'completed',
        total_links: listings.length,
        success_count: successCount,
        warning_count: warningCount,
        failure_count: failureCount,
        summary: { durationMs: Date.now() - startTime },
      });

    } catch (e: any) {
      console.error('[Pipeline] Supabase persistence crashed:', e);
      await sendCriticalAlarm('Supabase Pipeline Error', `Failed to write crawl results: ${e.message}`);
      return;
    }
  } else {
    // Save to local Mock DB
    console.log('[Pipeline] Persisting snapshots and current prices to Local JSON file...');
    const db = loadMockDB();
    
    // Merge updates
    db.listings = db.listings.map((orig) => {
      const updated = updatedListings.find((l) => l.id === orig.id);
      return updated ? { ...orig, fail_count: updated.fail_count, is_active: updated.is_active } : orig;
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

  // Step 9: Send Daily Alerting Summary
  const duration = (Date.now() - startTime) / 1000;
  await sendDailySummary({
    totalLinks: listings.length,
    successCount,
    warningCount,
    failureCount,
    durationSeconds: duration,
  });

  console.log(`[Pipeline] Sync complete! Success rate: ${Math.round((successCount / listings.length) * 100)}%`);
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
