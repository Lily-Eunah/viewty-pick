/**
 * Coupang adapter unit tests — fixture-based (no live API calls).
 * Tests parseCoupangItem() and extractCoupangProductId() with hardcoded API responses.
 *
 * Fixture cases:
 *  1. 단품 일반 상품
 *  2. 로켓배송 (shippingNote='로켓배송')
 *  3. 쿠폰가 있는 경우 (couponPrice → label only, not in base_unit_price)
 *  4. 재고없음
 *  5. URL에서 productId 추출
 *  6. parsedVolumeRaw 추출 (ml in productName)
 */
import {
  parseCoupangItem,
  extractCoupangProductId,
  isCoupangShortLink,
  buildSearchKeyword,
  CoupangApiItem,
} from '../coupang';

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
// Base fixture
// ---------------------------------------------------------------------------
function item(overrides: Partial<CoupangApiItem>): CoupangApiItem {
  return {
    productId: 123456789,
    productName: '테스트 선크림 SPF50 50ml',
    price: 18900,
    basePrice: 21000,
    isRocket: false,
    soldOut: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixture 1: 단품
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 1] 단품 ---');
it('salePrice = price field', () => {
  const offer = parseCoupangItem(item({}));
  expect(offer.salePrice).toBe(18900);
});

it('regularPrice = basePrice field', () => {
  const offer = parseCoupangItem(item({}));
  expect(offer.regularPrice).toBe(21000);
});

it('promoType=none, promoText=null for simple product', () => {
  const offer = parseCoupangItem(item({}));
  expect(offer.promoType).toBe('none');
  expect(offer.promoText).toBeNull();
});

it('inStock=true when soldOut=false', () => {
  const offer = parseCoupangItem(item({}));
  expect(offer.inStock).toBe(true);
});

it('shippingNote=null for non-rocket', () => {
  const offer = parseCoupangItem(item({ isRocket: false }));
  expect(offer.shippingNote).toBeNull();
});

// ---------------------------------------------------------------------------
// Fixture 2: 로켓배송
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 2] 로켓배송 ---');
it('shippingNote=로켓배송 for rocket items', () => {
  const offer = parseCoupangItem(item({ isRocket: true }));
  expect(offer.shippingNote).toBe('로켓배송');
});

it('storeName=쿠팡 로켓배송 for rocket', () => {
  const offer = parseCoupangItem(item({ isRocket: true }));
  expect(offer.storeName).toBe('쿠팡 로켓배송');
});

// ---------------------------------------------------------------------------
// Fixture 3: 쿠폰가 (조건부 혜택 — label only)
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 3] 쿠폰가 ---');
it('couponPrice → promoType=coupon (label only)', () => {
  const offer = parseCoupangItem(item({ couponPrice: 17000 }));
  expect(offer.promoType).toBe('coupon');
});

it('salePrice is NOT reduced by couponPrice', () => {
  const offer = parseCoupangItem(item({ price: 18900, couponPrice: 17000 }));
  // salePrice must remain 18900 — coupon is conditional, not included in comparison
  expect(offer.salePrice).toBe(18900);
});

it('promoText mentions coupon price as label', () => {
  const offer = parseCoupangItem(item({ price: 18900, couponPrice: 17000 }));
  if (!offer.promoText || !offer.promoText.includes('17,000')) {
    throw new Error(`Expected promoText to contain coupon price, got: ${offer.promoText}`);
  }
});

// ---------------------------------------------------------------------------
// Fixture 4: 재고없음
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 4] 재고없음 ---');
it('inStock=false when soldOut=true', () => {
  const offer = parseCoupangItem(item({ soldOut: true }));
  expect(offer.inStock).toBe(false);
});

// ---------------------------------------------------------------------------
// Fixture 5: URL에서 productId 추출
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 5] URL productId 추출 ---');
it('extracts productId from /vp/products/ URL', () => {
  const id = extractCoupangProductId('https://www.coupang.com/vp/products/7654321?itemId=123');
  expect(id).toBe('7654321');
});

it('extracts productId from /products/ URL', () => {
  const id = extractCoupangProductId('https://www.coupang.com/products/9999');
  expect(id).toBe('9999');
});

it('returns null for non-product URL', () => {
  const id = extractCoupangProductId('https://www.coupang.com/np/search?q=선크림');
  expect(id).toBeNull();
});

// ---------------------------------------------------------------------------
// Fixture 6: parsedVolumeRaw
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 6] parsedVolumeRaw ---');
it('extracts 50ml from productName', () => {
  const offer = parseCoupangItem(item({ productName: '선크림 SPF50+ 50ml 단품' }));
  expect(offer.parsedVolumeRaw).toBe(50);
});

it('extracts 200ml from productName', () => {
  const offer = parseCoupangItem(item({ productName: '로션 200mL 대용량' }));
  expect(offer.parsedVolumeRaw).toBe(200);
});

it('parsedVolumeRaw=null when no volume in title', () => {
  const offer = parseCoupangItem(item({ productName: '선크림 SPF50+' }));
  expect(offer.parsedVolumeRaw).toBeNull();
});

// ---------------------------------------------------------------------------
// Fixture 7: search API shape — productPrice / isFreeShipping / productUrl
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 7] search API shape ---');
it('salePrice reads productPrice (search API field)', () => {
  const offer = parseCoupangItem(item({ price: undefined, productPrice: 22500 }));
  expect(offer.salePrice).toBe(22500);
});

it('productPrice takes precedence over legacy price', () => {
  const offer = parseCoupangItem(item({ price: 18900, productPrice: 22500 }));
  expect(offer.salePrice).toBe(22500);
});

it('isFreeShipping → shippingNote=무료배송 (non-rocket)', () => {
  const offer = parseCoupangItem(item({ isRocket: false, isFreeShipping: true }));
  expect(offer.shippingNote).toBe('무료배송');
});

it('isRocket beats isFreeShipping for shippingNote', () => {
  const offer = parseCoupangItem(item({ isRocket: true, isFreeShipping: true }));
  expect(offer.shippingNote).toBe('로켓배송');
});

it('productUrl deeplink → matchedUrl (cached as buy link)', () => {
  const offer = parseCoupangItem(item({ productUrl: 'https://link.coupang.com/a/abcdef' }));
  expect(offer.matchedUrl).toBe('https://link.coupang.com/a/abcdef');
});

it('productImage → imageUrl (display fallback)', () => {
  const offer = parseCoupangItem(item({ productImage: 'https://ads-partners.coupang.com/image1/abc' }));
  expect(offer.imageUrl).toBe('https://ads-partners.coupang.com/image1/abc');
});

it('imageUrl null when productImage absent', () => {
  const offer = parseCoupangItem(item({}));
  expect(offer.imageUrl ?? null).toBeNull();
});

// ---------------------------------------------------------------------------
// Fixture 8: short-link / data-error gate (productId not extractable)
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 8] short-link / data-error gate ---');
it('short-link link.coupang.com/a/… has no productId', () => {
  expect(extractCoupangProductId('https://link.coupang.com/a/abcDEF')).toBeNull();
});

it('isCoupangShortLink detects link.coupang.com share links', () => {
  expect(isCoupangShortLink('https://link.coupang.com/a/abcDEF')).toBe(true);
});

it('isCoupangShortLink false for a product-detail URL', () => {
  expect(isCoupangShortLink('https://www.coupang.com/vp/products/7654321')).toBe(false);
});

it('product-detail URL still yields its productId', () => {
  expect(extractCoupangProductId('https://www.coupang.com/vp/products/7654321?itemId=1')).toBe('7654321');
});

// ---------------------------------------------------------------------------
// Fixture 9: search keyword builder (brand + name, volume stripped)
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 9] search keyword ---');
it('keyword = brand + name with ml stripped', () => {
  expect(buildSearchKeyword('라운드랩', '독도 토너 200ml')).toBe('라운드랩 독도 토너');
});

it('keyword drops brand parenthetical', () => {
  expect(buildSearchKeyword('아누아 (ANUA)', '어성초 토너 250 mL')).toBe('아누아 어성초 토너');
});

it('keyword handles null brand', () => {
  expect(buildSearchKeyword(null, '선크림 50ml')).toBe('선크림');
});

// ---------------------------------------------------------------------------
console.log('\n=== coupang.test.ts Results ===');
if (failed) {
  console.error('Result: FAILED');
  process.exit(1);
} else {
  console.log('Result: ALL PASSED');
}
