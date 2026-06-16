import * as crypto from 'crypto';
import { Listing, Product, PromoType } from '../../lib/types';
import { PriceOffer, RetailerAdapter } from './index';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { loadMockDB } from '../../lib/supabase/mockDb';

// ---------------------------------------------------------------------------
// Coupang Partners Open API — product price via the SEARCH endpoint.
//
// WHY search, not a direct product lookup: live validation confirmed there is
// NO `GET products/{id}` price endpoint (404). The only price source is the
// search API (keyword=product name), from which we pick the item whose
// productId equals the productId in the listing's product-detail URL — an exact
// anchor so the price+deeplink come from the same, correct product.
//
// Rate limit: the Partners search API allows 50 calls/min (per the official doc:
// "1분당 최대 50번"). MIN_CALL_INTERVAL_MS (default 2000ms ⇒ ≤30/min, a safe
// margin) is enforced between successive calls. One call per product ⇒ a full
// Coupang sync of ~40 products takes ~80s. (The earlier "10/hour → 360s"
// assumption was outdated.)
//
// HMAC signing: the signed-date MUST be `yyMMdd'T'HHmmss'Z'` (with the literal
// T and Z). The earlier adapter stripped them and got HTTP 401.
// ---------------------------------------------------------------------------

const COUPANG_API_BASE = 'https://api-gateway.coupang.com';
const SEARCH_PATH = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search';

// Minimum delay between consecutive Coupang search calls. Default 2000ms keeps
// us at ≤30 calls/min, safely under the 50/min search-API limit. Override via
// COUPANG_RATE_LIMIT_DELAY_MS.
export const MIN_CALL_INTERVAL_MS = parseInt(
  process.env.COUPANG_RATE_LIMIT_DELAY_MS ?? '2000',
  10
);

let lastCallAt = 0;

// ---------------------------------------------------------------------------
// Types mirroring the Coupang Partners SEARCH API response.
// NOTE (live-check): the search item exposes `productPrice` (NOT `price`),
// `isRocket`, `isFreeShipping`, and `productUrl` (an affiliate deeplink). The
// `price`/`basePrice`/`couponPrice` fields are kept for back-compat with older
// fixtures and the parser falls back to them.
// ---------------------------------------------------------------------------
export interface CoupangApiItem {
  productId: number;
  productName: string;
  productPrice?: number;         // search API sale price (KRW)
  price?: number;                // legacy fixture field (fallback)
  basePrice?: number;            // original/regular price (when present)
  isRocket?: boolean;
  isFreeShipping?: boolean;
  vendorItemId?: number;
  productImage?: string;
  productUrl?: string;           // affiliate deeplink (link.coupang.com/…)
  soldOut?: boolean;
  lowestPrice?: number;
  couponPrice?: number;          // coupon discounted price (excluded from comparison)
}

export interface CoupangSearchResponse {
  rCode: string;
  rMessage: string;
  data: {
    productData: CoupangApiItem[];
  };
}

// ---------------------------------------------------------------------------
// Pure parser — testable without API calls.
// ---------------------------------------------------------------------------
export function parseCoupangItem(item: CoupangApiItem): PriceOffer {
  // Search API uses `productPrice`; older fixtures use `price`.
  const salePrice = item.productPrice ?? item.price ?? null;
  const regularPrice = item.basePrice ?? null;

  let promoType: PromoType = 'none';
  let promoText: string | null = null;

  // Rocket delivery is a label; free shipping is the next-best shipping note.
  const shippingNote = item.isRocket ? '로켓배송' : item.isFreeShipping ? '무료배송' : null;

  // Coupon price is conditional → excluded from base/effective price, label only.
  if (item.couponPrice !== undefined && item.couponPrice !== null) {
    promoType = 'coupon';
    promoText = `쿠폰가 ${item.couponPrice.toLocaleString('ko-KR')}원`;
  }

  return {
    regularPrice,
    salePrice,
    inStock: !(item.soldOut ?? false) && salePrice !== null,
    promoType,
    promoText,
    sourceText: item.productName ?? null,
    storeName: item.isRocket ? '쿠팡 로켓배송' : '쿠팡',
    parsedVolumeRaw: extractVolumeFromTitle(item.productName),
    shippingNote,
    // The search item's productUrl is already an affiliate deeplink — cache it as
    // the matched offer link (redirect fallback / monetization). No separate
    // deeplink API call is needed.
    matchedUrl: item.productUrl ?? null,
    matchedMallName: item.isRocket ? '쿠팡 로켓배송' : '쿠팡',
    // productImage (ads-partners.coupang.com) — Partners-provided asset members may
    // display; cached as a display fallback behind the operator's products.image_url.
    imageUrl: item.productImage ?? null,
  };
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 signing for Coupang Partners Open API.
// message = signed-date + METHOD + path + queryString (no leading '?').
// signed-date format: yyMMdd'T'HHmmss'Z' (literal T and Z).
// ---------------------------------------------------------------------------
function coupangDatetime(): string {
  const iso = new Date().toISOString(); // 2026-06-15T01:02:03.456Z
  return (
    iso.substring(2, 4) + iso.substring(5, 7) + iso.substring(8, 10) +
    'T' + iso.substring(11, 13) + iso.substring(14, 16) + iso.substring(17, 19) + 'Z'
  );
}

function buildAuthHeader(
  method: string,
  path: string,
  queryString: string,
  accessKey: string,
  secretKey: string
): string {
  const datetime = coupangDatetime();
  const message = datetime + method.toUpperCase() + path + queryString;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

// ---------------------------------------------------------------------------
// URL helpers.
// ---------------------------------------------------------------------------
/** Extract the productId from a Coupang product-detail URL. */
export function extractCoupangProductId(url: string): string | null {
  const productMatch = url.match(/\/(?:vp\/)?products\/(\d+)/);
  if (productMatch) return productMatch[1];
  return null;
}

/**
 * A `link.coupang.com/a/…` share short-link carries no productId. It is a data
 * problem (operator must put the product-detail URL in the sheet), NOT a fetch
 * failure — see fetchOffer's data_error path.
 */
export function isCoupangShortLink(url: string): boolean {
  return /(^|\/\/)link\.coupang\.com\//i.test(url) || /coupang\.com\/a\//i.test(url);
}

/** Build the search keyword (brand + name, volume stripped). */
export function buildSearchKeyword(brand: string | null, name: string): string {
  const cleanBrand = brand ? brand.replace(/\s*\([^)]*\)/g, '').trim() : '';
  const cleanName = (name || '').replace(/\s*\d+(?:\.\d+)?\s*ml/gi, '').trim();
  return `${cleanBrand} ${cleanName}`.trim();
}

// ---------------------------------------------------------------------------
// Search API call with rate limiting. Throws on HTTP/timeout → run.ts 'failed'.
// ---------------------------------------------------------------------------
async function searchCoupang(
  keyword: string,
  accessKey: string,
  secretKey: string
): Promise<CoupangApiItem[]> {
  // Enforce the search-API rate limit (50/min) with a safe margin between calls.
  const now = Date.now();
  const elapsed = now - lastCallAt;
  if (elapsed < MIN_CALL_INTERVAL_MS && lastCallAt !== 0) {
    const wait = MIN_CALL_INTERVAL_MS - elapsed;
    console.log(`[Coupang Adapter] Rate limit — waiting ${Math.round(wait / 1000)}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
  lastCallAt = Date.now();

  // limit max is 10 per the API doc ("최대 상품 수는 10개"); a larger value makes
  // the API return an empty productData, which would look like a (false) no_offer.
  const queryString = `keyword=${encodeURIComponent(keyword)}&limit=10`;
  const auth = buildAuthHeader('GET', SEARCH_PATH, queryString, accessKey, secretKey);

  const res = await fetch(`${COUPANG_API_BASE}${SEARCH_PATH}?${queryString}`, {
    method: 'GET',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json;charset=UTF-8',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Coupang search API → HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  const json = await res.json();
  return (json?.data?.productData ?? []) as CoupangApiItem[];
}

// ---------------------------------------------------------------------------
// Helper.
// ---------------------------------------------------------------------------
function extractVolumeFromTitle(title: string | null | undefined): number | null {
  if (!title) return null;
  const mlMatch = title.match(/(\d+(?:\.\d+)?)\s*ml/i);
  if (mlMatch) return parseFloat(mlMatch[1]);
  const lMatch = title.match(/(\d+(?:\.\d+)?)\s*L(?!\w)/i);
  if (lMatch) return parseFloat(lMatch[1]) * 1000;
  return null;
}

function isPlaceholderKey(v: string | undefined): boolean {
  return (
    !v ||
    v.includes('placeholder') ||
    v.includes('dummy') ||
    v.includes('example') ||
    v.trim() === ''
  );
}

// ---------------------------------------------------------------------------
// Adapter.
// ---------------------------------------------------------------------------
export class CoupangAdapter implements RetailerAdapter {
  code = 'coupang';

  async fetchOffer(listing: Listing): Promise<PriceOffer> {
    const accessKey = process.env.COUPANG_ACCESS_KEY ?? '';
    const secretKey = process.env.COUPANG_SECRET_KEY ?? '';

    const isMock =
      process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
      process.env.CRAWLER_MODE === 'mock' ||
      process.env.NODE_ENV === 'test' ||
      isPlaceholderKey(accessKey) ||
      isPlaceholderKey(secretKey);

    if (isMock) {
      console.log(`[Coupang Adapter] Mock mode — returning fixture for listing ${listing.id}`);
      return this._mockOffer(listing);
    }

    // §1.1 data gate: a short-link / non-product URL yields no productId. This is
    // a SHEET data problem, not a fetch failure — do NOT call the API, do NOT
    // increment fail_count, keep the listing active (link-only). Surface it as an
    // operator-facing data_error so the sheet URL gets fixed.
    const productId = extractCoupangProductId(listing.url);
    if (!productId) {
      const why = isCoupangShortLink(listing.url)
        ? '공유 short-link (productId 없음) — 시트에 제품 상세 URL(/vp/products/{id}) 필요'
        : '제품 상세 URL 아님 (productId 추출 불가) — 시트 URL 확인 필요';
      console.warn(`[Coupang Adapter] Data error for listing ${listing.link_key}: ${why} (${listing.url})`);
      return {
        regularPrice: null,
        salePrice: null,
        inStock: false,
        promoType: 'none',
        promoText: null,
        sourceText: `Coupang 제품 URL 필요: ${why}`,
        storeName: '쿠팡',
        matchExcluded: true,
        outcome: 'data_error',
      };
    }

    // Load the product to build the search keyword (brand + name).
    const product = await this._loadProduct(listing.product_id);
    if (!product) throw new Error(`Product not found for ID: ${listing.product_id}`);

    const keyword = buildSearchKeyword(product.brand, product.name);
    console.log(`[Coupang Adapter] Searching "${keyword}" → anchor productId ${productId}`);

    // HTTP error / timeout throws here → run.ts classifies 'failed' (§4.4 staircase).
    const productData = await searchCoupang(keyword, accessKey, secretKey);

    // Exact anchor: pick the item whose productId equals the URL's productId.
    const match = productData.find((pd) => String(pd.productId) === productId) ?? null;

    if (!match) {
      // Search SUCCEEDED but the anchored product is not among results → legitimate
      // no-match (delisted / not surfaced for this keyword). Reset fail_count,
      // keep link-only. (PR #14 no_offer semantics.)
      console.warn(
        `[Coupang Adapter] productId ${productId} not in ${productData.length} search results — link-only (no_offer)`
      );
      return {
        regularPrice: null,
        salePrice: null,
        inStock: false,
        promoType: 'none',
        promoText: null,
        sourceText: `Coupang: productId ${productId} not in search results for "${keyword}"`,
        storeName: '쿠팡',
        matchExcluded: true,
        outcome: 'no_offer',
      };
    }

    return { ...parseCoupangItem(match), outcome: 'ok' };
  }

  private async _loadProduct(productId: number): Promise<Product | null> {
    if (isSupabaseServerConfigured()) {
      const { data } = await supabaseServer.from('products').select('*').eq('id', productId).single();
      return (data as Product) ?? null;
    }
    const db = loadMockDB();
    return db.products.find((p) => p.id === productId) ?? null;
  }

  private _mockOffer(listing: Listing): PriceOffer {
    const priceMap: Record<number, number> = {
      1: 19800,
      2: 16900,
      3: 16500,
      4: 29500,
      5: 11900,
      6: 15300,
      7: 17900,
    };
    const basePrice = priceMap[listing.product_id] ?? 15000;
    return {
      regularPrice: Math.round(basePrice * 1.2),
      salePrice: basePrice,
      inStock: true,
      promoType: 'none',
      promoText: null,
      sourceText: `Mock Coupang response for product ${listing.product_id}`,
      storeName: '쿠팡 로켓배송',
      parsedVolumeRaw: null,
      shippingNote: '로켓배송',
      outcome: 'ok',
    };
  }
}
