import * as crypto from 'crypto';
import { Listing, PromoType } from '../../lib/types';
import { PriceOffer, RetailerAdapter } from './index';

// ---------------------------------------------------------------------------
// Coupang Partners API — single-product lookup
// Rate limit: search API 10 calls/hour → enforce MIN_CALL_INTERVAL_MS between
// successive calls to stay within limits for 50–100 products/day.
// ---------------------------------------------------------------------------

const COUPANG_API_BASE = 'https://api-gateway.coupang.com';

// Minimum delay between consecutive Coupang API calls (6 min = 10 calls/hour).
// Can be overridden in env for testing.
export const MIN_CALL_INTERVAL_MS = parseInt(
  process.env.COUPANG_RATE_LIMIT_DELAY_MS ?? '360000',
  10
);

let lastCallAt = 0;

// ---------------------------------------------------------------------------
// Types mirroring Coupang Partners API responses
// ---------------------------------------------------------------------------
export interface CoupangApiItem {
  productId: number;
  productName: string;
  price: number;                 // current sale price (KRW)
  basePrice?: number;            // original/regular price
  isRocket: boolean;
  vendorItemId?: number;
  productImage?: string;
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
// Pure parser — testable without API calls
// ---------------------------------------------------------------------------
export function parseCoupangItem(item: CoupangApiItem): PriceOffer {
  const salePrice = item.price ?? null;
  const regularPrice = item.basePrice ?? null;

  let promoType: PromoType = 'none';
  let promoText: string | null = null;

  // Rocket delivery is a label, not a price discount
  const shippingNote = item.isRocket ? '로켓배송' : null;

  // Coupon price is conditional → excluded from base/effective price, label only
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
  };
}

// ---------------------------------------------------------------------------
// HMAC-SHA256 signing for Coupang Partners Open API
// Signing spec: https://developers.coupang.com/hc/ko/articles/4403248547-Signature
// message = datetime(yyMMddHHmmss) + method.toUpperCase() + path + queryString
// ---------------------------------------------------------------------------
function buildAuthHeader(
  method: string,
  path: string,
  queryString: string,
  accessKey: string,
  secretKey: string
): string {
  const datetime = new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(2, 14); // "yyMMddHHmmss"

  const message = datetime + method.toUpperCase() + path + queryString;
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(message)
    .digest('hex');

  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

// ---------------------------------------------------------------------------
// URL parser — extract productId from Coupang product URLs
// Supports: /vp/products/123456  and  /np/search?q=...&itemId=...
// ---------------------------------------------------------------------------
export function extractCoupangProductId(url: string): string | null {
  const productMatch = url.match(/\/(?:vp\/)?products\/(\d+)/);
  if (productMatch) return productMatch[1];
  return null;
}

// ---------------------------------------------------------------------------
// API call with rate limiting
// ---------------------------------------------------------------------------
async function callCoupangApi(
  productId: string,
  accessKey: string,
  secretKey: string
): Promise<CoupangApiItem | null> {
  // Enforce rate limit
  const now = Date.now();
  const elapsed = now - lastCallAt;
  if (elapsed < MIN_CALL_INTERVAL_MS && lastCallAt !== 0) {
    const wait = MIN_CALL_INTERVAL_MS - elapsed;
    console.log(`[Coupang Adapter] Rate limit — waiting ${Math.round(wait / 1000)}s`);
    await new Promise((r) => setTimeout(r, wait));
  }
  lastCallAt = Date.now();

  const path = `/v2/providers/affiliate_open_api/apis/openapi/v1/products/${productId}`;
  const queryString = '';
  const auth = buildAuthHeader('GET', path, queryString, accessKey, secretKey);

  const res = await fetch(`${COUPANG_API_BASE}${path}`, {
    method: 'GET',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json;charset=UTF-8',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Coupang API ${path} → HTTP ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();

  // Try both direct product response and wrapped response shapes
  if (json?.data?.productData?.[0]) {
    return json.data.productData[0] as CoupangApiItem;
  }
  if (json?.data && typeof json.data.price === 'number') {
    return json.data as CoupangApiItem;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function extractVolumeFromTitle(title: string | null | undefined): number | null {
  if (!title) return null;
  const mlMatch = title.match(/(\d+(?:\.\d+)?)\s*ml/i);
  if (mlMatch) return parseFloat(mlMatch[1]);
  const lMatch = title.match(/(\d+(?:\.\d+)?)\s*L(?!\w)/i);
  if (lMatch) return parseFloat(lMatch[1]) * 1000;
  return null;
}

// ---------------------------------------------------------------------------
// Adapter
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
      !accessKey ||
      accessKey.includes('placeholder') ||
      accessKey.includes('dummy') ||
      accessKey.trim() === '' ||
      !secretKey ||
      secretKey.includes('placeholder') ||
      secretKey.includes('dummy') ||
      secretKey.trim() === '';

    if (isMock) {
      console.log(`[Coupang Adapter] Mock mode — returning fixture for listing ${listing.id}`);
      return this._mockOffer(listing);
    }

    const productId = extractCoupangProductId(listing.url);
    if (!productId) {
      throw new Error(`[Coupang Adapter] Cannot extract product ID from URL: ${listing.url}`);
    }

    console.log(`[Coupang Adapter] Fetching product ${productId} from Partners API`);

    const item = await callCoupangApi(productId, accessKey, secretKey);
    if (!item) {
      // API responded (200) but the product is no longer offered → legitimate
      // no-offer, NOT a fetch failure. (HTTP/timeout errors throw in callCoupangApi
      // → 'failed'.) Leave the listing link-only without incrementing fail_count.
      console.warn(`[Coupang Adapter] No product data for ID ${productId} — link-only (no_offer)`);
      return {
        regularPrice: null,
        salePrice: null,
        inStock: false,
        promoType: 'none',
        promoText: null,
        sourceText: `Coupang: no product data for ID ${productId} (delisted / out of catalog)`,
        storeName: '쿠팡',
        matchExcluded: true,
        outcome: 'no_offer',
      };
    }

    return { ...parseCoupangItem(item), outcome: 'ok' };
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
    };
  }
}
