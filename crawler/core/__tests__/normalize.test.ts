/**
 * Normalize unit tests — covers:
 *  1+1 / 2+1 / N개 수량할인 / 번들 / 용량불일치(§1 절충: 가격유지·ml당 비활성) / 이상치 게이트
 *  조건부 혜택(쿠폰/멤버십/앱)이 기본가·혜택가에 섞이지 않는지
 *  배송비가 가격에 포함되지 않는지
 */
import { normalizePrice } from '../normalize';
import { Product } from '../../../lib/types';
import { PriceOffer } from '../../adapters';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------
const BASE_PRODUCT: Product = {
  id: 1,
  slug: 'test-product',
  product_key: 'TEST-001',
  name: '테스트 선크림',
  brand: '테스트브랜드',
  category_id: null,
  volume_ml: 50,
  image_url: null,
  features: null,
  skin_types: [],
  hwahae_url: null,
  official_info_url: null,
  viewty_score: 0,
  source: 'sheet',
  is_active: true,
};

function offer(overrides: Partial<PriceOffer>): PriceOffer {
  return {
    regularPrice: null,
    salePrice: null,
    inStock: true,
    promoType: 'none',
    promoText: null,
    sourceText: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test runner (no external framework)
// ---------------------------------------------------------------------------
let failed = false;
const results: string[] = [];

function describe(label: string, fn: () => void) {
  console.log(`\n--- ${label} ---`);
  fn();
}

function it(name: string, fn: () => void) {
  try {
    fn();
    results.push(`PASS  ${name}`);
    console.log(`  ✓ ${name}`);
  } catch (e: unknown) {
    failed = true;
    const msg = e instanceof Error ? e.message : String(e);
    results.push(`FAIL  ${name}: ${msg}`);
    console.error(`  ✗ ${name}: ${msg}`);
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
    toBeLessThanOrEqual(n: number) {
      if ((actual as unknown as number) > n) throw new Error(`Expected <= ${n}, got ${actual}`);
    },
    toEqual(expected: T) {
      const a = JSON.stringify(actual);
      const b = JSON.stringify(expected);
      if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
    },
    toBe_truthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('1+1 promotion', () => {
  it('effective_unit_price = salePrice / 2, base_unit_price = salePrice', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 18900,
      promoType: 'buy_x_get_y',
      promoText: '1+1',
    }));
    expect(result.base_unit_price).toBe(18900);
    expect(result.effective_unit_price).toBe(9450); // 18900 * 1 / 2
    expect(result.paid_quantity).toBe(1);
    expect(result.free_quantity).toBe(1);
    expect(result.total_quantity).toBe(2);
    expect(result.parse_confidence).toBe('high');
  });
});

describe('2+1 promotion', () => {
  it('effective_unit_price = salePrice * 2 / 3 (rounded)', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 18900,
      promoType: 'buy_x_get_y',
      promoText: '2+1',
    }));
    expect(result.effective_unit_price).toBe(12600); // 18900 * 2 / 3
    expect(result.paid_quantity).toBe(2);
    expect(result.free_quantity).toBe(1);
    expect(result.total_quantity).toBe(3);
    expect(result.parse_confidence).toBe('high');
  });
});

describe('N개 수량할인', () => {
  it('2개 20% 할인 → effective = 15120', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 18900,
      promoType: 'quantity_discount',
      promoText: '2개 구매 시 20% 할인',
    }));
    // 18900 * 2 * 0.8 / 2 = 15120
    expect(result.effective_unit_price).toBe(15120);
    expect(result.min_quantity).toBe(2);
    expect(result.parse_confidence).toBe('high');
  });

  it('ambiguous promo text → parse_confidence=low', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 18900,
      promoType: 'quantity_discount',
      promoText: '수량할인', // no specific pattern
    }));
    expect(result.parse_confidence).toBe('low');
  });
});

describe('Bundle (더블기획 / N개입)', () => {
  it('2개입 in title → effective = salePrice / 2', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 31500,
      promoType: 'none',
      promoText: null,
      sourceText: '선크림 SPF50 50ml, 2개',
    }));
    expect(result.total_quantity).toBe(2);
    expect(result.effective_unit_price).toBe(15750);
    expect(result.promo_type).toBe('bundle');
  });

  it('50ml+50ml 더블기획 → total_quantity=2', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 25000,
      promoType: 'none',
      promoText: null,
      sourceText: '선크림 50ml+50ml 더블기획',
    }));
    expect(result.total_quantity).toBe(2);
    expect(result.parse_confidence).toBe('high');
  });
});

describe('Volume mismatch (§1 compromise: price kept, unit_price disabled)', () => {
  it('parsedVolumeRaw ≠ product.volume_ml → price kept (confidence=high), unit_price null, reliable=false', () => {
    const product200ml: Product = { ...BASE_PRODUCT, volume_ml: 50 };
    const result = normalizePrice(product200ml, offer({
      salePrice: 25000,
      promoType: 'none',
      promoText: null,
      parsedVolumeRaw: 150, // different from 50ml
    }));
    // §1: do NOT gate the price — base/effective stay, confidence stays high
    expect(result.volume_mismatch).toBe(true);
    expect(result.parse_confidence).toBe('high');
    expect(result.base_unit_price).toBe(25000);
    expect(result.effective_unit_price).toBe(25000);
    // ml-based price is the only thing disabled
    expect(result.unit_price).toBeNull();
    expect(result.unit_price_reliable).toBe(false);
  });

  it('parsedVolumeRaw matches product.volume_ml → no mismatch, unit_price reliable', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 20000,
      promoType: 'none',
      parsedVolumeRaw: 50, // same as product
    }));
    expect(result.volume_mismatch).toBe(false);
    expect(result.parse_confidence).toBe('high');
    expect(result.unit_price_reliable).toBe(true);
    expect(result.unit_price).toBe(400); // 20000 / 50
  });

  it('volume mismatch from title (no parsedVolumeRaw) → price kept, unit_price null, reliable=false', () => {
    const product50ml: Product = { ...BASE_PRODUCT, volume_ml: 50 };
    const result = normalizePrice(product50ml, offer({
      salePrice: 20000,
      promoType: 'none',
      promoText: null,
      sourceText: '선크림 150ml', // 150 ≠ 50
    }));
    expect(result.volume_mismatch).toBe(true);
    expect(result.parse_confidence).toBe('high');
    expect(result.base_unit_price).toBe(20000);
    expect(result.unit_price).toBeNull();
    expect(result.unit_price_reliable).toBe(false);
  });
});

describe('Volume unverified (§1b: LLM-seeded default → ml disabled, price kept)', () => {
  it('volume_verified=false → unit_price null + reliable=false, base price kept, confidence high', () => {
    const unverified: Product = { ...BASE_PRODUCT, volume_verified: false };
    const result = normalizePrice(unverified, offer({ salePrice: 18000, promoType: 'none' }));
    expect(result.base_unit_price).toBe(18000);
    expect(result.parse_confidence).toBe('high');
    expect(result.volume_mismatch).toBe(false); // unverified is not a mismatch
    expect(result.unit_price).toBeNull();
    expect(result.unit_price_reliable).toBe(false);
  });

  it('volume_verified=true → ml comparison enabled', () => {
    const verified: Product = { ...BASE_PRODUCT, volume_verified: true };
    const result = normalizePrice(verified, offer({ salePrice: 18000, promoType: 'none' }));
    expect(result.unit_price).toBe(360);
    expect(result.unit_price_reliable).toBe(true);
  });
});

describe('Anomaly gate (비교 제외 케이스)', () => {
  it('buy_x_get_y with unparseable promo_text → parse_confidence=low', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 18900,
      promoType: 'buy_x_get_y',
      promoText: '이벤트 진행 중', // no N+M pattern
    }));
    expect(result.parse_confidence).toBe('low');
  });
});

describe('Conditional promos — must NOT affect base_unit_price or effective_unit_price', () => {
  it('coupon promo: base_unit_price = sale_price', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 18000,
      regularPrice: 20000,
      promoType: 'coupon',
      promoText: '5% 장바구니 쿠폰',
    }));
    expect(result.base_unit_price).toBe(18000);
    expect(result.effective_unit_price).toBe(18000);
  });

  it('membership promo: base_unit_price = sale_price', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 17000,
      promoType: 'membership',
      promoText: '네이버플러스 멤버십가',
    }));
    expect(result.base_unit_price).toBe(17000);
    expect(result.effective_unit_price).toBe(17000);
  });

  it('app_only promo: base_unit_price = sale_price', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 16500,
      promoType: 'app_only',
      promoText: '앱 전용가',
    }));
    expect(result.base_unit_price).toBe(16500);
    expect(result.effective_unit_price).toBe(16500);
  });
});

describe('Shipping: label only — not in price fields', () => {
  it('shippingNote propagated to shipping_note, not in prices', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 18000,
      promoType: 'none',
      shippingNote: '무료배송',
    }));
    expect(result.shipping_note).toBe('무료배송');
    expect(result.base_unit_price).toBe(18000);
    expect(result.effective_unit_price).toBe(18000);
  });
});

describe('ml당 가격 (unit_price)', () => {
  it('1개 50ml 18000원 → unit_price = 360', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({ salePrice: 18000, promoType: 'none' }));
    expect(result.unit_price).toBe(360);
    expect(result.total_ml).toBe(50);
  });

  it('1+1 2개 총50ml → total_ml=100, unit_price=salePrice/2/50', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 18000,
      promoType: 'buy_x_get_y',
      promoText: '1+1',
    }));
    // effective_unit_price=9000, volume_ml=50
    expect(result.total_ml).toBe(100);
    expect(result.unit_price).toBe(180); // 9000/50
  });
});

describe('non-anchored fallback (inspectionWarning) → ml unit_price unreliable', () => {
  it('inspectionWarning set → unit_price=null, unit_price_reliable=false, base price kept', () => {
    const result = normalizePrice(BASE_PRODUCT, offer({
      salePrice: 24200,
      sourceText: '에뛰드 순정 약산성 클렌징폼 150ml',
      inspectionWarning: '비앵커 공식몰 매칭(검수)',
    }));
    expect(result.sale_price).toBe(24200);
    expect(result.base_unit_price).toBe(24200); // price stays visible/comparable
    expect(result.unit_price_reliable).toBe(false);
    expect(result.unit_price).toBeNull(); // ml normalization disabled (unverified identity)
  });
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n=== normalize.test.ts Results ===');
for (const r of results) console.log(r);
if (failed) {
  console.error('\nResult: FAILED');
  process.exit(1);
} else {
  console.log('\nResult: ALL PASSED');
}
