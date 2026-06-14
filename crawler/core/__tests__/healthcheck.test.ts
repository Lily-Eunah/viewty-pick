/**
 * Healthcheck unit tests — anomaly gate coverage:
 *  가격 < 1,000원 / 1+1가 > 기본가 / ±50% 변동 / volume_mismatch /
 *  parse_confidence=low / allowlist 불일치 / 정상 케이스
 */
import { runHealthCheck } from '../healthcheck';
import { Product, Listing, RetailerAllowlist, PriceSnapshot } from '../../../lib/types';
import { PriceOffer } from '../../adapters';
import { NormalizedPrice } from '../normalize';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const PRODUCT: Product = {
  id: 1, slug: 'test', product_key: 'T1', name: '테스트', brand: '테스트브랜드',
  category_id: null, volume_ml: 50, image_url: null, features: null,
  skin_types: [], hwahae_url: null, official_info_url: null,
  viewty_score: 0, source: 'sheet', is_active: true,
};

const LISTING: Listing = {
  id: 10, link_key: 'coupang-001', product_id: 1, seller_id: 2,
  url: 'https://www.coupang.com/vp/products/123',
  affiliate_url: null, store_name: '쿠팡', is_official_store: false,
  is_rocket: true, crawl_enabled: true, crawl_method: 'api',
  last_crawled_at: null, fail_count: 0, is_active: true,
};

const NAVER_LISTING: Listing = { ...LISTING, id: 11, seller_id: 3, url: 'https://smartstore.naver.com/brand/products/123' };

function norm(overrides: Partial<NormalizedPrice> = {}): NormalizedPrice {
  return {
    regular_price: 20000,
    sale_price: 18000,
    base_unit_price: 18000,
    effective_unit_price: 18000,
    unit_price: 360,
    promo_type: 'none',
    promo_text: null,
    min_quantity: 1,
    paid_quantity: 1,
    free_quantity: 0,
    total_quantity: 1,
    total_ml: 50,
    in_stock: true,
    parse_confidence: 'high',
    volume_mismatch: false,
    volume_mismatch_detail: null,
    shipping_note: null,
    ...overrides,
  };
}

function baseOffer(overrides: Partial<PriceOffer> = {}): PriceOffer {
  return {
    regularPrice: 20000, salePrice: 18000, inStock: true,
    promoType: 'none', promoText: null, sourceText: 'test product 50ml',
    storeName: '쿠팡', ...overrides,
  };
}

const PREV_SNAPSHOT: PriceSnapshot = {
  id: 1, listing_id: 10, product_id: 1, crawled_at: new Date().toISOString(),
  regular_price: 20000, sale_price: 18000, base_unit_price: 18000,
  promo_type: 'none', promo_text: null, min_quantity: 1, paid_quantity: 1,
  free_quantity: 0, total_quantity: 1, total_ml: 50, unit_price: 360,
  effective_unit_price: 18000, in_stock: true, source_text: null,
  parse_confidence: 'high', status: 'ok',
  shipping_fee: null, shipping_note: null,
};

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
let failed = false;

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    failed = true;
    console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected)
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toContain(substr: string) {
      if (typeof actual !== 'string' || !actual.includes(substr))
        throw new Error(`Expected "${actual}" to contain "${substr}"`);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
console.log('\n--- Price < 1,000원 ---');
it('price=500원 → status=failed, severity=critical', () => {
  const result = runHealthCheck(
    PRODUCT, LISTING, baseOffer({ salePrice: 500 }),
    norm({ sale_price: 500 }), null, []
  );
  expect(result.status).toBe('failed');
  expect(result.severity).toBe('critical');
});

console.log('\n--- 1+1가 > 기본가 ---');
it('effective_unit_price > base_unit_price → status=failed', () => {
  const result = runHealthCheck(
    PRODUCT, LISTING, baseOffer(),
    norm({ effective_unit_price: 25000, base_unit_price: 18000 }),
    null, []
  );
  expect(result.status).toBe('failed');
});

console.log('\n--- ±50% 가격 변동 ---');
it('price jump 50%+ vs prev → status=warning', () => {
  // regular_price must be >= sale_price to avoid Rule 3 triggering first
  const result = runHealthCheck(
    PRODUCT, LISTING, baseOffer({ salePrice: 30000, regularPrice: 35000 }),
    norm({ sale_price: 30000, regular_price: 35000, base_unit_price: 30000, effective_unit_price: 30000 }),
    PREV_SNAPSHOT, // prev was 18000 → 66.7% jump
    []
  );
  expect(result.status).toBe('warning');
  expect(result.message).toContain('50%');
});

it('price drop 50%+ vs prev → status=warning', () => {
  const result = runHealthCheck(
    PRODUCT, LISTING, baseOffer({ salePrice: 8000 }),
    norm({ sale_price: 8000, regular_price: 20000, base_unit_price: 8000, effective_unit_price: 8000 }),
    PREV_SNAPSHOT, // prev was 18000 → 55.6% drop
    []
  );
  expect(result.status).toBe('warning');
});

it('price within ±49% → status=ok', () => {
  const result = runHealthCheck(
    PRODUCT, LISTING, baseOffer({ salePrice: 22000, regularPrice: 25000 }),
    norm({ sale_price: 22000, regular_price: 25000, base_unit_price: 22000, effective_unit_price: 22000 }),
    PREV_SNAPSHOT, // prev=18000 → 22.2% increase
    []
  );
  expect(result.status).toBe('ok');
});

console.log('\n--- volume_mismatch ---');
it('volume_mismatch=true → status=failed', () => {
  const result = runHealthCheck(
    PRODUCT, LISTING, baseOffer(),
    norm({ volume_mismatch: true, volume_mismatch_detail: 'Page 150ml ≠ DB 50ml', parse_confidence: 'low' }),
    null, []
  );
  expect(result.status).toBe('failed');
  expect(result.message).toContain('mismatch');
});

console.log('\n--- parse_confidence=low ---');
it('parse_confidence=low (no other hard fail) → status=warning', () => {
  const result = runHealthCheck(
    PRODUCT, LISTING, baseOffer(),
    norm({ parse_confidence: 'low' }),
    null, []
  );
  expect(result.status).toBe('warning');
});

console.log('\n--- Naver allowlist ---');
const ALLOWLIST: RetailerAllowlist[] = [
  { id: 1, seller_id: 3, brand: '테스트브랜드', allowed_store_name: '공식스토어', is_active: true },
];

it('store name in allowlist → status=ok', () => {
  const result = runHealthCheck(
    PRODUCT, NAVER_LISTING,
    baseOffer({ storeName: '공식스토어' }),
    norm(),
    null, ALLOWLIST
  );
  expect(result.status).toBe('ok');
});

it('store name NOT in allowlist → status=failed', () => {
  const result = runHealthCheck(
    PRODUCT, NAVER_LISTING,
    baseOffer({ storeName: '개인판매자' }),
    norm(),
    null, ALLOWLIST
  );
  expect(result.status).toBe('failed');
  expect(result.message).toContain('allowlist');
});

console.log('\n--- 정상 케이스 ---');
it('clean price, no issues → status=ok', () => {
  const result = runHealthCheck(
    PRODUCT, LISTING, baseOffer(), norm(), PREV_SNAPSHOT, []
  );
  expect(result.status).toBe('ok');
});

// ---------------------------------------------------------------------------
console.log('\n=== healthcheck.test.ts Results ===');
if (failed) {
  console.error('Result: FAILED');
  process.exit(1);
} else {
  console.log('Result: ALL PASSED');
}
