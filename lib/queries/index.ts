import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { isSupabaseConfigured, supabase } from '../supabase/client';
import { loadMockDB } from '../supabase/mockDb';
import { Category, UIProduct, UIStorePrice, Product, Listing, PriceSnapshot, PublicListingPrice, ProductBadge, Badge, SeoPage } from '../types';
import { matchSeoProducts, SeoFilters } from '../seo/match';

/**
 * Determines if a price snapshot is valid and safe to display.
 */
export function isDisplayablePriceSnapshot(s: PriceSnapshot, listing?: Listing): boolean {
  if (!s) return false;
  if (s.status !== 'ok') return false;
  if (s.in_stock === false) return false;
  if (s.parse_confidence === 'low') return false;
  if (listing && !listing.is_active) return false;
  return true;
}

/**
 * Mirror of the public.listing_prices_public view (migrations 0008 + 0010) for
 * the local mock DB: take each listing's LATEST snapshot (any status) and surface
 * it only when that latest snapshot is itself displayable, projected to the same
 * safe columns. Picking the latest first (then checking displayability) is the
 * §2.4 trust-first rule: a priced→no_offer transition drops the listing instead
 * of resurrecting a stale ok price behind the no_offer. The Supabase path reads
 * the real view; this keeps the mock path identical.
 */
export function snapshotsToPublicPrices(
  dbSnapshots: PriceSnapshot[],
  dbListings: Listing[]
): PublicListingPrice[] {
  const out: PublicListingPrice[] = [];
  for (const listing of dbListings) {
    const snaps = dbSnapshots.filter((s) => s.listing_id === listing.id);
    if (snaps.length === 0) continue;
    snaps.sort((a, b) => new Date(b.crawled_at).getTime() - new Date(a.crawled_at).getTime());
    const s = snaps[0];
    // §2.4: only the LATEST snapshot counts; if it isn't displayable (no_offer /
    // failed / low-confidence / OOS), the listing drops out — no stale fallback.
    if (!isDisplayablePriceSnapshot(s, listing)) continue;
    out.push({
      listing_id: s.listing_id,
      product_id: s.product_id,
      seller_id: listing.seller_id,
      sale_price: s.sale_price,
      base_unit_price: s.base_unit_price,
      effective_unit_price: s.effective_unit_price,
      unit_price: s.unit_price_reliable ? s.unit_price : null,
      total_ml: s.total_ml,
      promo_type: s.promo_type,
      promo_text: s.promo_text,
      in_stock: s.in_stock,
      shipping_note: s.shipping_note,
      matched_mall_name: s.matched_mall_name,
      image_url: s.image_url ?? null,
      crawled_at: s.crawled_at,
    });
  }
  return out;
}

/**
 * Display image precedence (sheet = source of truth):
 *   operator products.image_url → crawler-sourced Coupang image → placeholder ('').
 * products.image_url is NEVER overwritten by the crawler — this is a read-time
 * fallback only.
 *
 * The Coupang image is read straight off the listing row's latest_image_url
 * (cached by the crawler at match time, see crawler/run.ts), NOT from the ok-only
 * public price view. Image is DECOUPLED from price status: a Coupang listing whose
 * price is held in warning/inspection (e.g. ml mismatch) is dropped from the public
 * price view, but its image must still show. Price exposure stays ok-only elsewhere;
 * this fallback never resurrects a non-ok price, only the image.
 */
export function resolveDisplayImage(
  operatorImageUrl: string | null | undefined,
  productId: number,
  listings: Listing[],
  sellers: { id: number; slug: string }[]
): string {
  if (operatorImageUrl) return operatorImageUrl;
  const coupangSellerId = sellers.find((s) => s.slug === 'coupang')?.id;
  const coupangImage = listings.find(
    (l) =>
      l.product_id === productId &&
      l.seller_id === coupangSellerId &&
      l.is_active &&
      l.latest_image_url
  )?.latest_image_url;
  return coupangImage || '';
}

/**
 * Seller display gate: only sellers flagged for price comparison surface in the
 * UI. zigzag/ably are seeded link-only for future expansion (no crawler yet) and
 * carry is_price_comparison_enabled=false — their listing data stays in the DB but
 * is gated out of every render path (stores, link-only rows, lowest/official calc).
 * Flip the flag to true to surface them again. A missing seller is excluded too,
 * so an orphan listing never leaks in as a '기타' row.
 */
export function isSellerDisplayed(
  seller: { is_price_comparison_enabled?: boolean } | undefined
): boolean {
  return !!seller && seller.is_price_comparison_enabled === true;
}

export type DbSeller = { id: number; slug: string; name: string; is_price_comparison_enabled: boolean };

/**
 * Maps database tables to unified UIProduct structure.
 */
function mapToUIProduct(
  prod: Product,
  dbListings: Listing[],
  dbCategories: Category[],
  dbProductBadges: ProductBadge[],
  dbBadges: Badge[],
  dbListingPrices: PublicListingPrice[],
  dbSellers: DbSeller[]
): UIProduct {
  const category = dbCategories.find((c) => c.id === prod.category_id);
  // Parent major (대분류) of this product's minor category — for major-page aggregation.
  const majorCategory = category?.parent_id != null
    ? dbCategories.find((c) => c.id === category.parent_id)?.slug
    : category?.level === 'major' ? category.slug : undefined;

  // Find badges
  const pBadges = dbProductBadges.filter((pb) => pb.product_id === prod.id);
  const badgeNames = pBadges
    .map((pb) => dbBadges.find((b) => b.id === pb.badge_id)?.name)
    .filter((name): name is string => !!name);

  const badgeSlugs = pBadges
    .map((pb) => dbBadges.find((b) => b.id === pb.badge_id)?.slug)
    .filter(Boolean);

  const source = badgeSlugs.includes('directorpi')
    ? 'directorpi'
    : badgeSlugs.includes('hwahae_rank')
    ? 'hwahae'
    : 'oliveyoung';

  // Display image precedence: operator → Coupang listing image → placeholder
  // (see resolveDisplayImage). Sourced from the listing row's latest_image_url so a
  // warning/inspection-held Coupang price still shows its image (image ⟂ price status).
  const displayImage = resolveDisplayImage(prod.image_url, prod.id, dbListings, dbSellers);

  // 정가 (MSRP) for the DB representative volume — basis for the per-ml-normalized
  // "정가 대비 N% 할인" headline. null → discount simply hidden (never mis-displayed).
  const regularPrice = prod.regular_price != null && Number(prod.regular_price) > 0 ? Number(prod.regular_price) : null;

  // Unit of the volume amount (ml/g/매). Default 'ml' keeps existing products
  // unchanged. Display-only; threaded onto stores + the product for unit-aware labels.
  const volumeUnit = prod.volume_unit || 'ml';

  // Build stores: a priced row when the listing has a displayable price, else a
  // link-only row (tier-4: still show the seller with a "보기" link, no price).
  // Single display gate (covers priced / link-only / lowest / 공식몰대비): only
  // listings whose seller is display-enabled pass — non-display sellers
  // (zigzag/ably) and orphan listings are dropped here, before any calc.
  const prodListings = dbListings.filter(
    (l) =>
      l.product_id === prod.id &&
      l.is_active &&
      isSellerDisplayed(dbSellers.find((s) => s.id === l.seller_id))
  );
  const stores: UIStorePrice[] = prodListings.map((listing): UIStorePrice => {
    const seller = dbSellers.find((s) => s.id === listing.seller_id);
    const lp = dbListingPrices.find((p) => p.listing_id === listing.id);
    const baseStore = {
      name: listing.store_name || seller?.name || '기타',
      sellerSlug: seller?.slug || 'unknown',
      url: `/go/${listing.id}`, // redirect endpoint (affiliate_url → latest_matched_url)
      isBest: false,
      isRocket: listing.is_rocket,
      isOfficial: listing.is_official_store,
      volumeUnit, // product-level unit (ml/g/매) for this store's volume label
    };

    // Link-only: no displayable snapshot or out-of-stock → seller shown w/o a price.
    if (!lp || lp.in_stock === false) {
      return { ...baseStore, price: 0, hasPrice: false };
    }

    const price = lp.base_unit_price || lp.sale_price || 0;
    const eff = lp.effective_unit_price !== null ? lp.effective_unit_price : price;
    // Infer pack quantity from base vs per-unit (multipack: base = eff × N).
    const quantity = eff > 0 && price > eff ? Math.max(1, Math.round(price / eff)) : 1;
    // Per-retailer per-unit volume = total_ml / pack qty (this seller's own size).
    const volumeMl = lp.total_ml != null && quantity > 0 ? Math.round(lp.total_ml / quantity) : null;
    const unitPrice = lp.unit_price !== null ? Number(lp.unit_price) : null;
    return {
      ...baseStore,
      price,
      hasPrice: price > 0,
      promoType: lp.promo_type,
      promoText: lp.promo_text,
      effectiveUnitPrice: eff,
      // Only show ml-unit price when the view deemed it reliable (NULL otherwise).
      unitPrice,
      volumeMl,
      quantity: quantity > 1 ? quantity : undefined,
      composition: compositionLabel(lp.promo_type, lp.promo_text, quantity),
      // 정가 대비 할인률 (ml당-normalized). null when 정가/용량/ml당 missing.
      discountVsRegular: discountVsRegular(regularPrice, prod.volume_ml, unitPrice),
    };
  });

  // Ranking key (operator: per-retailer volume). When sellers carry DIFFERENT
  // sizes, compare ml당 (unit_price) so a smaller, cheaper-looking pack does not
  // win on total price alone. When sizes are uniform (the common case) ml당 ranks
  // identically to 개당, so we keep the per-unit (개당) key — no behaviour change.
  const pricedVolumes = new Set(
    stores.filter((s) => s.hasPrice && s.volumeMl != null).map((s) => s.volumeMl)
  );
  const volumesDiffer = pricedVolumes.size > 1;
  const allHaveUnitPrice = stores
    .filter((s) => s.hasPrice)
    .every((s) => s.unitPrice != null && s.unitPrice > 0);
  const rankByMl = volumesDiffer && allHaveUnitPrice;
  const perUnit = (s: UIStorePrice) => s.effectiveUnitPrice ?? s.price; // 개당 (₩), display + headline
  const rankKey = (s: UIStorePrice) => (rankByMl ? s.unitPrice! : perUnit(s));
  stores.sort((a, b) => {
    if (a.hasPrice !== b.hasPrice) return a.hasPrice ? -1 : 1;
    if (!a.hasPrice) return 0;
    return rankKey(a) - rankKey(b);
  });
  const firstPriced = stores.find((s) => s.hasPrice);
  if (firstPriced) firstPriced.isBest = true;

  const priced = stores.filter((s) => s.hasPrice);
  const hasAnyPrice = priced.length > 0;
  // Headline 최저가 stays a real per-개 (₩) price for cross-product comparability —
  // it is the chosen best seller's 개당 price (= the ml당-cheapest when sizes differ,
  // = the 개당-cheapest when sizes are uniform).
  const lowestPrice = firstPriced ? perUnit(firstPriced) : 0;
  const lowestBasePrice = hasAnyPrice ? Math.min(...priced.map((s) => s.price)) : 0;
  const bestIsMultipack = !!(firstPriced && (firstPriced.quantity ?? 1) > 1);

  // Freshness: newest crawled_at among this product's displayable rows.
  const prodLps = dbListingPrices.filter((p) => p.product_id === prod.id && p.crawled_at);
  const lastUpdated = prodLps.length > 0
    ? prodLps.reduce((a, b) => (a.crawled_at > b.crawled_at ? a : b)).crawled_at
    : null;

  // Reason items from badge details or fallback template.
  const reasonItems = pBadges.map((pb) => pb.detail).filter((d): d is string => !!d);
  if (reasonItems.length === 0) {
    reasonItems.push(
      '성분 안전성 통과 및 유해 가능 성분 배제',
      '민감성 피부 대상 저자극 적합 판정',
      '화장품 성분 분석 전문가 안심 오리지널 픽'
    );
  }

  return {
    id: prod.id.toString(),
    slug: prod.slug,
    brand: prod.brand || '기타 브랜드',
    name: prod.name,
    category: category?.slug || 'etc',
    majorCategory,
    image: displayImage,
    volume: `${prod.volume_ml}${volumeUnit}`,
    volumeMl: prod.volume_ml,
    volumeUnit,
    description: prod.features || '검증된 큐레이션 추천 뷰티 제품',
    skinTypes: prod.skin_types,
    tags: prod.features ? prod.features.split(',').map((s) => s.trim()) : [],
    badges: badgeNames.length > 0 ? badgeNames : ['디렉터파이 추천'],
    lowestPrice,
    lowestBasePrice,
    bestIsMultipack,
    hasAnyPrice,
    // 정가 대비: headline uses the best (최저가) store's ml당-normalized discount.
    regularPrice,
    discountVsRegular: firstPriced ? firstPriced.discountVsRegular ?? null : null,
    lastUpdated,
    source,
    reasonItems,
    stores,
    viewtyScore: Number(prod.viewty_score) || 80,
    features: prod.features ? prod.features.split(',').map((s) => s.trim()) : [],
  };
}

/**
 * Discount vs 정가 (MSRP), normalized PER-ML so a per-retailer size difference does
 * not distort it (consistent with migration 0014's per-retailer volume):
 *   정가 ml당 = regularPrice / volumeMl
 *   할인률    = round((정가ml당 − listingUnitPrice) / 정가ml당 × 100)
 * Returns null (→ no discount shown) whenever it can't be computed truthfully:
 *   - regularPrice missing/≤0, or volumeMl (DB 대표 용량) missing/≤0
 *   - the listing's ml당 (unitPrice) is unknown/unreliable
 * A sale at or above 정가 (stale MSRP) clamps to 0 — never a negative discount.
 */
export function discountVsRegular(
  regularPrice: number | null | undefined,
  volumeMl: number | null | undefined,
  listingUnitPrice: number | null | undefined,
): number | null {
  const reg = Number(regularPrice);
  const vol = Number(volumeMl);
  const unit = Number(listingUnitPrice);
  if (!(reg > 0) || !(vol > 0) || !(unit > 0)) return null;
  const regularPerMl = reg / vol;
  const pct = Math.round(((regularPerMl - unit) / regularPerMl) * 100);
  return pct > 0 ? pct : 0;
}

/** 구성 label from promo info — what was actually scraped, never invented. */
export function compositionLabel(promoType: string, promoText: string | null, quantity: number): string | null {
  const t = promoText || '';
  if (promoType === 'buy_x_get_y') return t.match(/\d+\s*\+\s*\d+/)?.[0] ?? '1+1';
  if (promoType === 'gift' || /증정/.test(t)) return '증정';
  if (quantity > 1) return `${quantity}개`;
  return null;
}

/**
 * List-visibility gate: a product surfaces in a list ONLY when it has at least one
 * displayed-seller link. `stores` is already filtered to display-enabled sellers
 * (네이버/쿠팡/올영) in mapToUIProduct, so `stores.length === 0` means no 3-사 link
 * exists — zigzag/ably-only products and link-less products drop out of every list.
 * NOTE: a product WITH a link but no price (hasAnyPrice=false) is NOT hidden here —
 * it stays visible and is sorted to the bottom instead (see byPriceThen).
 * Detail pages (/p/[slug]) are out of scope: direct-URL access stays unchanged.
 */
export function hasDisplayedSellerLink(p: UIProduct): boolean {
  return p.stores.length > 0;
}

/**
 * Sort wrapper: price-less products (hasAnyPrice=false) always sink to the bottom
 * regardless of the active sort (viewtyScore / price / discount …); products that
 * share the same hasAnyPrice keep the provided 2차 comparator among themselves.
 */
export function byPriceThen(
  cmp: (a: UIProduct, b: UIProduct) => number
): (a: UIProduct, b: UIProduct) => number {
  return (a, b) => (a.hasAnyPrice !== b.hasAnyPrice ? (a.hasAnyPrice ? -1 : 1) : cmp(a, b));
}

// ---------------------------------------------------------------------------
// Raw data fetch — parallelized and deduplicated per server render via cache()
// ---------------------------------------------------------------------------

export interface RawData {
  dbProducts: Product[];
  dbListings: Listing[];
  dbCategories: Category[];
  dbProductBadges: ProductBadge[];
  dbBadges: Badge[];
  dbListingPrices: PublicListingPrice[];
  dbSellers: DbSeller[];
}

/**
 * Retry a transiently-failing async op (post-crawl Supabase load spikes). The
 * nightly failure mode: the daily crawler finishes its writes, fires the on-demand
 * revalidate, and the very next /best render's queries hit Supabase while it is
 * still busy — one error and (before this fix) the code fell into loadMockDB()'s
 * fs.readFileSync, which throws on the Worker; OpenNext then CACHES that 500 as the
 * route response, so the page stays broken until the next revalidate/deploy.
 */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 400): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
    }
  }
  throw lastErr;
}

const fetchAllData = cache(async (): Promise<RawData> => {
  if (isSupabaseConfigured()) {
    // Retried; a failed query REJECTS (never falls through to the fs-backed mock —
    // fs throws on the Worker and the resulting 500 would be cached as the route).
    // A clean rejection also keeps unstable_cache from persisting a bad (empty)
    // value for the whole PRODUCTS_REVALIDATE_SECONDS window.
    return withRetry(async () => {
      const [pRes, lRes, cRes, pbRes, bRes, sRes, lpRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('listings').select('*').eq('is_active', true),
        supabase.from('categories').select('*'),
        supabase.from('product_badges').select('*'),
        supabase.from('badges').select('*'),
        supabase.from('sellers').select('id, slug, name, is_price_comparison_enabled'),
        supabase.from('listing_prices_public').select('*'),
      ]);
      if (pRes.error || !pRes.data) throw new Error(`[queries] fetchAllData products query failed: ${pRes.error?.message ?? 'no data'}`);
      return {
        dbProducts: pRes.data,
        dbListings: lRes.data || [],
        dbCategories: cRes.data || [],
        dbProductBadges: pbRes.data || [],
        dbBadges: bRes.data || [],
        dbListingPrices: lpRes.data || [],
        dbSellers: sRes.data || [],
      };
    });
  }

  // Local dev without Supabase only — fs is available there.
  const db = loadMockDB();
  const dbListings = db.listings.filter((l) => l.is_active);
  return {
    dbProducts: db.products.filter((p) => p.is_active),
    dbListings,
    dbCategories: db.categories,
    dbProductBadges: db.product_badges,
    dbBadges: db.badges,
    dbListingPrices: snapshotsToPublicPrices(db.price_snapshots, dbListings),
    dbSellers: db.sellers,
  };
});

/**
 * Fetch all categories.
 */
export async function getCategories(): Promise<Category[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
    if (!error && data) return data;
    return []; // configured-but-failed: degrade, never fall into the fs mock (Worker-fatal)
  }
  const db = loadMockDB();
  return [...db.categories].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Fetch a single category by its slug.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase.from('categories').select('*').eq('slug', slug).single();
    return data ?? null; // missing OR failed: notFound beats the fs mock (Worker-fatal)
  }
  const db = loadMockDB();
  return db.categories.find((c) => c.slug === slug) || null;
}

// Tag for the global product cache. revalidateTag(PRODUCTS_TAG) — fired by the daily
// crawler / product import — refreshes every page derived from getAllUIProducts()
// (home, category, skin, pick, best).
export const PRODUCTS_TAG = 'products';
// Time-based safety net (1 day) for when an on-demand revalidate is missed; the
// crawler refreshes daily anyway. Pages declare the same window literally.
const PRODUCTS_REVALIDATE_SECONDS = 86400;

/**
 * Pure mapping: raw DB rows → the display-gated full UIProduct list (drops products
 * with no displayed-seller link — 네이버/쿠팡/올영). Extracted so the heavy mapping can
 * be cached once globally and unit-tested without the cache/Supabase runtime.
 */
export function buildAllUIProducts(raw: RawData): UIProduct[] {
  const { dbProducts, dbListings, dbCategories, dbProductBadges, dbBadges, dbListingPrices, dbSellers } = raw;
  return dbProducts
    .map((p) =>
      mapToUIProduct(p, dbListings, dbCategories, dbProductBadges, dbBadges, dbListingPrices, dbSellers)
    )
    .filter(hasDisplayedSellerLink);
}

/**
 * The whole display-gated catalog, computed ONCE per revalidation window and shared
 * by every list/SEO/home render — no per-page, per-request re-mapping. Backed by the
 * R2 incremental cache; invalidated by revalidateTag(PRODUCTS_TAG) on daily price /
 * product updates. fetchAllData + mapToUIProduct(×N) run only on a cache miss.
 */
const getAllUIProducts = unstable_cache(
  async (): Promise<UIProduct[]> => buildAllUIProducts(await fetchAllData()),
  ['all-ui-products'],
  { tags: [PRODUCTS_TAG], revalidate: PRODUCTS_REVALIDATE_SECONDS },
);

/**
 * Query products with options for category, skin type, and sorting. Reads the cached
 * global list (getAllUIProducts) and only filters + sorts per call (cheap).
 */
export async function getProducts(filters?: {
  category?: string;
  skinType?: string;
  sortBy?: 'recommend' | 'price_asc' | 'price_desc' | 'discount' | 'popularity';
}): Promise<UIProduct[]> {
  const all = await getAllUIProducts();

  // Filter — category matches a minor (소분류) slug OR a major (대분류) slug (a major
  // page aggregates all of its minors' products).
  let uiProducts = all;
  if (filters?.category) {
    uiProducts = uiProducts.filter((p) => p.category === filters.category || p.majorCategory === filters.category);
  }
  if (filters?.skinType) {
    uiProducts = uiProducts.filter((p) => p.skinTypes.includes(filters.skinType!));
  }

  // Sort a COPY — never mutate the shared cached array.
  const sorted = [...uiProducts];
  const sortBy = filters?.sortBy || 'recommend';
  // Missing/0 price sorts to the BACK in price sorts (it is not "cheapest").
  const askPrice = (p: UIProduct) => (p.lowestPrice > 0 ? p.lowestPrice : Number.POSITIVE_INFINITY);
  // Every branch is wrapped in byPriceThen so price-less products sink to the bottom
  // (1차 키 = hasAnyPrice), then the chosen criterion ranks the rest.
  if (sortBy === 'recommend' || sortBy === 'popularity') {
    sorted.sort(byPriceThen((a, b) => b.viewtyScore - a.viewtyScore));
  } else if (sortBy === 'price_asc') {
    sorted.sort(byPriceThen((a, b) => askPrice(a) - askPrice(b)));
  } else if (sortBy === 'price_desc') {
    sorted.sort(byPriceThen((a, b) => (b.lowestPrice || 0) - (a.lowestPrice || 0)));
  } else if (sortBy === 'discount') {
    // 정가 대비 할인률 기준. 정가 미입력 제품은 0으로 뒤로 밀린다.
    const disc = (p: UIProduct) => p.discountVsRegular ?? 0;
    sorted.sort(byPriceThen((a, b) => disc(b) - disc(a)));
  }

  return sorted;
}

/**
 * Fetch a single product by its slug.
 */
export async function getProductBySlug(slug: string): Promise<UIProduct | null> {
  const { dbProducts, dbListings, dbCategories, dbProductBadges, dbBadges, dbListingPrices, dbSellers } =
    await fetchAllData();
  const prod = dbProducts.find((p) => p.slug === slug);
  if (!prod) return null;
  return mapToUIProduct(prod, dbListings, dbCategories, dbProductBadges, dbBadges, dbListingPrices, dbSellers);
}

/**
 * Get top recommended products based on Viewty Score.
 */
export async function getRecommendedProducts(limit = 10): Promise<UIProduct[]> {
  const products = await getProducts();
  return [...products].sort(byPriceThen((a, b) => b.viewtyScore - a.viewtyScore)).slice(0, limit);
}

/**
 * 정가 대비 최저가 픽: products where a verified seller beats the 정가 (MSRP),
 * ranked by the 정가-대비 discount %. 정가 미입력 제품은 제외된다.
 */
export async function getOfficialPickProducts(limit = 6): Promise<UIProduct[]> {
  const products = await getProducts();
  const disc = (p: UIProduct) => p.discountVsRegular ?? 0;
  return products
    .filter((p) => disc(p) > 0)
    .sort(byPriceThen((a, b) => disc(b) - disc(a)))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Page-specific helpers — called server-side; not visible in browser network
// ---------------------------------------------------------------------------

export async function getHomePageData() {
  const allProducts = await getProducts();
  const disc = (p: UIProduct) => p.discountVsRegular ?? 0;
  return {
    allProducts,
    recommended: [...allProducts].sort(byPriceThen((a, b) => b.viewtyScore - a.viewtyScore)).slice(0, 8),
    officialPicks: allProducts
      .filter((p) => disc(p) > 0)
      .sort(byPriceThen((a, b) => disc(b) - disc(a)))
      .slice(0, 6),
  };
}

export async function getCategoryPageData(categorySlug: string) {
  const [category, products, allCats] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getProducts({ category: categorySlug, sortBy: 'recommend' }),
    getCategories(),
  ]);
  // On a major (대분류) page, expose its minors for sub-filter chips.
  const minors = category && category.level === 'major'
    ? allCats.filter((c) => c.parent_id === category.id).sort((a, b) => a.sort_order - b.sort_order)
    : [];
  return { category, products, minors };
}

const SKIN_NAME_MAP: Record<string, string> = {
  sensitive: '민감성', dry: '건성', oily: '지성',
  dehydrated: '수부지', combination: '복합성', acne: '여드름성',
};

export async function getPickPageData(badgeSlug: string, categorySlug: string) {
  const [category, allProds] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getProducts({ category: categorySlug, sortBy: 'recommend' }),
  ]);
  const products = allProds.filter((p) => {
    if (badgeSlug === 'directorpi') return p.source === 'directorpi' || p.badges.some((b) => b.includes('디렉터파이'));
    if (badgeSlug === 'hwahae') return p.source === 'hwahae' || p.badges.some((b) => b.includes('화해'));
    return true;
  });
  return { category, products };
}

// ---------------------------------------------------------------------------
// SEO landing pages (/best/[slug]) — driven by the seo_pages table (sheet-sourced)
// ---------------------------------------------------------------------------

/**
 * All active SEO pages, R2-cached like getAllUIProducts so /best renders from the
 * incremental cache at Worker runtime instead of a live Supabase call per request.
 *
 * Why this must be cached + fs-free: at Cloudflare Worker runtime the public Supabase
 * env is not always bound (it's inlined/available at build time). An uncached live
 * query would then miss and fall back to loadMockDB(), which does fs.readFileSync —
 * unavailable in the Worker → the whole /best route 500s. Populating this cache at
 * build/revalidate time (when Supabase IS configured) and never touching fs keeps the
 * route resilient and consistent with the product catalog.
 */
const fetchActiveSeoPages = unstable_cache(
  async (): Promise<SeoPage[]> => {
    if (isSupabaseConfigured()) {
      // Retried; final failure REJECTS so unstable_cache doesn't persist an empty
      // list for the whole revalidate window (the page-level guard turns the
      // rejection into a degraded 200 that self-heals on the next ISR pass).
      return withRetry(async () => {
        const { data, error } = await supabase.from('seo_pages').select('*').eq('is_active', true);
        if (error || !data) throw new Error(`[queries] seo_pages query failed: ${error?.message ?? 'no data'}`);
        return data as SeoPage[];
      });
    }
    // Local dev without Supabase: the file mock is only reachable where fs exists.
    try {
      const db = loadMockDB();
      return (db.seo_pages ?? []).filter((s) => s.is_active);
    } catch {
      return [];
    }
  },
  ['active-seo-pages'],
  { tags: [PRODUCTS_TAG], revalidate: PRODUCTS_REVALIDATE_SECONDS },
);

/** All active SEO pages (anon-readable view per migration 0002 RLS). */
export const getActiveSeoPages = cache((): Promise<SeoPage[]> => fetchActiveSeoPages());

/**
 * Resolve one SEO page + the products it lists. Reuses getProducts (display gate +
 * recommend sort) and the shared matcher so the live list and the generator's
 * "≥4 products" gate stay identical. Returns page=null for unknown/inactive slugs.
 *
 * Wrapped in React cache() so the per-request dedup covers /best/[slug], which calls
 * this twice in one render (generateMetadata + the page body). Keyed by the slug
 * string, the second call returns the first's result — the full getProducts mapping
 * + matchSeoProducts runs once per request instead of twice.
 */
export const getSeoPageData = cache(async (slug: string): Promise<{ page: SeoPage | null; products: UIProduct[] }> => {
  const [pages, allProducts] = await Promise.all([getActiveSeoPages(), getProducts({ sortBy: 'recommend' })]);
  const page = pages.find((p) => p.slug === slug) ?? null;
  if (!page) return { page: null, products: [] };
  const filters: SeoFilters = {
    category: page.category,
    skinType: page.skin_type,
    badge: page.badge_type,
    keywords: page.keywords,
  };
  return { page, products: matchSeoProducts(allProducts, filters) };
});

export async function getSkinPageData(skinTypeSlug: string, categorySlug: string) {
  const skinName = SKIN_NAME_MAP[skinTypeSlug] || '민감성';
  const [category, products] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getProducts({ category: categorySlug, skinType: skinName, sortBy: 'recommend' }),
  ]);
  return { category, products, skinName };
}

// Scoped product detail: avoids full price_snapshots scan, grows important as crawlers run
export const getProductDetailPageData = cache(async (slug: string): Promise<{ product: UIProduct | null; related: UIProduct[] }> => {
  if (isSupabaseConfigured()) {
    const { data: prodRow } = await supabase
      .from('products').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();

    if (!prodRow) return { product: null, related: [] };

    const [listRes, pbRes, catRes, selRes, badgeRes] = await Promise.all([
      supabase.from('listings').select('*').eq('product_id', prodRow.id).eq('is_active', true),
      supabase.from('product_badges').select('*').eq('product_id', prodRow.id),
      supabase.from('categories').select('*'),
      supabase.from('sellers').select('id, slug, name, is_price_comparison_enabled'),
      supabase.from('badges').select('*'),
    ]);

    const listingIds: number[] = (listRes.data ?? []).map((l: { id: number }) => l.id);
    const { data: lpData } = listingIds.length > 0
      ? await supabase.from('listing_prices_public').select('*').in('listing_id', listingIds)
      : { data: [] };

    const product = mapToUIProduct(
      prodRow as Product, (listRes.data ?? []) as Listing[],
      (catRes.data ?? []) as Category[], (pbRes.data ?? []) as ProductBadge[],
      (badgeRes.data ?? []) as Badge[], (lpData ?? []) as PublicListingPrice[],
      (selRes.data ?? []) as DbSeller[],
    );

    const { data: relRows } = await supabase
      .from('products').select('*')
      .eq('category_id', prodRow.category_id).eq('is_active', true).neq('id', prodRow.id).limit(6);

    let related: UIProduct[] = [];
    if (relRows && relRows.length > 0) {
      const relIds: number[] = relRows.map((p: { id: number }) => p.id);
      const [relListRes, relPbRes] = await Promise.all([
        supabase.from('listings').select('*').in('product_id', relIds).eq('is_active', true),
        supabase.from('product_badges').select('*').in('product_id', relIds),
      ]);
      const relListingIds: number[] = (relListRes.data ?? []).map((l: { id: number }) => l.id);
      const { data: relLpData } = relListingIds.length > 0
        ? await supabase.from('listing_prices_public').select('*').in('listing_id', relListingIds)
        : { data: [] };
      related = (relRows as Product[])
        .map((p) =>
          mapToUIProduct(
            p, (relListRes.data ?? []) as Listing[],
            (catRes.data ?? []) as Category[], (relPbRes.data ?? []) as ProductBadge[],
            (badgeRes.data ?? []) as Badge[], (relLpData ?? []) as PublicListingPrice[],
            (selRes.data ?? []) as DbSeller[],
          )
        )
        .filter(hasDisplayedSellerLink)
        .sort(byPriceThen((a, b) => b.viewtyScore - a.viewtyScore));
    }

    return { product, related };
  }

  // Mock fallback — fetchAllData() is already cached, no extra cost
  const raw = await fetchAllData();
  const prod = raw.dbProducts.find((p) => p.slug === slug);
  if (!prod) return { product: null, related: [] };
  const product = mapToUIProduct(prod, raw.dbListings, raw.dbCategories, raw.dbProductBadges, raw.dbBadges, raw.dbListingPrices, raw.dbSellers);
  const related = raw.dbProducts
    .filter((p) => p.category_id === prod.category_id && p.id !== prod.id && p.is_active)
    .map((p) => mapToUIProduct(p, raw.dbListings, raw.dbCategories, raw.dbProductBadges, raw.dbBadges, raw.dbListingPrices, raw.dbSellers))
    .filter(hasDisplayedSellerLink)
    .sort(byPriceThen((a, b) => b.viewtyScore - a.viewtyScore))
    .slice(0, 6);
  return { product, related };
});
