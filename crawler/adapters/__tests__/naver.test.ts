/**
 * Naver adapter unit tests — fixture-based (no live crawl / no Playwright).
 * Tests the pure parseNaverPageContent() function with hardcoded NaverRawPageContent.
 *
 * Fixture cases:
 *  1. 단품 (single product)
 *  2. 1+1
 *  3. 2+1
 *  4. N개입 (multi-pack in title)
 *  5. 더블기획 (double pack, same product)
 *  6. 용량불일치 (volume mismatch)
 *  7. 재고없음 (out of stock)
 *  8. 배송비 라벨
 *  9. 조건부 혜택 (쿠폰) — must be label only
 * 10. 멤버십 — must be label only
 */
import { parseNaverPageContent, NaverRawPageContent } from '../naver';
import { RetailerAllowlist } from '../../../lib/types';
import { Product } from '../../../lib/types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
function raw(overrides: Partial<NaverRawPageContent>): NaverRawPageContent {
  return {
    titleText: '테스트 선크림 SPF50+ PA++++ 50ml',
    salePriceText: '18,900원',
    regularPriceText: '21,000원',
    storeNameText: '테스트브랜드 공식스토어',
    promoTexts: [],
    shippingText: '무료배송',
    outOfStock: false,
    pageUrl: 'https://smartstore.naver.com/testbrand/products/123',
    ...overrides,
  };
}

const PRODUCT: Product = {
  id: 1, slug: 'test', product_key: 'T1', name: '테스트 선크림', brand: '테스트브랜드',
  category_id: null, volume_ml: 50, image_url: null, features: null,
  skin_types: [], hwahae_url: null, official_info_url: null,
  viewty_score: 0, source: 'sheet', is_active: true,
};

const ALLOWLIST: RetailerAllowlist[] = [
  { id: 1, seller_id: 3, brand: '테스트브랜드', allowed_store_name: '테스트브랜드 공식스토어', is_active: true },
];

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
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
    not: {
      toBeNull() {
        if (actual === null) throw new Error('Expected non-null, got null');
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Fixture 1: 단품 (single item)
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 1] 단품 ---');
it('salePrice parsed correctly', () => {
  const offer = parseNaverPageContent(raw({}), ALLOWLIST, 3, PRODUCT);
  expect(offer.salePrice).toBe(18900);
});

it('regularPrice parsed', () => {
  const offer = parseNaverPageContent(raw({}), ALLOWLIST, 3, PRODUCT);
  expect(offer.regularPrice).toBe(21000);
});

it('promoType=none for single product', () => {
  const offer = parseNaverPageContent(raw({}), ALLOWLIST, 3, PRODUCT);
  expect(offer.promoType).toBe('none');
});

it('inStock=true when not sold out', () => {
  const offer = parseNaverPageContent(raw({}), ALLOWLIST, 3, PRODUCT);
  expect(offer.inStock).toBe(true);
});

it('parsedVolumeRaw = 50 from title', () => {
  const offer = parseNaverPageContent(raw({}), ALLOWLIST, 3, PRODUCT);
  expect(offer.parsedVolumeRaw).toBe(50);
});

it('shippingNote = 무료배송', () => {
  const offer = parseNaverPageContent(raw({}), ALLOWLIST, 3, PRODUCT);
  expect(offer.shippingNote).toBe('무료배송');
});

it('storeName resolved from allowlist', () => {
  const offer = parseNaverPageContent(raw({}), ALLOWLIST, 3, PRODUCT);
  expect(offer.storeName).toBe('테스트브랜드 공식스토어');
});

// ---------------------------------------------------------------------------
// Fixture 2: 1+1
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 2] 1+1 ---');
it('promoType=buy_x_get_y, promoText=1+1', () => {
  const offer = parseNaverPageContent(
    raw({ promoTexts: ['1+1 행사 중!'] }),
    ALLOWLIST, 3, PRODUCT
  );
  expect(offer.promoType).toBe('buy_x_get_y');
  expect(offer.promoText).toBe('1+1');
});

// ---------------------------------------------------------------------------
// Fixture 3: 2+1
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 3] 2+1 ---');
it('promoType=buy_x_get_y, promoText=2+1', () => {
  const offer = parseNaverPageContent(
    raw({ promoTexts: ['2+1 이벤트'] }),
    ALLOWLIST, 3, PRODUCT
  );
  expect(offer.promoType).toBe('buy_x_get_y');
  expect(offer.promoText).toBe('2+1');
});

// ---------------------------------------------------------------------------
// Fixture 4: N개입 (multi-pack volume in title)
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 4] N개입 ---');
it('parsedVolumeRaw=60 from 60ml in title', () => {
  const offer = parseNaverPageContent(
    raw({ titleText: '선크림 SPF50 60ml, 2개입' }),
    ALLOWLIST, 3, PRODUCT
  );
  expect(offer.parsedVolumeRaw).toBe(60);
});

// ---------------------------------------------------------------------------
// Fixture 5: 더블기획 (same 50ml × 2)
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 5] 더블기획 ---');
it('parsedVolumeRaw=50 from 50ml+50ml title', () => {
  const offer = parseNaverPageContent(
    raw({ titleText: '선크림 50ml+50ml 더블기획 세트' }),
    ALLOWLIST, 3, PRODUCT
  );
  expect(offer.parsedVolumeRaw).toBe(50);
});

// ---------------------------------------------------------------------------
// Fixture 6: 용량 불일치 (150ml page vs 50ml DB)
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 6] 용량 불일치 ---');
it('parsedVolumeRaw=150 when title says 150ml (DB=50ml)', () => {
  const offer = parseNaverPageContent(
    raw({ titleText: '선크림 150ml 대용량' }),
    ALLOWLIST, 3, PRODUCT
  );
  // parsedVolumeRaw should reflect what the page says
  expect(offer.parsedVolumeRaw).toBe(150);
  // Mismatch detection happens in normalize, not the adapter
});

// ---------------------------------------------------------------------------
// Fixture 7: 재고 없음
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 7] 재고없음 ---');
it('inStock=false when outOfStock=true', () => {
  const offer = parseNaverPageContent(
    raw({ outOfStock: true }),
    ALLOWLIST, 3, PRODUCT
  );
  expect(offer.inStock).toBe(false);
});

// ---------------------------------------------------------------------------
// Fixture 8: 유료 배송
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 8] 배송비 라벨 ---');
it('paid shipping → shippingNote = "3,000원"', () => {
  const offer = parseNaverPageContent(
    raw({ shippingText: '배송비 3,000원' }),
    ALLOWLIST, 3, PRODUCT
  );
  expect(offer.shippingNote).toBe('3,000원');
});

it('조건부 무료배송', () => {
  const offer = parseNaverPageContent(
    raw({ shippingText: '50,000원 이상 무료배송' }),
    ALLOWLIST, 3, PRODUCT
  );
  expect(offer.shippingNote).toBe('조건부 무료');
});

// ---------------------------------------------------------------------------
// Fixture 9: 쿠폰 (조건부 혜택 — label only, promoType must stay coupon)
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 9] 쿠폰 ---');
it('coupon text → promoType=coupon (conditional benefit label)', () => {
  const offer = parseNaverPageContent(
    raw({ promoTexts: ['5% 즉시할인쿠폰'] }),
    ALLOWLIST, 3, PRODUCT
  );
  expect(offer.promoType).toBe('coupon');
});

// ---------------------------------------------------------------------------
// Fixture 10: 멤버십
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 10] 멤버십 ---');
it('membership text → promoType=membership', () => {
  const offer = parseNaverPageContent(
    raw({ promoTexts: ['네이버플러스 멤버십 추가 할인'] }),
    ALLOWLIST, 3, PRODUCT
  );
  expect(offer.promoType).toBe('membership');
});

// 1+1 takes priority over coupon even if coupon appears first
it('1+1 takes priority over coupon in promo list', () => {
  const offer = parseNaverPageContent(
    raw({ promoTexts: ['5% 즉시할인쿠폰', '1+1 이벤트'] }),
    ALLOWLIST, 3, PRODUCT
  );
  expect(offer.promoType).toBe('buy_x_get_y');
});

// ---------------------------------------------------------------------------
console.log('\n=== naver.test.ts Results ===');
if (failed) {
  console.error('Result: FAILED');
  process.exit(1);
} else {
  console.log('Result: ALL PASSED');
}
