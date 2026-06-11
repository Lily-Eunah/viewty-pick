import fs from 'fs';
import path from 'path';
import { Category, Seller, Product, Badge, ProductBadge, Listing, RetailerAllowlist, PriceSnapshot, CurrentPrice, ManualOverride, SeoPage, ScoreConfig } from '../types';
import { categories as defaultCategories } from '../data/categories';
import { products as defaultUiProducts } from '../data/products';

const MOCK_DB_FILE = path.join(process.cwd(), 'lib/data/db_mock.json');

export interface MockDBState {
  categories: Category[];
  sellers: Seller[];
  products: Product[];
  badges: Badge[];
  product_badges: ProductBadge[];
  listings: Listing[];
  retailer_allowlist: RetailerAllowlist[];
  price_snapshots: PriceSnapshot[];
  current_prices: CurrentPrice[];
  manual_overrides: ManualOverride[];
  seo_pages: SeoPage[];
  score_config: ScoreConfig[];
}

// 1. Initial State Seed Generator
function getInitialState(): MockDBState {
  // Sellers definition (DESIGN.md §4.1)
  const sellers: Seller[] = [
    { id: 1, slug: 'oliveyoung', name: '올리브영', priority: 1, collect_method: 'crawl', is_affiliate_supported: true, is_price_comparison_enabled: true, is_trusted: true },
    { id: 2, slug: 'coupang', name: '쿠팡', priority: 2, collect_method: 'api', is_affiliate_supported: true, is_price_comparison_enabled: true, is_trusted: true },
    { id: 3, slug: 'naver', name: '네이버스토어', priority: 3, collect_method: 'api', is_affiliate_supported: true, is_price_comparison_enabled: true, is_trusted: true },
    { id: 4, slug: 'zigzag', name: '지그재그', priority: 4, collect_method: 'crawl', is_affiliate_supported: true, is_price_comparison_enabled: true, is_trusted: true },
    { id: 5, slug: 'ably', name: '에이블리', priority: 5, collect_method: 'crawl', is_affiliate_supported: true, is_price_comparison_enabled: true, is_trusted: true },
  ];

  const categories: Category[] = defaultCategories;

  const products: Product[] = [];
  const listings: Listing[] = [];
  const current_prices: CurrentPrice[] = [];
  const product_badges: ProductBadge[] = [];
  const badges: Badge[] = [
    { id: 1, slug: 'directorpi', name: '디렉터파이 추천' },
    { id: 2, slug: 'hwahae_rank', name: '화해 랭킹' },
    { id: 3, slug: 'oliveyoung_best', name: '올영 베스트' },
  ];

  let productIdCounter = 1;
  let listingIdCounter = 1;

  for (const uiProd of defaultUiProducts) {
    const category = categories.find((c) => c.slug === uiProd.category);
    const prodId = productIdCounter++;
    
    // Create base product
    products.push({
      id: prodId,
      slug: uiProd.slug,
      product_key: `PROD_${prodId.toString().padStart(3, '0')}`,
      name: uiProd.name,
      brand: uiProd.brand,
      category_id: category ? category.id : null,
      volume_ml: parseFloat(uiProd.volume) || 50,
      image_url: null,
      features: uiProd.features ? uiProd.features.join(', ') : null,
      skin_types: uiProd.skinTypes,
      hwahae_url: null,
      official_info_url: null,
      viewty_score: uiProd.viewtyScore,
      source: 'sheet',
      is_active: true,
    });

    // Create badges mapping
    uiProd.badges.forEach((bName) => {
      let bId = 1;
      if (bName.includes('화해')) bId = 2;
      else if (bName.includes('올영')) bId = 3;

      product_badges.push({
        product_id: prodId,
        badge_id: bId,
        detail: bName,
        source_title: uiProd.source,
        ref_url: null,
        source_date: '2026-06-11'
      });
    });

    // Create listings
    uiProd.stores.forEach((store) => {
      const seller = sellers.find((s) => s.slug === store.sellerSlug);
      if (seller) {
        listings.push({
          id: listingIdCounter++,
          link_key: `LINK_${store.sellerSlug}_${prodId}`,
          product_id: prodId,
          seller_id: seller.id,
          url: store.url,
          affiliate_url: store.url,
          store_name: store.name,
          is_official_store: store.isOfficial || false,
          is_rocket: store.isRocket || false,
          crawl_enabled: true,
          crawl_method: seller.collect_method === 'api' ? 'api' : 'playwright',
          last_crawled_at: new Date().toISOString(),
          fail_count: 0,
          is_active: true,
        });
      }
    });

    // Create current price entry
    current_prices.push({
      product_id: prodId,
      base_lowest_price: uiProd.lowestPrice,
      base_lowest_seller: uiProd.stores[0]?.name || '미정',
      base_lowest_listing_id: listings.find((l) => l.product_id === prodId)?.id || null,
      promo_lowest_unit_price: uiProd.stores[0]?.effectiveUnitPrice || uiProd.lowestPrice,
      promo_lowest_seller: uiProd.stores[0]?.name || '미정',
      promo_label: uiProd.stores[0]?.promoText || null,
      has_promotion: uiProd.stores.some((s) => !!s.promoType && s.promoType !== 'none'),
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }

  const score_config: ScoreConfig[] = [
    { key: 'directorpi', value: 25 },
    { key: 'hwahae_rank', value: 15 },
    { key: 'oliveyoung_best', value: 15 },
    { key: 'multi_source', value: 10 },
    { key: 'perml_top30', value: 15 },
    { key: 'base_below_avg10', value: 10 },
    { key: 'has_effective', value: 5 },
    { key: 'price_drop_7d', value: 5 },
    { key: 'seller_oliveyoung', value: 5 },
    { key: 'seller_coupang', value: 5 },
    { key: 'seller_naver', value: 5 },
    { key: 'sellers_3plus', value: 5 }
  ];

  return {
    categories,
    sellers,
    products,
    badges,
    product_badges,
    listings,
    retailer_allowlist: [],
    price_snapshots: [],
    current_prices,
    manual_overrides: [],
    seo_pages: [
      { id: 1, slug: 'directorpi-sunscreen', page_type: 'curation', title: '2026 디렉터파이 추천 선크림 TOP 10 최저가 비교', h1: '디렉터파이 추천 선크림 최저가 비교', description: '디렉터파이가 추천한 선크림 중 민감성 피부도 참고하기 좋은 제품을 모아 최저가 기준으로 비교했어요.', category: 'sunscreen', skin_type: null, badge_type: 'directorpi', is_active: true },
      { id: 2, slug: 'sensitive-sunscreen', page_type: 'skin', title: '민감성 피부 추천 선크림 최저가 한눈에 보기', h1: '민감성 피부 선크림 추천', description: '민감한 피부 타입을 위한 디렉터파이 합격 선크림의 판매처별 가격비교 정보입니다.', category: 'sunscreen', skin_type: '민감성', badge_type: null, is_active: true }
    ],
    score_config
  };
}

// Load current mock DB state
export function loadMockDB(): MockDBState {
  try {
    if (!fs.existsSync(path.dirname(MOCK_DB_FILE))) {
      fs.mkdirSync(path.dirname(MOCK_DB_FILE), { recursive: true });
    }
    if (fs.existsSync(MOCK_DB_FILE)) {
      const data = fs.readFileSync(MOCK_DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error loading mock database file, regenerating...', e);
  }

  const initialState = getInitialState();
  saveMockDB(initialState);
  return initialState;
}

// Save mock DB state
export function saveMockDB(state: MockDBState): void {
  try {
    if (!fs.existsSync(path.dirname(MOCK_DB_FILE))) {
      fs.mkdirSync(path.dirname(MOCK_DB_FILE), { recursive: true });
    }
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write mock database file', e);
  }
}
