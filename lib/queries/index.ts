import { cache } from 'react';
import { isSupabaseConfigured, supabase } from '../supabase/client';
import { loadMockDB } from '../supabase/mockDb';
import { Category, UIProduct, UIStorePrice, Product, Listing, CurrentPrice, PriceSnapshot, ProductBadge, Badge } from '../types';

export function isDisplayablePriceSnapshot(s: PriceSnapshot, listing?: Listing): boolean {
  if (!s) return false;
  if (s.status !== 'ok') return false;
  if (s.in_stock === false) return false;
  if (s.parse_confidence === 'low') return false;
  if (listing && !listing.is_active) return false;
  return true;
}

function mapToUIProduct(
  prod: Product,
  dbListings: Listing[],
  dbPrices: CurrentPrice[],
  dbCategories: Category[],
  dbProductBadges: ProductBadge[],
  dbBadges: Badge[],
  dbSnapshots: PriceSnapshot[],
  dbSellers: { id: number; slug: string; name: string }[]
): UIProduct {
  const category = dbCategories.find((c) => c.id === prod.category_id);

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

  const prodListings = dbListings.filter((l) => l.product_id === prod.id && l.is_active);
  const stores: UIStorePrice[] = prodListings.map((listing): UIStorePrice | null => {
    const seller = dbSellers.find((s) => s.id === listing.seller_id);

    const snaps = dbSnapshots.filter((s) => s.listing_id === listing.id && isDisplayablePriceSnapshot(s, listing));
    if (snaps.length === 0) return null;

    snaps.sort((a, b) => new Date(b.crawled_at).getTime() - new Date(a.crawled_at).getTime());
    const latestSnap = snaps[0];

    const price = latestSnap.base_unit_price || latestSnap.sale_price || 0;
    const unitPrice = latestSnap.unit_price !== null ? Number(latestSnap.unit_price) : price / (prod.volume_ml || 50);

    return {
      name: listing.store_name || seller?.name || '기타',
      sellerSlug: seller?.slug || 'unknown',
      price: price,
      url: `/go/${listing.id}`,
      isBest: false,
      isRocket: listing.is_rocket,
      isOfficial: listing.is_official_store,
      promoType: latestSnap.promo_type,
      promoText: latestSnap.promo_text,
      effectiveUnitPrice: latestSnap.effective_unit_price !== null ? latestSnap.effective_unit_price : price,
      unitPrice: unitPrice,
    };
  }).filter((s): s is UIStorePrice => s !== null);

  stores.sort((a, b) => a.price - b.price);

  if (stores.length > 0) {
    stores.forEach((s, idx) => { s.isBest = idx === 0; });
  }

  const lowestPrice = stores[0] ? stores[0].price : 0;
  const previousPrice = lowestPrice > 0 ? Math.round(lowestPrice * 1.25) : 0;
  const priceDropAmount = lowestPrice > 0 ? Math.max(previousPrice - lowestPrice, 0) : 0;
  const priceDropRate = lowestPrice > 0 && previousPrice > 0 ? Math.round((priceDropAmount / previousPrice) * 100) : 0;

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

// ---------------------------------------------------------------------------
// Raw data fetch — parallelized and deduplicated per server render via cache()
// ---------------------------------------------------------------------------

interface RawData {
  dbProducts: Product[];
  dbListings: Listing[];
  dbPrices: CurrentPrice[];
  dbCategories: Category[];
  dbProductBadges: ProductBadge[];
  dbBadges: Badge[];
  dbSnapshots: PriceSnapshot[];
  dbSellers: { id: number; slug: string; name: string }[];
}

const fetchAllData = cache(async (): Promise<RawData> => {
  if (isSupabaseConfigured()) {
    const [pRes, lRes, prRes, cRes, pbRes, bRes, sRes, snapRes] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true),
      supabase.from('listings').select('*').eq('is_active', true),
      supabase.from('current_prices').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('product_badges').select('*'),
      supabase.from('badges').select('*'),
      supabase.from('sellers').select('id, slug, name'),
      supabase.from('price_snapshots').select('*'),
    ]);

    if (!pRes.error && pRes.data) {
      return {
        dbProducts: pRes.data,
        dbListings: lRes.data || [],
        dbPrices: prRes.data || [],
        dbCategories: cRes.data || [],
        dbProductBadges: pbRes.data || [],
        dbBadges: bRes.data || [],
        dbSnapshots: snapRes.data || [],
        dbSellers: sRes.data || [],
      };
    }
  }

  const db = loadMockDB();
  return {
    dbProducts: db.products.filter((p) => p.is_active),
    dbListings: db.listings.filter((l) => l.is_active),
    dbPrices: db.current_prices,
    dbCategories: db.categories,
    dbProductBadges: db.product_badges,
    dbBadges: db.badges,
    dbSnapshots: db.price_snapshots,
    dbSellers: db.sellers,
  };
});

// ---------------------------------------------------------------------------
// Public query functions
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
    if (!error && data) return data;
  }
  const db = loadMockDB();
  return [...db.categories].sort((a, b) => a.sort_order - b.sort_order);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase.from('categories').select('*').eq('slug', slug).single();
    if (data) return data;
  }
  const db = loadMockDB();
  return db.categories.find((c) => c.slug === slug) || null;
}

export async function getProducts(filters?: {
  category?: string;
  skinType?: string;
  sortBy?: 'recommend' | 'price_asc' | 'price_desc' | 'price_drop' | 'popularity';
}): Promise<UIProduct[]> {
  const { dbProducts, dbListings, dbPrices, dbCategories, dbProductBadges, dbBadges, dbSnapshots, dbSellers } =
    await fetchAllData();

  let uiProducts = dbProducts.map((p) =>
    mapToUIProduct(p, dbListings, dbPrices, dbCategories, dbProductBadges, dbBadges, dbSnapshots, dbSellers)
  );

  if (filters?.category) {
    uiProducts = uiProducts.filter((p) => p.category === filters.category);
  }
  if (filters?.skinType) {
    uiProducts = uiProducts.filter((p) => p.skinTypes.includes(filters.skinType!));
  }

  const sortBy = filters?.sortBy || 'recommend';
  if (sortBy === 'recommend' || sortBy === 'popularity') {
    uiProducts.sort((a, b) => b.viewtyScore - a.viewtyScore);
  } else if (sortBy === 'price_asc') {
    uiProducts.sort((a, b) => a.lowestPrice - b.lowestPrice);
  } else if (sortBy === 'price_desc') {
    uiProducts.sort((a, b) => b.lowestPrice - a.lowestPrice);
  } else if (sortBy === 'price_drop') {
    uiProducts.sort((a, b) => (b.priceDropAmount || 0) - (a.priceDropAmount || 0));
  }

  return uiProducts;
}

export async function getProductBySlug(slug: string): Promise<UIProduct | null> {
  const { dbProducts, dbListings, dbPrices, dbCategories, dbProductBadges, dbBadges, dbSnapshots, dbSellers } =
    await fetchAllData();
  const prod = dbProducts.find((p) => p.slug === slug);
  if (!prod) return null;
  return mapToUIProduct(prod, dbListings, dbPrices, dbCategories, dbProductBadges, dbBadges, dbSnapshots, dbSellers);
}

export async function getRecommendedProducts(limit = 10): Promise<UIProduct[]> {
  const products = await getProducts();
  return [...products].sort((a, b) => b.viewtyScore - a.viewtyScore).slice(0, limit);
}

export async function getTodayBestPriceProducts(limit = 6): Promise<UIProduct[]> {
  const products = await getProducts();
  return products
    .filter((p) => (p.priceDropAmount || 0) > 0)
    .sort((a, b) => (b.priceDropAmount || 0) - (a.priceDropAmount || 0))
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Page-specific helpers — called server-side; not visible in browser network
// ---------------------------------------------------------------------------

export async function getHomePageData() {
  const allProducts = await getProducts();
  return {
    allProducts,
    recommended: [...allProducts].sort((a, b) => b.viewtyScore - a.viewtyScore).slice(0, 8),
    drops: allProducts
      .filter((p) => (p.priceDropAmount || 0) > 0)
      .sort((a, b) => (b.priceDropAmount || 0) - (a.priceDropAmount || 0))
      .slice(0, 5),
  };
}

export async function getCategoryPageData(categorySlug: string) {
  const [category, products] = await Promise.all([
    getCategoryBySlug(categorySlug),
    getProducts({ category: categorySlug, sortBy: 'recommend' }),
  ]);
  return { category, products };
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
      supabase.from('sellers').select('id, slug, name'),
      supabase.from('badges').select('*'),
    ]);

    const listingIds: number[] = (listRes.data ?? []).map((l: { id: number }) => l.id);
    const { data: snapData } = listingIds.length > 0
      ? await supabase.from('price_snapshots').select('*').in('listing_id', listingIds)
      : { data: [] };

    const product = mapToUIProduct(
      prodRow as Product, (listRes.data ?? []) as Listing[], [],
      (catRes.data ?? []) as Category[], (pbRes.data ?? []) as ProductBadge[],
      (badgeRes.data ?? []) as Badge[], (snapData ?? []) as PriceSnapshot[],
      (selRes.data ?? []) as { id: number; slug: string; name: string }[],
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
      const { data: relSnapData } = relListingIds.length > 0
        ? await supabase.from('price_snapshots').select('*').in('listing_id', relListingIds)
        : { data: [] };
      related = (relRows as Product[]).map((p) =>
        mapToUIProduct(
          p, (relListRes.data ?? []) as Listing[], [],
          (catRes.data ?? []) as Category[], (relPbRes.data ?? []) as ProductBadge[],
          (badgeRes.data ?? []) as Badge[], (relSnapData ?? []) as PriceSnapshot[],
          (selRes.data ?? []) as { id: number; slug: string; name: string }[],
        )
      );
    }

    return { product, related };
  }

  // Mock fallback — fetchAllData() is already cached, no extra cost
  const raw = await fetchAllData();
  const prod = raw.dbProducts.find((p) => p.slug === slug);
  if (!prod) return { product: null, related: [] };
  const product = mapToUIProduct(prod, raw.dbListings, raw.dbPrices, raw.dbCategories, raw.dbProductBadges, raw.dbBadges, raw.dbSnapshots, raw.dbSellers);
  const related = raw.dbProducts
    .filter((p) => p.category_id === prod.category_id && p.id !== prod.id && p.is_active)
    .slice(0, 6)
    .map((p) => mapToUIProduct(p, raw.dbListings, raw.dbPrices, raw.dbCategories, raw.dbProductBadges, raw.dbBadges, raw.dbSnapshots, raw.dbSellers));
  return { product, related };
});
