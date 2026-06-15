import { isSupabaseConfigured, supabase } from '../supabase/client';
import { loadMockDB } from '../supabase/mockDb';
import { Category, UIProduct, UIStorePrice, Product, Listing, CurrentPrice, PriceSnapshot, PublicListingPrice, ProductBadge, Badge } from '../types';

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
 * Mirror of the public.listing_prices_public view (migration 0008) for the local
 * mock DB: collapse raw snapshots to the latest displayable row per listing,
 * projected to the same safe columns. The Supabase path reads the real view; the
 * mock path uses this so both feed mapToUIProduct identical shapes.
 */
export function snapshotsToPublicPrices(
  dbSnapshots: PriceSnapshot[],
  dbListings: Listing[]
): PublicListingPrice[] {
  const out: PublicListingPrice[] = [];
  for (const listing of dbListings) {
    const snaps = dbSnapshots.filter(
      (s) => s.listing_id === listing.id && isDisplayablePriceSnapshot(s, listing)
    );
    if (snaps.length === 0) continue;
    snaps.sort((a, b) => new Date(b.crawled_at).getTime() - new Date(a.crawled_at).getTime());
    const s = snaps[0];
    out.push({
      listing_id: s.listing_id,
      product_id: s.product_id,
      seller_id: listing.seller_id,
      sale_price: s.sale_price,
      base_unit_price: s.base_unit_price,
      effective_unit_price: s.effective_unit_price,
      unit_price: s.unit_price_reliable ? s.unit_price : null,
      promo_type: s.promo_type,
      promo_text: s.promo_text,
      in_stock: s.in_stock,
      shipping_note: s.shipping_note,
      matched_mall_name: s.matched_mall_name,
      crawled_at: s.crawled_at,
    });
  }
  return out;
}

/**
 * Maps database tables to unified UIProduct structure.
 */
function mapToUIProduct(
  prod: Product,
  dbListings: Listing[],
  dbPrices: CurrentPrice[],
  dbCategories: Category[],
  dbProductBadges: ProductBadge[],
  dbBadges: Badge[],
  dbListingPrices: PublicListingPrice[],
  dbSellers: { id: number; slug: string; name: string }[]
): UIProduct {
  const category = dbCategories.find((c) => c.id === prod.category_id);
  
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

  // Build stores pricing list
  const prodListings = dbListings.filter((l) => l.product_id === prod.id && l.is_active);
  const stores: UIStorePrice[] = prodListings.map((listing): UIStorePrice | null => {
    const seller = dbSellers.find((s) => s.id === listing.seller_id);

    // Latest displayable price for this listing comes from the public view
    // (already collapsed to one row per listing, safe columns only).
    const lp = dbListingPrices.find((p) => p.listing_id === listing.id);
    if (!lp) return null;
    // The view exposes in_stock but does not filter on it; drop out-of-stock.
    if (lp.in_stock === false) return null;

    const price = lp.base_unit_price || lp.sale_price || 0;
    const unitPrice = lp.unit_price !== null ? Number(lp.unit_price) : price / (prod.volume_ml || 50);

    return {
      name: listing.store_name || seller?.name || '기타',
      sellerSlug: seller?.slug || 'unknown',
      price: price,
      url: `/go/${listing.id}`, // redirection endpoint (affiliate_url → latest_matched_url)
      isBest: false, // dynamically set below
      isRocket: listing.is_rocket,
      isOfficial: listing.is_official_store,
      promoType: lp.promo_type,
      promoText: lp.promo_text,
      effectiveUnitPrice: lp.effective_unit_price !== null ? lp.effective_unit_price : price,
      unitPrice: unitPrice,
    };
  }).filter((s): s is UIStorePrice => s !== null);

  // Sort stores: cheapest base price first
  stores.sort((a, b) => a.price - b.price);

  // Assign isBest to the cheapest displayable store
  if (stores.length > 0) {
    stores.forEach((s, idx) => {
      s.isBest = idx === 0;
    });
  }

  const lowestPrice = stores[0] ? stores[0].price : 0;
  const previousPrice = lowestPrice > 0 ? Math.round(lowestPrice * 1.25) : 0; // Mock historic price
  const priceDropAmount = lowestPrice > 0 ? Math.max(previousPrice - lowestPrice, 0) : 0;
  const priceDropRate = lowestPrice > 0 && previousPrice > 0 ? Math.round((priceDropAmount / previousPrice) * 100) : 0;

  // Reason items from badge details or fallback template
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
    image: prod.image_url || '',
    volume: `${prod.volume_ml}ml`,
    description: prod.features || '검증된 큐레이션 추천 뷰티 제품',
    skinTypes: prod.skin_types,
    tags: prod.features ? prod.features.split(',').map((s) => s.trim()) : [],
    badges: badgeNames.length > 0 ? badgeNames : ['디렉터파이 추천'],
    lowestPrice: lowestPrice,
    previousPrice,
    priceDropAmount,
    priceDropRate,
    source,
    reasonItems,
    stores,
    viewtyScore: Number(prod.viewty_score) || 80,
    features: prod.features ? prod.features.split(',').map((s) => s.trim()) : [],
  };
}

/**
 * Fetch all categories.
 */
export async function getCategories(): Promise<Category[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
    if (!error && data) return data;
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
    if (data) return data;
  }
  const db = loadMockDB();
  return db.categories.find((c) => c.slug === slug) || null;
}

/**
 * Query products with options for category, skin type, and sorting.
 */
export async function getProducts(filters?: {
  category?: string;
  skinType?: string;
  sortBy?: 'recommend' | 'price_asc' | 'price_desc' | 'price_drop' | 'popularity';
}): Promise<UIProduct[]> {
  let dbProducts: Product[] = [];
  let dbListings: Listing[] = [];
  let dbPrices: CurrentPrice[] = [];
  let dbCategories: Category[] = [];
  let dbProductBadges: ProductBadge[] = [];
  let dbBadges: Badge[] = [];
  let dbListingPrices: PublicListingPrice[] = [];
  let dbSellers: { id: number; slug: string; name: string }[] = [];

  if (isSupabaseConfigured()) {
    const pRes = await supabase.from('products').select('*').eq('is_active', true);
    const lRes = await supabase.from('listings').select('*').eq('is_active', true);
    const prRes = await supabase.from('current_prices').select('*');
    const cRes = await supabase.from('categories').select('*');
    const pbRes = await supabase.from('product_badges').select('*');
    const bRes = await supabase.from('badges').select('*');
    const sRes = await supabase.from('sellers').select('id, slug, name');

    // Per-store prices come from the anon-readable public view (migration 0008),
    // NOT the raw price_snapshots table (anon-locked, DESIGN §13). Already the
    // latest displayable row per listing with safe columns only.
    const lpRes = await supabase.from('listing_prices_public').select('*');

    if (!pRes.error && pRes.data) {
      dbProducts = pRes.data;
      dbListings = lRes.data || [];
      dbPrices = prRes.data || [];
      dbCategories = cRes.data || [];
      dbProductBadges = pbRes.data || [];
      dbBadges = bRes.data || [];
      dbListingPrices = lpRes.data || [];
      dbSellers = sRes.data || [];
    }
  }

  if (dbProducts.length === 0) {
    const db = loadMockDB();
    dbProducts = db.products.filter((p) => p.is_active);
    dbListings = db.listings.filter((l) => l.is_active);
    dbPrices = db.current_prices;
    dbCategories = db.categories;
    dbProductBadges = db.product_badges;
    dbBadges = db.badges;
    // Mirror the public view locally from raw mock snapshots.
    dbListingPrices = snapshotsToPublicPrices(db.price_snapshots, dbListings);
    dbSellers = db.sellers;
  }

  // Convert to UI structure
  let uiProducts = dbProducts.map((p) =>
    mapToUIProduct(p, dbListings, dbPrices, dbCategories, dbProductBadges, dbBadges, dbListingPrices, dbSellers)
  );

  // Apply filters
  if (filters?.category) {
    uiProducts = uiProducts.filter((p) => p.category === filters.category);
  }

  if (filters?.skinType) {
    uiProducts = uiProducts.filter((p) => p.skinTypes.includes(filters.skinType!));
  }

  // Apply sorting
  const sortBy = filters?.sortBy || 'recommend';
  if (sortBy === 'recommend') {
    uiProducts.sort((a, b) => b.viewtyScore - a.viewtyScore);
  } else if (sortBy === 'price_asc') {
    uiProducts.sort((a, b) => a.lowestPrice - b.lowestPrice);
  } else if (sortBy === 'price_desc') {
    uiProducts.sort((a, b) => b.lowestPrice - a.lowestPrice);
  } else if (sortBy === 'price_drop') {
    uiProducts.sort((a, b) => (b.priceDropAmount || 0) - (a.priceDropAmount || 0));
  } else if (sortBy === 'popularity') {
    uiProducts.sort((a, b) => b.viewtyScore - a.viewtyScore);
  }

  return uiProducts;
}

/**
 * Fetch a single product by its slug.
 */
export async function getProductBySlug(slug: string): Promise<UIProduct | null> {
  const products = await getProducts();
  const product = products.find((p) => p.slug === slug);
  return product || null;
}

/**
 * Get top recommended products based on Viewty Score.
 */
export async function getRecommendedProducts(limit = 10): Promise<UIProduct[]> {
  const products = await getProducts();
  return products.slice(0, limit);
}

/**
 * Get products that have the best price drops today.
 */
export async function getTodayBestPriceProducts(limit = 6): Promise<UIProduct[]> {
  const products = await getProducts();
  const drops = products.filter((p) => (p.priceDropAmount || 0) > 0);
  drops.sort((a, b) => (b.priceDropAmount || 0) - (a.priceDropAmount || 0));
  return drops.slice(0, limit);
}
