import { extractPackageFromTitle } from './packageExtractor';
import { normalizePrice } from './normalize';
import { Product } from '../../lib/types';
import { PriceOffer } from '../adapters';

type TestCase = {
  title: string;
  expected: {
    detected: boolean;
    unitType?: "ml" | "g" | "sheet" | "count" | "unknown";
    unitAmount?: number | null;
    unitCount?: number | null;
    totalAmount?: number | null;
    confidence?: "high" | "medium" | "low";
  };
};

const testCases: TestCase[] = [
  {
    title: "몽디에스 징크 유아 어린이 초등학생 무기자차 이지워시 선크림 SPF50 60ml, 2개",
    expected: {
      detected: true,
      unitType: "ml",
      unitAmount: 60,
      unitCount: 2,
      totalAmount: 120,
      confidence: "high"
    }
  },
  {
    title: "상품명 60ml x 2",
    expected: {
      detected: true,
      unitType: "ml",
      unitAmount: 60,
      unitCount: 2,
      totalAmount: 120,
      confidence: "high"
    }
  },
  {
    title: "상품명 60ml×2",
    expected: {
      detected: true,
      unitType: "ml",
      unitAmount: 60,
      unitCount: 2,
      totalAmount: 120,
      confidence: "high"
    }
  },
  {
    title: "상품명 60ml 2개입",
    expected: {
      detected: true,
      unitType: "ml",
      unitAmount: 60,
      unitCount: 2,
      totalAmount: 120,
      confidence: "high"
    }
  },
  {
    title: "상품명 50ml+50ml",
    expected: {
      detected: true,
      unitType: "ml",
      unitAmount: 50,
      unitCount: 2,
      totalAmount: 100,
      confidence: "high"
    }
  },
  {
    title: "마스크팩 10매입",
    expected: {
      detected: true,
      unitType: "sheet",
      unitAmount: null,
      unitCount: 10,
      totalAmount: 10,
      confidence: "high"
    }
  },
  {
    title: "패드 70매",
    expected: {
      detected: true,
      unitType: "sheet",
      unitAmount: null,
      unitCount: 70,
      totalAmount: 70,
      confidence: "high"
    }
  },
  {
    title: "SPF50 PA++++ 60ml",
    expected: {
      detected: true,
      unitType: "ml",
      unitAmount: 60,
      unitCount: 1,
      totalAmount: 60,
      confidence: "high"
    }
  },
  {
    title: "상품명",
    expected: {
      detected: false
    }
  },
  {
    title: "마스크팩 25ml, 10매입",
    expected: {
      detected: true,
      unitType: "sheet",
      unitAmount: 25,
      unitCount: 10,
      totalAmount: 10,
      confidence: "high"
    }
  },
  {
    // Free-sample gift must NOT be counted as quantity: this is ONE 30ml unit.
    title: "유세린 하이알루론 에피셀린 세럼 30ml 기획 (+에피셀린 세럼 7ml*2)",
    expected: {
      detected: true,
      unitType: "ml",
      unitAmount: 30,
      unitCount: 1,
      totalAmount: 30,
      confidence: "high"
    }
  },
  {
    // Gift in parentheses stripped → single 200g, not a 2-pack.
    title: "토리든 다이브인 포맨 올인원 200g (+미니 20g 증정)",
    expected: {
      detected: true,
      unitType: "g",
      unitAmount: 200,
      unitCount: 1,
      totalAmount: 200,
      confidence: "high"
    }
  },
  {
    // Refill (1+1 of same product) → 2 × main volume. The "(+265ml 리필팩)" is an
    // added unit, NOT a freebie, so it is kept and counted.
    title: "비플레인 라하 토너 265ml 기획 (+265ml 리필팩)",
    expected: { detected: true, unitType: "ml", unitAmount: 265, unitCount: 2, totalAmount: 530, confidence: "high" }
  },
  {
    // "1+1" count promo with volume → 2 units.
    title: "닥터지 레드 블레미쉬 세럼 30ml 1+1",
    expected: { detected: true, unitType: "ml", unitAmount: 30, unitCount: 2, totalAmount: 60, confidence: "high" }
  },
  {
    // Non-paren gift tail "+ 토너 20ml 증정" stripped → single 30ml (NOT 50ml/2).
    title: "유세린 에피셀린 세럼 30ml + 토너 20ml 증정",
    expected: { detected: true, unitType: "ml", unitAmount: 30, unitCount: 1, totalAmount: 30, confidence: "high" }
  },
  {
    // "더블기획" = homogeneous ×2.
    title: "넘버즈인 3번 도자기결 톤업베이지 선크림 50ml 더블기획",
    expected: { detected: true, unitType: "ml", unitAmount: 50, unitCount: 2, totalAmount: 100, confidence: "high" }
  }
];

let failed = false;

console.log('=== Running Package Title Extractor Tests ===');

for (const [idx, tc] of testCases.entries()) {
  const result = extractPackageFromTitle(tc.title);
  
  let caseFailed = false;
  const checks: string[] = [];

  const assertEqual = (key: string, actual: unknown, expected: unknown) => {
    if (actual !== expected) {
      caseFailed = true;
      checks.push(`Fail: ${key} (Expected: ${expected}, Got: ${actual})`);
    } else {
      checks.push(`Pass: ${key} (${actual})`);
    }
  };

  assertEqual('detected', result.detected, tc.expected.detected);
  
  if (tc.expected.detected) {
    if (tc.expected.unitType !== undefined) {
      assertEqual('unitType', result.unitType, tc.expected.unitType);
    }
    if (tc.expected.unitAmount !== undefined) {
      assertEqual('unitAmount', result.unitAmount, tc.expected.unitAmount);
    }
    if (tc.expected.unitCount !== undefined) {
      assertEqual('unitCount', result.unitCount, tc.expected.unitCount);
    }
    if (tc.expected.totalAmount !== undefined) {
      assertEqual('totalAmount', result.totalAmount, tc.expected.totalAmount);
    }
    if (tc.expected.confidence !== undefined) {
      assertEqual('confidence', result.confidence, tc.expected.confidence);
    }
  }

  if (caseFailed) {
    failed = true;
    console.error(`\n[Test Case ${idx + 1}] FAIL: "${tc.title}"`);
    for (const ch of checks) {
      if (ch.startsWith('Fail')) console.error(`  ${ch}`);
    }
  } else {
    console.log(`[Test Case ${idx + 1}] PASS: "${tc.title}"`);
  }
}

// Heterogeneous set (two different main products) → flagged, not priced as single.
{
  const het = extractPackageFromTitle('큐레이션 토너 100ml + 세럼 30ml');
  const single = extractPackageFromTitle('비플레인 라하 토너 265ml');
  if (het.heterogeneous !== true) { console.error(`  Fail: heterogeneous flag (got ${het.heterogeneous})`); failed = true; }
  else console.log('  Pass: heterogeneous set flagged (100ml + 30ml)');
  if (single.heterogeneous) { console.error('  Fail: single wrongly flagged heterogeneous'); failed = true; }
  else console.log('  Pass: single not flagged heterogeneous');

  const twoJong = extractPackageFromTitle('닥터지 레드 블레미쉬 포 맨 토너 진정올인원 2종 기획');
  const device = extractPackageFromTitle('바이오힐보 NAD 세럼 30ml 슈링크 홈 디바이스 기획');
  const dblBig = extractPackageFromTitle('브링그린 티트리 시카 딥클렌징폼 200ml 기획 (더블/대용량)');
  if (twoJong.heterogeneous !== true) { console.error('  Fail: "2종" not flagged heterogeneous'); failed = true; }
  else console.log('  Pass: "2종" flagged heterogeneous');
  if (device.heterogeneous !== true) { console.error('  Fail: device bundle not flagged heterogeneous'); failed = true; }
  else console.log('  Pass: device bundle flagged heterogeneous');
  // "(더블/대용량)" is ambiguous → must NOT be counted as ×2 (treat as single).
  if (dblBig.unitCount === 2) { console.error('  Fail: "(더블/대용량)" wrongly counted as ×2'); failed = true; }
  else console.log('  Pass: "(더블/대용량)" not over-counted');

  // fix/oliveyoung-n-jong-option: a BARE "N종" is an "N종 중 택1" option-select page
  // (단품), NOT a set → must NOT be flagged heterogeneous (so OY prices it as single).
  const bareJong = extractPackageFromTitle('롬앤 글래스팅 워터 틴트 쿠션 2종 30ml');
  if (bareJong.heterogeneous) { console.error('  Fail: bare "2종" wrongly flagged heterogeneous'); failed = true; }
  else console.log('  Pass: bare "2종" (option-select) not flagged heterogeneous');
}

console.log('\n=== Running Normalizer Integration Tests ===');

// volume_ml=60 to match titles that say 60ml (avoids volume-mismatch flag)
const dummyProduct: Product = {
  id: 101,
  slug: "test-product",
  product_key: "TEST-101",
  name: "테스트 제품",
  brand: "테스트",
  category_id: null,
  volume_ml: 60,
  image_url: null,
  features: null,
  skin_types: [],
  hwahae_url: null,
  official_info_url: null,
  viewty_score: 80,
  source: "admin",
  is_active: true,
};

// Integration Test 1
{
  const offer: PriceOffer = {
    sourceText: "몽디에스 징크 유아 어린이 초등학생 무기자차 이지워시 선크림 SPF50 60ml, 2개",
    salePrice: 31500,
    regularPrice: null,
    promoType: "none",
    promoText: null,
    inStock: true,
  };

  const norm = normalizePrice(dummyProduct, offer);
  console.log(`[Normalize Integration 1] 60ml 2-pack: quantity/ml/price/confidence check`);

  let integration1Failed = false;
  const assert = (key: string, actual: unknown, expected: unknown) => {
    if (actual !== expected) {
      console.error(`  Fail: ${key} (Expected: ${expected}, Got: ${actual})`);
      integration1Failed = true;
      failed = true;
    } else {
      console.log(`  Pass: ${key} (${actual})`);
    }
  };

  assert('total_quantity', norm.total_quantity, 2);
  assert('total_ml', norm.total_ml, 120);
  assert('effective_unit_price', norm.effective_unit_price, 15750);
  assert('unit_price', norm.unit_price, Number((15750 / 60).toFixed(4))); // 262.5
  assert('parse_confidence', norm.parse_confidence, 'high'); // no mismatch: title 60ml = DB 60ml
  assert('volume_mismatch', norm.volume_mismatch, false);

  if (integration1Failed) {
    console.error(`[Normalize Integration 1] FAIL`);
  } else {
    console.log(`[Normalize Integration 1] PASS`);
  }
}

// Integration Test 2: Negative test (should not parse quantity from SPF50)
{
  const offer: PriceOffer = {
    sourceText: "SPF50 PA++++ 60ml",
    salePrice: 20000,
    regularPrice: null,
    promoType: "none",
    promoText: null,
    inStock: true,
  };

  const norm = normalizePrice(dummyProduct, offer);
  console.log(`\n[Normalize Integration 2] Negative test (SPF50 PA++++ 60ml)`);
  
  let integration2Failed = false;
  const assert = (key: string, actual: unknown, expected: unknown) => {
    if (actual !== expected) {
      console.error(`  Fail: ${key} (Expected: ${expected}, Got: ${actual})`);
      integration2Failed = true;
      failed = true;
    } else {
      console.log(`  Pass: ${key} (${actual})`);
    }
  };

  assert('total_quantity', norm.total_quantity, 1);
  assert('total_ml', norm.total_ml, 60);
  assert('parse_confidence', norm.parse_confidence, 'high');

  if (integration2Failed) {
    console.error(`[Normalize Integration 2] FAIL`);
  } else {
    console.log(`[Normalize Integration 2] PASS`);
  }
}

console.log('\n======================================');
if (failed) {
  console.error('Test Result: FAILED');
  process.exit(1);
} else {
  console.log('Test Result: PASSED');
  process.exit(0);
}
