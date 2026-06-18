/**
 * Inspection OX sheet — pure-logic tests (no network):
 *  parseApproval / parsePrice / rowKey, mergeInspectionRows (preserve operator O/X,
 *  refresh current data, drop resolved blanks, keep sticky decisions), and
 *  approvalOverrides (O → price manual_override; X/blank/unknown/bad price → none).
 */
import {
  parseApproval,
  parsePrice,
  rowKey,
  mergeInspectionRows,
  approvalOverrides,
  InspectionItem,
  InspectionRow,
} from '../inspection';

let failed = false;
const results: string[] = [];
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
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function item(o: Partial<InspectionItem>): InspectionItem {
  return {
    product_key: 'P1', product_name: '제품1', seller: 'naver',
    estimated_price: 24200, source: '에뛰드 본사직영샵', reason: 'A2', link: 'https://naver.me/x',
    ...o,
  };
}
function row(o: Partial<InspectionRow>): InspectionRow {
  return { ...item(o), approval: '', ...o };
}

console.log('\n--- parseApproval ---');
it('O variants → O; X variants → X; else blank', () => {
  for (const o of ['O', 'o', 'ㅇ', '✓', '승인', '노출', ' ok ']) assert(parseApproval(o) === 'O', `${o} → O`);
  for (const x of ['X', 'x', '✗', '거부', '숨김', 'no']) assert(parseApproval(x) === 'X', `${x} → X`);
  for (const b of ['', '  ', '?', '대기', undefined]) assert(parseApproval(b) === '', `${b} → blank`);
});

console.log('\n--- parsePrice ---');
it('parses 24,200 / 24200원 / number; rejects empty/zero/non-numeric', () => {
  assert(parsePrice('24,200') === 24200, 'comma');
  assert(parsePrice('24200원') === 24200, '원 suffix');
  assert(parsePrice(18900) === 18900, 'number');
  assert(parsePrice('') === null, 'empty');
  assert(parsePrice('0') === null, 'zero');
  assert(parsePrice('abc') === null, 'non-numeric');
  assert(parsePrice(null) === null, 'null');
});

console.log('\n--- rowKey ---');
it('rowKey is product_key::seller (trimmed)', () => {
  assert(rowKey(' P1 ', ' naver ') === 'P1::naver', 'trim + join');
});

console.log('\n--- mergeInspectionRows ---');
it('new warning with no prior → blank approval', () => {
  const merged = mergeInspectionRows([], [item({})]);
  assert(merged.length === 1 && merged[0].approval === '', 'blank approval for new');
});
it('current warning carries over a prior O/X', () => {
  const existing = [row({ product_key: 'P1', seller: 'naver', approval: 'O', estimated_price: 20000 })];
  const merged = mergeInspectionRows(existing, [item({ product_key: 'P1', seller: 'naver', estimated_price: 24200 })]);
  assert(merged.length === 1, 'one row');
  assert(merged[0].approval === 'O', 'approval preserved');
  assert(merged[0].estimated_price === 24200, 'data refreshed to current price');
});
it('existing O/X NOT in current are kept (sticky decision)', () => {
  const existing = [
    row({ product_key: 'PO', seller: 'naver', approval: 'O' }),
    row({ product_key: 'PX', seller: 'naver', approval: 'X' }),
    row({ product_key: 'PB', seller: 'naver', approval: '' }), // blank + gone → dropped
  ];
  const merged = mergeInspectionRows(existing, []);
  const keys = merged.map((r) => rowKey(r.product_key, r.seller));
  assert(keys.includes('PO::naver') && keys.includes('PX::naver'), 'O and X kept');
  assert(!keys.includes('PB::naver'), 'blank resolved row dropped');
  assert(merged.length === 2, 'only sticky rows remain');
});
it('same product, different seller are distinct rows', () => {
  const merged = mergeInspectionRows([], [item({ seller: 'naver' }), item({ seller: 'oliveyoung' })]);
  assert(merged.length === 2, 'two distinct seller rows');
});

console.log('\n--- approvalOverrides ---');
const PRODUCTS = [{ id: 11, product_key: 'P1' }, { id: 12, product_key: 'P2' }];
const SELLERS = [{ id: 4, slug: 'naver' }, { id: 2, slug: 'oliveyoung' }];
it('O row → a price manual_override for the right product/seller', () => {
  const ov = approvalOverrides([row({ product_key: 'P1', seller: 'naver', approval: 'O', estimated_price: 24200 })], PRODUCTS, SELLERS);
  assert(ov.length === 1, 'one override');
  assert(ov[0].product_id === 11 && ov[0].seller_id === 4, 'mapped ids');
  assert(ov[0].override_type === 'price' && ov[0].value === '24200', 'price override value');
});
it('uses the operator-edited 추정가격 from the row', () => {
  const ov = approvalOverrides([row({ product_key: 'P1', seller: 'naver', approval: 'O', estimated_price: 19900 })], PRODUCTS, SELLERS);
  assert(ov[0].value === '19900', 'edited price used');
});
it('X / blank → no override', () => {
  const ov = approvalOverrides([
    row({ product_key: 'P1', seller: 'naver', approval: 'X', estimated_price: 24200 }),
    row({ product_key: 'P2', seller: 'naver', approval: '', estimated_price: 24200 }),
  ], PRODUCTS, SELLERS);
  assert(ov.length === 0, 'no overrides for X/blank');
});
it('O but unknown product/seller, or null price → skipped', () => {
  assert(approvalOverrides([row({ product_key: 'ZZ', seller: 'naver', approval: 'O' })], PRODUCTS, SELLERS).length === 0, 'unknown product');
  assert(approvalOverrides([row({ product_key: 'P1', seller: 'zigzag', approval: 'O' })], PRODUCTS, SELLERS).length === 0, 'unknown seller');
  assert(approvalOverrides([row({ product_key: 'P1', seller: 'naver', approval: 'O', estimated_price: null })], PRODUCTS, SELLERS).length === 0, 'null price');
});

console.log('\n=== inspection.test.ts Results ===');
for (const r of results) console.log(r);
if (failed) {
  console.error('\nResult: FAILED');
  process.exit(1);
} else {
  console.log('\nResult: ALL PASSED');
}
