/**
 * link_only sheet — pure-logic tests (no network):
 *  classifyLinkOnly (seller + outcome + reason → cause/action; 이종세트 vs miss;
 *  coupang data_error vs no_offer), and buildLinkOnlyRows (dedupe by
 *  product_key+seller, stamp 상태=미해결 + 갱신일, skip empty keys, full regenerate
 *  so resolved links drop out and there are no duplicates).
 */
import {
  classifyLinkOnly,
  buildLinkOnlyRows,
  rowKey,
  LinkOnlyItem,
} from '../linkOnly';

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

function item(o: Partial<LinkOnlyItem>): LinkOnlyItem {
  return {
    seller: 'coupang', brand: '에뛰드', product_name: '제품1', product_key: 'P1',
    cause: 'c', action: 'a', url: 'https://x',
    ...o,
  };
}

console.log('\n--- classifyLinkOnly ---');
it('coupang no_offer → 검색 top-N 부재 + URL 교체', () => {
  const { cause, action } = classifyLinkOnly('coupang', 'no_offer', 'Coupang: productId 123 not in search results');
  assert(/검색 top-N/.test(cause), 'cause mentions search top-N');
  assert(/URL로 교체/.test(action), 'action = swap URL');
});
it('coupang data_error → short-link 원인 + 제품 상세 URL 교체', () => {
  const { cause, action } = classifyLinkOnly('coupang', 'data_error', 'Coupang 제품 URL 필요: 공유 short-link');
  assert(/short-link|productId 없음/.test(cause), 'cause mentions short-link');
  assert(/제품 상세 URL/.test(action), 'action = product-detail URL');
});
it('oliveyoung heterogeneous set → 이종 세트 검수 보류', () => {
  const { cause } = classifyLinkOnly('oliveyoung', 'no_offer', 'OliveYoung: no Naver offer — 올리브영 offer is a heterogeneous set — hold/inspection');
  assert(/이종 세트/.test(cause), 'cause = 이종 세트 검수 보류');
});
it('oliveyoung plain miss → 단품 오퍼 미발견(Tier 3/4)', () => {
  const { cause, action } = classifyLinkOnly('oliveyoung', 'no_offer', 'OliveYoung: no Naver offer — no individual-mall offers (tier 4 link-only)');
  assert(/단품 오퍼 미발견|Tier 3\/4/.test(cause), 'cause = 단품 미발견');
  assert(/올리브영 단품/.test(action), 'action = OY 단품 확인');
});
it('naver heterogeneous set → 묶음(이종 세트) 검수 필요', () => {
  const { cause } = classifyLinkOnly('naver', 'no_offer', 'Naver API: excluded — id-anchored to curated SKU (productNo 9) but it is a heterogeneous 2-product set — needs inspection (no price)');
  assert(/이종 세트/.test(cause), 'cause = 이종 세트 검수');
});
it('naver anchor miss → anchor miss + 폴백 없음', () => {
  const { cause, action } = classifyLinkOnly('naver', 'no_offer', 'Naver API: excluded — anchor miss (productNo 9) + no official-store/catalog fallback — link-only');
  assert(/anchor miss/.test(cause), 'cause = anchor miss');
  assert(/공식몰 단품/.test(action), 'action = 공식몰 단품/세트 분리');
});
it('unknown seller → generic fallback', () => {
  const { cause } = classifyLinkOnly('mystery', 'no_offer', null);
  assert(/가격 미매칭/.test(cause), 'generic cause');
});

console.log('\n--- buildLinkOnlyRows ---');
it('stamps 상태=미해결 and 갱신일', () => {
  const rows = buildLinkOnlyRows([item({})], '2026-06-18');
  assert(rows.length === 1, 'one row');
  assert(rows[0].status === '미해결', 'status 미해결');
  assert(rows[0].updated_at === '2026-06-18', 'updated_at = today');
});
it('dedupes by product_key+seller (last wins), no duplicate keys', () => {
  const rows = buildLinkOnlyRows([
    item({ product_key: 'P1', seller: 'naver', cause: 'old' }),
    item({ product_key: 'P1', seller: 'naver', cause: 'new' }),
  ], '2026-06-18');
  assert(rows.length === 1, 'collapsed to one');
  assert(rows[0].cause === 'new', 'last wins');
});
it('same product, different seller are distinct rows', () => {
  const rows = buildLinkOnlyRows([
    item({ product_key: 'P1', seller: 'naver' }),
    item({ product_key: 'P1', seller: 'coupang' }),
  ], '2026-06-18');
  assert(rows.length === 2, 'two distinct seller rows');
  const keys = rows.map((r) => rowKey(r.product_key, r.seller));
  assert(keys.includes('P1::naver') && keys.includes('P1::coupang'), 'both keys present');
});
it('skips items with empty product_key or seller', () => {
  const rows = buildLinkOnlyRows([
    item({ product_key: '', seller: 'naver' }),
    item({ product_key: 'P2', seller: '' }),
    item({ product_key: 'P3', seller: 'naver' }),
  ], '2026-06-18');
  assert(rows.length === 1 && rows[0].product_key === 'P3', 'only the valid row kept');
});
it('full regenerate: a resolved link (absent from current) is not emitted', () => {
  // run 1: two unmatched links
  const run1 = buildLinkOnlyRows([item({ product_key: 'P1', seller: 'naver' }), item({ product_key: 'P2', seller: 'coupang' })], '2026-06-18');
  assert(run1.length === 2, 'run1 has both');
  // run 2: P1 now priced (gone from current) → only P2 remains
  const run2 = buildLinkOnlyRows([item({ product_key: 'P2', seller: 'coupang' })], '2026-06-19');
  assert(run2.length === 1 && run2[0].product_key === 'P2', 'resolved P1 dropped');
});

console.log('\n=== linkOnly.test.ts Results ===');
for (const r of results) console.log(r);
if (failed) {
  console.error('\nResult: FAILED');
  process.exit(1);
} else {
  console.log('\nResult: ALL PASSED');
}
