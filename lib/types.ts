export type CategoryLevel = 'major' | 'minor';

export interface Category {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  // 2-tier: major (대분류) has parent_id=null; minor (소분류) points at its major.
  parent_id?: number | null;
  level?: CategoryLevel;
}

export type CollectMethod = 'api' | 'crawl';
export type CrawlMethod = 'api' | 'html' | 'playwright' | 'manual' | 'naver_sourced';

export interface Seller {
  id: number;
  slug: string; // e.g. 'oliveyoung', 'coupang', 'naver', 'zigzag', 'ably'
  name: string;
  priority: number;
  collect_method: CollectMethod;
  is_affiliate_supported: boolean;
  is_price_comparison_enabled: boolean;
  is_trusted: boolean;
}

export interface Product {
  id: number;
  slug: string;
  product_key: string;
  name: string;
  brand: string | null;
  category_id: number | null;
  // Nullable to match the DB (products.volume_ml NUMERIC, no NOT NULL): devices and
  // other volume-less products carry null. Consumers already guard (normalizePrice
  // `|| 50`/`|| 1`, naver/run `?? null`, discountVsRegular accepts null).
  volume_ml: number | null;
  // Unit of volume_ml: 'ml' | 'g' | '매'. Default 'ml' (migration 0017). Display-only;
  // the per-unit price math is unit-agnostic. Optional so the legacy mock compiles.
  volume_unit?: string | null;
  // 정가 / MSRP for the DB representative volume (volume_ml). Basis for the
  // "정가 대비 N% 할인" headline; null → no discount shown (never mis-displayed).
  regular_price?: number | null;
  // §1b: when explicitly false, volume_ml is unverified (e.g. LLM-seeded default)
  // → ml-based unit_price is disabled until an operator confirms the real volume.
  // Absent/undefined keeps the legacy behavior (treated as usable).
  volume_verified?: boolean;
  image_url: string | null;
  features: string | null;
  // 운영자가 직접 작성한 상세 원문(추천 사유 백업). features는 이 원문을 화면용으로
  // 요약·정규화한 값이며, features_detail은 표시에 쓰이지 않고 원본 보존 용도다.
  features_detail?: string | null;
  skin_types: string[]; // e.g. ['민감성', '지성', '건성', '수부지']
  hwahae_url: string | null;
  official_info_url: string | null;
  viewty_score: number;
  source: string; // 'sheet' | 'admin'
  is_active: boolean;
}

export interface Badge {
  id: number;
  slug: string;
  name: string;
}

export interface ProductBadge {
  product_id: number;
  badge_id: number;
  detail: string | null;
  source_title: string | null;
  ref_url: string | null;
  source_date: string | null; // ISO Date 'YYYY-MM-DD'
}

export interface Listing {
  id: number;
  link_key: string;
  product_id: number;
  seller_id: number;
  url: string;
  affiliate_url: string | null;
  store_name: string | null;
  is_official_store: boolean;
  is_rocket: boolean;
  crawl_enabled: boolean;
  crawl_method: CrawlMethod;
  last_crawled_at: string | null; // ISO Timestamp
  latest_matched_url?: string | null; // cached Naver API matched offer link (redirect fallback)
  latest_image_url?: string | null;   // cached crawler-sourced image (e.g. Coupang productImage) — display fallback behind products.image_url
  fail_count: number;
  is_active: boolean;
}

export interface RetailerAllowlist {
  id: number;
  seller_id: number;
  brand: string;
  allowed_store_name: string;
  is_active: boolean;
}

export type PromoType =
  | 'none'
  | 'sale'
  | 'buy_x_get_y' // e.g. 1+1, 2+1
  | 'quantity_discount'
  | 'bundle'
  | 'gift'
  | 'coupon'
  | 'membership'
  | 'app_only'
  | 'card_discount'
  | 'unknown';

export type ParseConfidence = 'high' | 'low';
export type PriceSnapshotStatus = 'ok' | 'warning' | 'failed' | 'no_offer';

export interface PriceSnapshot {
  id: number;
  listing_id: number;
  product_id: number;
  crawled_at: string; // ISO Timestamp
  regular_price: number | null;
  sale_price: number | null;
  base_unit_price: number | null; // Price for single purchase
  promo_type: PromoType;
  promo_text: string | null;
  min_quantity: number | null;
  paid_quantity: number | null;
  free_quantity: number | null;
  total_quantity: number | null;
  total_ml: number | null;
  unit_price: number | null; // ml당 가격 — null when volume unreliable (§1)
  unit_price_reliable: boolean; // false → exclude from ml-based ranking/score
  effective_unit_price: number | null; // 1+1 등 실질 개당 가격
  in_stock: boolean;
  source_text: string | null;
  parse_confidence: ParseConfidence;
  status: PriceSnapshotStatus;
  shipping_fee: number | null;
  shipping_note: string | null;
  matched_url: string | null;       // link of the matched offer (audit / change detection)
  matched_mall_name: string | null; // raw mallName of the matched offer
  image_url: string | null;         // product image from the matched offer (e.g. Coupang productImage)
}

/**
 * Row of the public.listing_prices_public view (migration 0008): the latest
 * displayable snapshot per active listing, projected to safe columns only.
 * This is the anon-readable source for the per-store price comparison; the raw
 * price_snapshots table stays locked. unit_price is NULL when the ml-based unit
 * price is unreliable (§1 compromise).
 */
export interface PublicListingPrice {
  listing_id: number;
  product_id: number;
  seller_id: number;
  sale_price: number | null;
  base_unit_price: number | null;
  effective_unit_price: number | null;
  unit_price: number | null;
  total_ml: number | null; // (listing volume) × pack qty — per-retailer size, for ml당 display/rank
  promo_type: PromoType;
  promo_text: string | null;
  in_stock: boolean;
  shipping_note: string | null;
  matched_mall_name: string | null;
  image_url: string | null; // crawler-sourced product image (display fallback)
  crawled_at: string; // ISO Timestamp
}

export interface CurrentPrice {
  product_id: number;
  base_lowest_price: number | null;
  base_lowest_seller: string | null;
  base_lowest_listing_id: number | null;
  promo_lowest_unit_price: number | null;
  promo_lowest_seller: string | null;
  promo_label: string | null;
  has_promotion: boolean;
  last_checked_at: string | null;
  updated_at: string;
}

export interface ManualOverride {
  id: number;
  product_id: number;
  seller_id: number;
  override_type: 'price' | 'promo_type' | 'promo_text' | 'unit_price' | 'in_stock';
  value: string;
  reason: string | null;
  expires_at: string | null;
  is_active: boolean;
}

export interface AffiliateClick {
  id: number;
  product_id: number | null;
  listing_id: number | null;
  seller_code: string | null;
  clicked_at: string;
  referrer: string | null;
  page_path: string | null;
  user_agent_hash: string | null;
  session_id: string | null;
}

export interface CrawlRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'completed' | 'failed';
  total_links: number;
  success_count: number;
  warning_count: number;
  failure_count: number;
  summary: Record<string, unknown> | null;
}

export interface CrawlError {
  id: number;
  crawl_run_id: number;
  product_id: number | null;
  listing_id: number | null;
  seller_code: string | null;
  error_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  raw_context: Record<string, unknown> | null;
  created_at: string;
}

export interface SheetImportRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'completed' | 'failed';
  products_count: number;
  links_count: number;
  badges_count: number;
  error_count: number;
  summary: Record<string, unknown> | null;
}

export interface SeoPage {
  id: number;
  slug: string;
  page_type: string | null;
  title: string | null;
  h1: string | null;
  description: string | null;
  category: string | null;
  skin_type: string | null;
  badge_type: string | null;
  // CSV of synonym keywords (OR-matched against product name/features/tags) — lets
  // a topic like 여드름·블랙헤드·미백 select products beyond category/skin filters.
  keywords?: string | null;
  is_active: boolean;
}

export interface ScoreConfig {
  key: string;
  value: number;
}

// ----------------------------------------------------
// UI-Specific / Page-specific unified types (C4 Strategy)
// ----------------------------------------------------

export interface UIStorePrice {
  name: string;      // e.g. '쿠팡', '올리브영'
  sellerSlug: string; // e.g. 'coupang', 'oliveyoung'
  price: number;     // base (single-buy) price; 0 when link-only (hasPrice=false)
  url: string;       // Redirection endpoint `/go/[listingId]` or affiliate URL
  isBest?: boolean;
  isRocket?: boolean;
  isOfficial?: boolean;
  promoType?: PromoType;
  promoText?: string | null;
  effectiveUnitPrice?: number | null; // per-unit (개당) price; = price for singles
  unitPrice?: number | null; // per ml price — only when reliable
  volumeMl?: number | null; // this seller's per-unit volume (size differs per retailer)
  volumeUnit?: string | null; // unit of volumeMl: 'ml' | 'g' | '매' (product-level; display label)
  discountVsRegular?: number | null; // % this store's ml당 beats 정가 ml당 (≥0; null when not computable)
  // Web-layer additions (optional so the legacy static mock still compiles;
  // mapToUIProduct always sets them. Absent hasPrice ⇒ treated as priced).
  hasPrice?: boolean;          // false → link-only seller row ("○○에서 보기", no price)
  quantity?: number | null;   // pack count N (>1 for 1+1 / N-packs); undefined for single
  composition?: string | null; // 구성 label derived from promo (e.g. '1+1', '6개', '증정')
}

export interface UIProduct {
  id: string;
  slug: string;
  brand: string;
  name: string;
  category: string;       // minor (소분류) slug
  majorCategory?: string; // parent major (대분류) slug — for major-page aggregation
  image: string;
  volume: string;
  description: string;
  skinTypes: string[];
  tags: string[];
  badges: string[];
  lowestPrice: number;       // lowest per-unit (effective) among priced stores; 0 when none
  lowestBasePrice?: number;  // lowest single-buy (1개 기준) base price; 0 when none
  bestIsMultipack?: boolean; // the per-unit-cheapest store is a multipack (headline shows 개당)
  hasAnyPrice?: boolean;     // false → every seller is link-only (no price)
  volumeMl?: number | null;            // DB representative volume amount (numeric) — for size comparison
  volumeUnit?: string | null;          // unit of volumeMl: 'ml' | 'g' | '매' (display label)
  regularPrice?: number | null;        // 정가 / MSRP (DB volume basis) — for "정가 X원" display; null when absent
  discountVsRegular?: number | null;   // headline % the best store's ml당 beats 정가 ml당 (≥0; null when not computable)
  lastUpdated?: string | null;         // freshest priced store crawled_at (ISO)
  /** @deprecated mock price-history fields — never populated/displayed (kept only for the legacy static mock). */
  previousPrice?: number;
  /** @deprecated */ priceDropAmount?: number;
  /** @deprecated */ priceDropRate?: number;
  source: 'directorpi' | 'hwahae' | 'oliveyoung';
  reasonItems: string[];
  stores: UIStorePrice[];
  viewtyScore: number;
  features?: string[];
}

export interface WaitlistEntry {
  id: number;
  email: string;
  intent: 'launch' | 'price_alert';
  wishlist_slugs: string[] | null;
  consent_service: boolean;
  consent_marketing: boolean;
  created_at?: string;
  updated_at?: string;
}

