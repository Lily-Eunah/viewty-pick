import * as crypto from 'crypto';
import { Listing, Product, PromoType } from '../../lib/types';
import { PriceOffer, RetailerAdapter } from './index';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { productRowCompat } from '../../lib/supabase/columnCompat';
import { loadMockDB } from '../../lib/supabase/mockDb';
import { productIdentityScore, hasFormConflict, distinctiveTokens, stripHtml } from './naver';
import { stripPromoGifts } from '../core/packageExtractor';

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
 * Extract the vendorItemId from a Coupang product-detail URL's query string.
 * A single productId can have MULTIPLE vendors (sellers); vendorItemId uniquely
 * identifies the operator-curated vendor option. Without this, pickCoupangMatch
 * may return a different vendor's price/image/deeplink for the same product.
 * Returns null when absent.
 */
export function extractCoupangVendorItemId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/[?&]vendorItemId=(\d+)/i);
  return m ? m[1] : null;
}

/**
 * Extract the operator's search query (`q=`) from a Coupang URL. The product-page
 * URL an operator pastes usually carries the real search term they used to FIND the
 * product (e.g. `?q=몽디에스 선크림`), which is often a better image-search keyword than
 * the brand+name we derive (e.g. "몽디에스 엑설런트 선크림") — the Partners search API
 * surfaces that productId for the operator's query but not for our derived one.
 * Query-string `+` means space; `%2B` means a literal plus, so decode after the swap.
 * Returns null when absent, empty, or malformed.
 */
export function extractCoupangQuery(url: string): string | null {
  if (!url) return null;
  const m = url.match(/[?&]q=([^&#]*)/i);
  if (!m) return null;
  try {
    const decoded = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

/**
 * A `link.coupang.com/a/…` share short-link carries no productId. It is a data
 * problem (operator must put the product-detail URL in the sheet), NOT a fetch
 * failure — see fetchOffer's data_error path.
 */
export function isCoupangShortLink(url: string): boolean {
  return /(^|\/\/)link\.coupang\.com\//i.test(url) || /coupang\.com\/a\//i.test(url);
}

/**
 * Distinguish a value that is ALREADY a usable image from a Coupang product-page
 * URL that must be resolved. A direct image URL (an .jpg/.png/… asset, or the
 * Coupang Partners productImage host `ads-partners.coupang.com`) is rendered as-is.
 */
export function looksLikeImageUrl(url: string): boolean {
  if (!url) return false;
  if (/\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(url)) return true;
  // Partners productImage assets live on this host (an image CDN, not a product page).
  if (/(^|\/\/)ads-partners\.coupang\.com\//i.test(url)) return true;
  return false;
}

/**
 * True when an operator-supplied products.image_url is a Coupang PRODUCT-PAGE URL
 * (coupang.com/.../products/{id}) rather than an actual image. Such a value is an
 * image SOURCE — it carries a productId we resolve to the product's productImage
 * via the search API. The page URL itself is NOT an image and would render broken
 * if stored verbatim, so it must never reach an <img>. A direct image URL (incl.
 * the ads-partners image host) is excluded — it is used as-is.
 */
export function isCoupangProductPageUrl(url: string): boolean {
  if (!url) return false;
  if (looksLikeImageUrl(url)) return false;
  return /(^|\/\/|\.)coupang\.com\//i.test(url) && extractCoupangProductId(url) !== null;
}

// Image-fallback identity threshold — the same 0.6 HIGH band as Naver/OY auto-price
// (OY_AUTO_PRICE_SIMILARITY). The Partners API is search-only (no productId/URL
// lookup), so an anchor miss is structural; the fallback must be gated so a
// DIFFERENT product's photo can never slip in.
const IMAGE_IDENTITY_SIMILARITY = 0.6;

/**
 * Normalized brand match tokens: the main brand plus any parenthetical alias, each
 * lower-cased and space-stripped. "아이소이(isoi)" → ["isoi", "아이소이"]; "대라(DAERA)"
 * → ["daera", "대라"]. Either form is accepted so a Korean/English alias still matches.
 */
function brandMatchTokens(brand: string | null | undefined): string[] {
  if (!brand) return [];
  const lower = brand.toLowerCase();
  const tokens: string[] = [];
  // Parenthetical alias(es) first: "아이소이(isoi)" → "isoi".
  for (const m of lower.matchAll(/\(([^)]*)\)/g)) {
    const alias = m[1].replace(/\s+/g, '');
    if (alias) tokens.push(alias);
  }
  const main = lower.replace(/\([^)]*\)/g, '').replace(/\s+/g, '');
  if (main) tokens.push(main);
  return tokens;
}

/**
 * Brand-presence gate for an image candidate. The title MUST contain the product's
 * brand (substring on a normalized, space-stripped form — the same tolerance as the
 * official-mall brand check). A DIFFERENT brand's same-category listing (e.g. 대라/
 * DAERA cushion for an 아이소이 cushion) is rejected even when generic tokens
 * (스킨케어·쿠션) overlap. An empty brand cannot pass — the safe side is to leave the
 * image unresolved (→ placeholder) rather than adopt a possibly-wrong photo.
 */
function brandMatchesTitle(title: string, brand: string | null | undefined): boolean {
  const tokens = brandMatchTokens(brand);
  if (tokens.length === 0) return false;
  const nt = stripHtml(title || '').toLowerCase().replace(/\s+/g, '');
  return tokens.some((b) => nt.includes(b));
}

/**
 * Strict product-identity gate for an image fallback. Reuses the SAME pure gates as
 * price matching for IDENTITY (title-token similarity ≥ 0.6, a distinctive core token
 * present, no form conflict) AND additionally requires the candidate to carry the
 * product's BRAND. Two deliberate differences vs price matching:
 *   - VOLUME is not checked — the same product's other sizes show the same photo.
 *   - COMPOSITION (set/bundle/refill, e.g. 본품+리필 / 기획세트) is NOT rejected — those
 *     are the SAME product's photo, so they are valid image sources. hasFormConflict
 *     still rejects a different FORM (e.g. 토너 ↔ 패드), which IS a different photo.
 * A non-passing (= different brand / different product) candidate is rejected.
 */
function passesImageIdentity(title: string, name: string, brand: string | null | undefined): boolean {
  const t = stripPromoGifts(stripHtml(title || ''));
  if (!brandMatchesTitle(t, brand)) return false; // brand must match — reject other brands
  if (productIdentityScore(t, name) < IMAGE_IDENTITY_SIMILARITY) return false;
  if (hasFormConflict(name, t)) return false;
  const distinct = distinctiveTokens(name);
  const tn = t.toLowerCase().replace(/\s+/g, '');
  if (distinct.length > 0 && !distinct.some((d) => tn.includes(d))) return false;
  return true;
}

/**
 * Resolve the productImage for an anchored Coupang productId from search results.
 *   1. anchored  — the exact-productId row's image (via pickCoupangMatch).
 *   2. strict-identity fallback — when the anchor is missing from search (structural,
 *      Partners being search-only), the TOP result whose productName passes
 *      passesImageIdentity (= verifiably the same product, e.g. another seller's
 *      listing of it). Identity is lenient on volume but NEVER on product identity.
 *   3. otherwise null → caller stores '' → placeholder. A DIFFERENT product's image
 *      (the earlier blind top-hit bug) is never used.
 * `productName`/`brand` are the operator-curated identity used for the fallback gate;
 * the candidate must match BOTH the brand and the product identity.
 */
export function pickCoupangImage(
  items: CoupangApiItem[],
  anchorProductId: string,
  productName: string,
  brand: string | null | undefined,
  anchorVendorItemId?: string | null
): string | null {
  const anchored = pickCoupangMatch(items, anchorProductId, anchorVendorItemId);
  if (anchored?.productImage) return anchored.productImage;
  // Results arrive in relevance order — first identity-passing one with an image wins.
  const sameProduct = items.find(
    (it) => it.productImage && passesImageIdentity(it.productName, productName, brand)
  );
  return sameProduct?.productImage ?? null;
}

/**
 * Resolve the vendorItemId from either root level or productUrl query parameter.
 * Coupang Partners Search API response items lack vendorItemId at root, but
 * contain it inside productUrl query string parameters.
 */
export function resolveVendorItemId(item: CoupangApiItem): number | null {
  if (item.vendorItemId !== undefined && item.vendorItemId !== null) {
    return item.vendorItemId;
  }
  if (item.productUrl) {
    const extracted = extractCoupangVendorItemId(item.productUrl);
    if (extracted) return parseInt(extracted, 10);
  }
  return null;
}

/**
 * Pick the offer for an anchored Coupang listing. Matching priority:
 *   1. productId + vendorItemId — exact operator-curated vendor (when provided).
 *      A single productId can have MULTIPLE vendors/sellers, each with a distinct
 *      vendorItemId. Without vendorItemId anchoring, the adapter picks the cheapest
 *      vendor — which may be a completely different seller with different pricing,
 *      image, and affiliate deeplink than the one the operator curated.
 *   2. productId only (vendorItemId absent or not in results) — fall back to the
 *      LOWEST productPrice among all vendors sharing the productId (the base single
 *      unit, not a bulk option).
 */
export function pickCoupangMatch(
  items: CoupangApiItem[],
  productId: string,
  vendorItemId?: string | null
): CoupangApiItem | null {
  const productMatches = items.filter((pd) => String(pd.productId) === productId);
  if (productMatches.length === 0) return null;

  // Priority 1: exact vendor match (operator's curated seller).
  if (vendorItemId) {
    const vendorMatch = productMatches.find((pd) => {
      const resolved = resolveVendorItemId(pd);
      return resolved !== null && String(resolved) === vendorItemId;
    });
    if (vendorMatch) return vendorMatch;
    // vendorItemId not in search results — do NOT fall back to other vendors
    // if a specific vendor was requested. Return null to treat as no_offer.
    return null;
  }

  // Priority 2: lowest price among all vendors of the same product (when no vendorItemId requested).
  const priceOf = (pd: CoupangApiItem) => pd.productPrice ?? pd.price ?? Number.POSITIVE_INFINITY;
  return productMatches.reduce((lo, pd) => (priceOf(pd) < priceOf(lo) ? pd : lo));
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

/**
 * Resolve a Coupang product-page URL placed in products.image_url to a displayable
 * productImage via the Partners SEARCH API (the page URL itself is not an image).
 * Reuses the same rate-limited, HMAC-signed search path as price fetching, then
 * pickCoupangImage (anchored productId → strict-identity fallback).
 *
 * Keyword choice: the operator's own `q=` search term (from the pasted URL) is tried
 * FIRST — the Partners search API often surfaces the anchored productId for the query
 * the operator actually used, but not for our derived brand+name (the result set is a
 * small 4–10 ad slice). If `q=` is absent or does not resolve, fall back to
 * buildSearchKeyword(brand,name) and re-match over the COMBINED result set. At most
 * two searches; the second is skipped when the first already resolves.
 *
 * Returns null when unresolved — search miss, no same-product image, no productId, a
 * thrown HTTP/timeout, or mock/test mode — so the caller stores an EMPTY image and
 * the UI falls back to the placeholder, NEVER the broken product-page URL. Same
 * search-visibility limitation as price matching: a product absent from the search
 * top-10 cannot be resolved (a structural Partners API limit).
 */
export async function resolveCoupangImageFromUrl(
  productUrl: string,
  brand: string | null,
  name: string
): Promise<string | null> {
  const productId = extractCoupangProductId(productUrl);
  if (!productId) return null;

  const accessKey = process.env.COUPANG_ACCESS_KEY ?? '';
  const secretKey = process.env.COUPANG_SECRET_KEY ?? '';
  const isMock =
    process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
    process.env.CRAWLER_MODE === 'mock' ||
    process.env.NODE_ENV === 'test' ||
    isPlaceholderKey(accessKey) ||
    isPlaceholderKey(secretKey);
  // No network in mock/test: leave the image unresolved → placeholder fallback.
  if (isMock) return null;

  // Try the operator's q= query first, then brand+name. De-dupe so we never spend a
  // call on an identical keyword (keeps it to ≤2 searches and honors the rate limit).
  const vendorItemId = extractCoupangVendorItemId(productUrl);
  const query = extractCoupangQuery(productUrl);
  const fallback = buildSearchKeyword(brand, name);
  const keywords = [query, fallback].filter(
    (kw, i, arr): kw is string => !!kw && arr.indexOf(kw) === i
  );

  const items: CoupangApiItem[] = [];
  try {
    for (const keyword of keywords) {
      // Accumulate results across keywords so the anchor/identity match can be found
      // in either search's hits.
      items.push(...(await searchCoupang(keyword, accessKey, secretKey)));
      const image = pickCoupangImage(items, productId, name, brand, vendorItemId);
      if (image) {
        console.log(`[Coupang Image] "${keyword}" (productId ${productId}, vendorItemId ${vendorItemId ?? 'none'}) → ${image}`);
        return image;
      }
    }
    console.log(
      `[Coupang Image] [${keywords.join(' | ')}] (productId ${productId}) → unresolved (no image in search)`
    );
    return null;
  } catch (e: unknown) {
    console.warn(`[Coupang Image] resolve failed for ${productUrl}: ${(e as Error).message}`);
    return null;
  }
}

/**
 * Resolve a Coupang productImage by keyword search, with optional anchorProductId for exact matching.
 * Used for automated background image gathering when no explicit override URL is provided.
 */
export async function resolveCoupangImageAuto(
  brand: string | null,
  name: string,
  anchorProductId?: string | null,
  overrideKeyword?: string | null
): Promise<string | null> {
  const accessKey = process.env.COUPANG_ACCESS_KEY ?? '';
  const secretKey = process.env.COUPANG_SECRET_KEY ?? '';
  const isMock =
    process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
    process.env.CRAWLER_MODE === 'mock' ||
    process.env.NODE_ENV === 'test' ||
    isPlaceholderKey(accessKey) ||
    isPlaceholderKey(secretKey);

  if (isMock) return null;

  const fallback = buildSearchKeyword(brand, name);
  const keywords = [overrideKeyword, fallback].filter(
    (kw, i, arr): kw is string => !!kw && arr.indexOf(kw) === i
  );

  const items: CoupangApiItem[] = [];
  try {
    for (const keyword of keywords) {
      items.push(...(await searchCoupang(keyword, accessKey, secretKey)));
      // No vendorItemId in auto-resolve (no operator URL); anchor on productId only.
      const image = pickCoupangImage(items, anchorProductId ?? '', name, brand, null);
      if (image) {
        console.log(`[Coupang Image Auto] "${keyword}" (productId ${anchorProductId ?? 'none'}) → ${image}`);
        return image;
      }
    }
    console.log(
      `[Coupang Image Auto] [${keywords.join(' | ')}] (productId ${anchorProductId ?? 'none'}) → unresolved (no image in search)`
    );
    return null;
  } catch (e: unknown) {
    console.warn(`[Coupang Image Auto] resolve failed for brand=${brand} name=${name}: ${(e as Error).message}`);
    return null;
  }
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

    // Extract vendorItemId for exact seller anchoring. A single productId can list
    // multiple vendors; without vendorItemId the adapter may return a different
    // vendor's price/image/deeplink.
    const vendorItemId = extractCoupangVendorItemId(listing.url);

    // Load the product to build the search keyword (brand + name).
    const product = await this._loadProduct(listing.product_id);
    if (!product) throw new Error(`Product not found for ID: ${listing.product_id}`);

    // Try the operator's q= query first, then brand+name. De-dupe so we never spend a
    // call on an identical keyword (keeps it to ≤2 searches and honors the rate limit).
    const query = extractCoupangQuery(listing.url);
    const fallback = buildSearchKeyword(product.brand, product.name);
    const keywords = [query, fallback].filter(
      (kw, i, arr): kw is string => !!kw && arr.indexOf(kw) === i
    );

    let match: CoupangApiItem | null = null;
    const productData: CoupangApiItem[] = [];
    let matchedKeyword = '';

    for (const keyword of keywords) {
      console.log(`[Coupang Adapter] Searching "${keyword}" → anchor productId ${productId}, vendorItemId ${vendorItemId ?? 'none'}`);
      try {
        const hits = await searchCoupang(keyword, accessKey, secretKey);
        productData.push(...hits);
        match = pickCoupangMatch(productData, productId, vendorItemId);
        if (match) {
          matchedKeyword = keyword;
          break; // Found the exact vendor, skip the fallback search
        }
      } catch (e: unknown) {
        console.warn(`[Coupang Adapter] Search failed for "${keyword}": ${(e as Error).message}`);
        // If this is the last keyword, throw; otherwise continue to fallback keyword
        if (keyword === keywords[keywords.length - 1]) {
          throw e;
        }
      }
    }

    if (!match) {
      // Search SUCCEEDED but the anchored product is not among results → legitimate
      // no-match (delisted / not surfaced for this keyword). Reset fail_count,
      // keep link-only. (PR #14 no_offer semantics.)
      console.warn(
        `[Coupang Adapter] productId ${productId} (vendorItemId ${vendorItemId ?? 'none'}) not in ${productData.length} search results for keywords [${keywords.join(', ')}] — link-only (no_offer)`
      );
      return {
        regularPrice: null,
        salePrice: null,
        inStock: false,
        promoType: 'none',
        promoText: null,
        sourceText: `Coupang: productId ${productId} not in search results for keywords [${keywords.join(', ')}]`,
        storeName: '쿠팡',
        matchExcluded: true,
        outcome: 'no_offer',
      };
    }

    // Exact productId (+ vendorItemId when available) match = anchored to the
    // operator-curated SKU → run.ts shows it directly and never downgrades to
    // inspection on LLM parse uncertainty.
    return { ...parseCoupangItem(match), anchored: true, outcome: 'ok' };
  }

  private async _loadProduct(productId: number): Promise<Product | null> {
    if (isSupabaseServerConfigured()) {
      const { data } = await supabaseServer.from('products').select('*').eq('id', productId).single();
      return data ? (productRowCompat(data) as Product) : null; // PR-5 전환기 호환
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
