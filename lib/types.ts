export interface Category {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
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
  volume_ml: number;
  // §1b: when explicitly false, volume_ml is unverified (e.g. LLM-seeded default)
  // → ml-based unit_price is disabled until an operator confirms the real volume.
  // Absent/undefined keeps the legacy behavior (treated as usable).
  volume_verified?: boolean;
  image_url: string | null;
  features: string | null;
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
  promo_type: PromoType;
  promo_text: string | null;
  in_stock: boolean;
  shipping_note: string | null;
  matched_mall_name: string | null;
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
  price: number;
  url: string;       // Redirection endpoint `/go/[listingId]` or affiliate URL
  isBest?: boolean;
  isRocket?: boolean;
  isOfficial?: boolean;
  promoType?: PromoType;
  promoText?: string | null;
  effectiveUnitPrice?: number | null;
  unitPrice?: number | null; // per ml price
}

export interface UIProduct {
  id: string;
  slug: string;
  brand: string;
  name: string;
  category: string;
  image: string;
  volume: string;
  description: string;
  skinTypes: string[];
  tags: string[];
  badges: string[];
  lowestPrice: number;
  previousPrice?: number;
  priceDropAmount?: number;
  priceDropRate?: number;
  source: 'directorpi' | 'hwahae' | 'oliveyoung';
  reasonItems: string[];
  stores: UIStorePrice[];
  viewtyScore: number;
  features?: string[];
}
