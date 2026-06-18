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
  pickCoupangMatch,
  isCoupangProductPageUrl,
  looksLikeImageUrl,
  pickCoupangImage,
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
// Fixture 10: anchored productId with multiple purchase options (single vs bulk)
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 10] pickCoupangMatch lowest option ---');
it('picks the lowest-price row among same-productId options (single, not bulk)', () => {
  const data: CoupangApiItem[] = [
    item({ productId: 8688664449, productName: '일리윤 젠틀 딥 페이셜 클렌저', productPrice: 81840, price: undefined }),
    item({ productId: 8688664449, productName: '일리윤 젠틀 딥 페이셜 클렌저', productPrice: 16600, price: undefined }),
    item({ productId: 8688664449, productName: '일리윤 젠틀 딥 페이셜 클렌저', productPrice: 47800, price: undefined }),
    item({ productId: 999, productName: '다른 상품', productPrice: 5000, price: undefined }),
  ];
  const m = pickCoupangMatch(data, '8688664449');
  expect(m).not.toBeNull();
  expect(m!.productPrice).toBe(16600);
});

it('returns null when no row matches the anchored productId', () => {
  const data: CoupangApiItem[] = [item({ productId: 111 }), item({ productId: 222 })];
  expect(pickCoupangMatch(data, '333')).toBeNull();
});

// ---------------------------------------------------------------------------
// Fixture 11: products.image_url = Coupang product-page URL → image SOURCE
// (resolved to productImage), vs a direct image URL (used as-is).
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 11] image_url classification ---');
it('Coupang product-page URL is an image source (not a usable image)', () => {
  expect(isCoupangProductPageUrl('https://www.coupang.com/vp/products/7654321?itemId=1')).toBe(true);
});

it('direct .jpg URL is NOT an image source (used as-is)', () => {
  expect(isCoupangProductPageUrl('https://cdn.example.com/a/b.jpg')).toBe(false);
});

it('ads-partners.coupang.com productImage host is NOT an image source (used as-is)', () => {
  expect(isCoupangProductPageUrl('https://ads-partners.coupang.com/image1/abc')).toBe(false);
});

it('non-coupang page URL is NOT treated as a Coupang image source', () => {
  expect(isCoupangProductPageUrl('https://brand.naver.com/store/products/123')).toBe(false);
});

it('empty image_url is not an image source', () => {
  expect(isCoupangProductPageUrl('')).toBe(false);
});

it('looksLikeImageUrl true for image extensions and ads-partners host', () => {
  expect(looksLikeImageUrl('https://x/y.png')).toBe(true);
  expect(looksLikeImageUrl('https://x/y.webp?v=2')).toBe(true);
  expect(looksLikeImageUrl('https://ads-partners.coupang.com/image1/abc')).toBe(true);
});

it('looksLikeImageUrl false for a product-page URL', () => {
  expect(looksLikeImageUrl('https://www.coupang.com/vp/products/7654321')).toBe(false);
});

// ---------------------------------------------------------------------------
// Fixture 12: pickCoupangImage — anchored → STRICT identity fallback → null.
// The fallback must never adopt a DIFFERENT product's image (the live-QA bug:
// 엑설런트 선크림 anchor-missed → a different sunscreen's top-hit image).
// ---------------------------------------------------------------------------
console.log('\n--- [Fixture 12] pickCoupangImage (identity-gated) ---');
const NAME = '엑설런트 선크림';
const BRAND = '몽디에스';

it('uses the anchored productId row image when present (identity not required)', () => {
  const data: CoupangApiItem[] = [
    item({ productId: 111, productName: '이니스프리 데일리 선크림 50ml', productImage: 'https://img/wrong.jpg' }),
    item({ productId: 7654321, productName: '몽디에스 엑설런트 선크림 50ml', productImage: 'https://img/anchor.jpg' }),
  ];
  expect(pickCoupangImage(data, '7654321', NAME, BRAND)).toBe('https://img/anchor.jpg');
});

it('anchor missing → uses the SAME product (identity passes), skipping a wrong top-hit', () => {
  const data: CoupangApiItem[] = [
    // higher-ranked but a DIFFERENT product → must be skipped
    item({ productId: 111, productName: '이니스프리 데일리 선크림 50ml', productImage: 'https://img/wrong.jpg' }),
    // same product, different seller listing → identity passes
    item({ productId: 222, productName: '몽디에스 엑설런트 선크림 75ml', productImage: 'https://img/right.jpg' }),
  ];
  expect(pickCoupangImage(data, '999', NAME, BRAND)).toBe('https://img/right.jpg');
});

it('anchor missing + only DIFFERENT products → null (no wrong-product image) [엑설런트 regression]', () => {
  const data: CoupangApiItem[] = [
    item({ productId: 111, productName: '이니스프리 데일리 선크림 50ml', productImage: 'https://img/a.jpg' }),
    item({ productId: 222, productName: '조선미녀 맑은쌀 토너 150ml', productImage: 'https://img/b.jpg' }),
  ];
  expect(pickCoupangImage(data, '999', NAME, BRAND)).toBeNull();
});

it('bundle/set of the SAME product IS adopted for the image (본품+리필/기획세트 = same photo)', () => {
  const data: CoupangApiItem[] = [
    item({ productId: 222, productName: '몽디에스 엑설런트 선크림 50ml 1+1 기획세트', productImage: 'https://img/set.jpg' }),
  ];
  expect(pickCoupangImage(data, '999', NAME, BRAND)).toBe('https://img/set.jpg');
});

it('returns null when the same-product result carries no image', () => {
  const data: CoupangApiItem[] = [item({ productId: 222, productName: '몽디에스 엑설런트 선크림 50ml', productImage: undefined })];
  expect(pickCoupangImage(data, '999', NAME, BRAND)).toBeNull();
});

it('returns null for empty search results', () => {
  expect(pickCoupangImage([], '999', NAME, BRAND)).toBeNull();
});

// ---------------------------------------------------------------------------
// Fixture 12b: brand is REQUIRED on the fallback — a different brand's same-category
// listing (대라/DAERA cushion for an 아이소이 cushion) must be rejected even when the
// generic tokens (스킨케어·쿠션) overlap and it is the top hit. The real 아이소이
// 본품+리필 listing passes (brand match + composition ignored for images). [DAERA bug]
// ---------------------------------------------------------------------------
const ISOI_NAME = '스킨케어 비건 쿠션';
const ISOI_BRAND = '아이소이';

it('rejects a DIFFERENT brand (대라/DAERA) and adopts the real 아이소이 본품+리필 image', () => {
  const data: CoupangApiItem[] = [
    // top hit, generic-token overlap, but a different brand → rejected
    item({ productId: 111, productName: '대라(DAERA) 스킨케어링 쿠션 본품', productImage: 'https://img/daera.jpg' }),
    // real product, set composition (본품+리필) — same photo, brand matches → adopted
    item({ productId: 222, productName: '아이소이 스킨케어 비건 쿠션 21호 본품+리필', productImage: 'https://img/isoi.jpg' }),
  ];
  expect(pickCoupangImage(data, '999', ISOI_NAME, ISOI_BRAND)).toBe('https://img/isoi.jpg');
});

it('rejects a different brand even when it is the ONLY result → null (placeholder)', () => {
  const data: CoupangApiItem[] = [
    item({ productId: 111, productName: '대라(DAERA) 스킨케어링 쿠션 본품', productImage: 'https://img/daera.jpg' }),
  ];
  expect(pickCoupangImage(data, '999', ISOI_NAME, ISOI_BRAND)).toBeNull();
});

it('empty brand can never pass the fallback → null (safe side)', () => {
  const data: CoupangApiItem[] = [
    item({ productId: 222, productName: '아이소이 스킨케어 비건 쿠션 21호', productImage: 'https://img/isoi.jpg' }),
  ];
  expect(pickCoupangImage(data, '999', ISOI_NAME, null)).toBeNull();
  expect(pickCoupangImage(data, '999', ISOI_NAME, '')).toBeNull();
});

it('matches a parenthetical English brand alias in the title (아이소이(isoi))', () => {
  const data: CoupangApiItem[] = [
    item({ productId: 222, productName: 'isoi 스킨케어 비건 쿠션 21호', productImage: 'https://img/isoi.jpg' }),
  ];
  expect(pickCoupangImage(data, '999', ISOI_NAME, '아이소이(isoi)')).toBe('https://img/isoi.jpg');
});

it('hasFormConflict (토너 ↔ 패드) is still rejected even with a brand + identity match', () => {
  const data: CoupangApiItem[] = [
    // brand matches, distinctive tokens (스테이/프레쉬) overlap → identity passes,
    // but the FORM differs (curated 토너 vs candidate 패드) → a different photo → rejected
    item({ productId: 222, productName: '라운드랩 스테이 프레쉬 패드 100매', productImage: 'https://img/pad.jpg' }),
  ];
  expect(pickCoupangImage(data, '999', '스테이 프레쉬 토너', '라운드랩')).toBeNull();
});

// ---------------------------------------------------------------------------
console.log('\n=== coupang.test.ts Results ===');
if (failed) {
  console.error('Result: FAILED');
  process.exit(1);
} else {
  console.log('Result: ALL PASSED');
}
