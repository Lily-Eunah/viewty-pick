/**
 * linkWriteback — pure planning tests (no network) for the Naver B2 substitution
 * write-back to product_links:
 *   - matches rows by product_name; resolves naver / naver_prev columns from header.
 *   - WRITE-ONCE preserves the operator's ORIGINAL naver link into naver_prev only
 *     when it is still blank (never overwrites a prior preservation), AND overwrites
 *     `naver` with the substitute link.
 *   - no-op when the link is unchanged; skips unknown product_names; bails when the
 *     required columns are missing.
 */
import { planNaverLinkWriteback, colLetter, NaverLinkSubstitution } from '../linkWriteback';

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

// header layout: A product_name | B brand | C oliveyoung | D coupang | E naver | F naver_prev | G zigzag | H ably
const HEADER = ['product_name', 'brand', 'oliveyoung', 'coupang', 'naver', 'naver_prev', 'zigzag', 'ably'];
const sub = (productName: string, newUrl: string): NaverLinkSubstitution => ({ productName, newUrl });

console.log('\n--- colLetter ---');
it('0→A, 4→E, 5→F, 26→AA', () => {
  assert(colLetter(0) === 'A', 'A');
  assert(colLetter(4) === 'E', 'E');
  assert(colLetter(5) === 'F', 'F');
  assert(colLetter(26) === 'AA', 'AA');
});

console.log('\n--- planNaverLinkWriteback ---');
it('first substitution: preserves operator original into naver_prev + overwrites naver', () => {
  const rows = [HEADER, ['레스트업 세럼 스킨', '인터미션', '', '', 'https://smartstore.naver.com/x/products/5328668155', '', '', '']];
  const w = planNaverLinkWriteback(rows, [sub('레스트업 세럼 스킨', 'https://smartstore.naver.com/x/products/9999')]);
  // row 2 (A1 row=2): naver_prev = F2 ← operator original; naver = E2 ← new url
  const prev = w.find((x) => x.range === 'product_links!F2');
  const naver = w.find((x) => x.range === 'product_links!E2');
  assert(prev && prev.value === 'https://smartstore.naver.com/x/products/5328668155', 'F2 = operator original');
  assert(naver && naver.value === 'https://smartstore.naver.com/x/products/9999', 'E2 = substitute');
  assert(w.length === 2, 'exactly two writes');
});

it('write-once: naver_prev already set → do NOT overwrite it, only update naver', () => {
  const rows = [HEADER, ['P', 'B', '', '', 'https://naver/sub1', 'https://naver/OPERATOR_ORIGINAL', '', '']];
  const w = planNaverLinkWriteback(rows, [sub('P', 'https://naver/sub2')]);
  assert(!w.some((x) => x.range === 'product_links!F2'), 'naver_prev untouched');
  const naver = w.find((x) => x.range === 'product_links!E2');
  assert(naver && naver.value === 'https://naver/sub2', 'naver updated to sub2');
  assert(w.length === 1, 'only the naver write');
});

it('no-op when the substitute equals the current naver value', () => {
  const rows = [HEADER, ['P', 'B', '', '', 'https://naver/same', 'https://naver/orig', '', '']];
  const w = planNaverLinkWriteback(rows, [sub('P', 'https://naver/same')]);
  assert(w.length === 0, 'no writes for unchanged link');
});

it('skips product_names not present in the sheet', () => {
  const rows = [HEADER, ['P', 'B', '', '', 'https://naver/a', '', '', '']];
  const w = planNaverLinkWriteback(rows, [sub('NOT_THERE', 'https://naver/b')]);
  assert(w.length === 0, 'unknown name → no writes');
});

it('matches the correct row among several', () => {
  const rows = [
    HEADER,
    ['First', 'B', '', '', 'https://naver/first', '', '', ''],
    ['Target', 'B', '', '', 'https://naver/old', '', '', ''],
  ];
  const w = planNaverLinkWriteback(rows, [sub('Target', 'https://naver/new')]);
  // Target is row 3 (A1) → E3 / F3
  assert(w.some((x) => x.range === 'product_links!E3' && x.value === 'https://naver/new'), 'E3 updated');
  assert(w.some((x) => x.range === 'product_links!F3' && x.value === 'https://naver/old'), 'F3 preserves original');
  assert(!w.some((x) => x.range.endsWith('2')), 'row 2 (First) untouched');
});

it('trims whitespace when matching names and reading cells', () => {
  const rows = [HEADER, ['  Spaced Name  ', 'B', '', '', '  https://naver/orig  ', '', '', '']];
  const w = planNaverLinkWriteback(rows, [sub('Spaced Name', 'https://naver/new')]);
  const prev = w.find((x) => x.range === 'product_links!F2');
  assert(prev && prev.value === 'https://naver/orig', 'trimmed original preserved');
});

it('matches by product_key when the sheet has a product_key column (name differs)', () => {
  const header = ['product_key', 'product_name', 'brand', 'oliveyoung', 'coupang', 'naver', 'naver_prev', 'zigzag', 'ably'];
  // sheet product_name is stale/renamed; product_key still identifies the row.
  const rows = [header, ['intermission-restup', '레스트업 (구명칭)', '인터미션', '', '', 'https://naver/orig', '', '', '']];
  const w = planNaverLinkWriteback(rows, [{ productKey: 'intermission-restup', productName: '레스트업 세럼 스킨', newUrl: 'https://naver/new' }]);
  // naver col is index 5 → F; naver_prev index 6 → G
  assert(w.some((x) => x.range === 'product_links!F2' && x.value === 'https://naver/new'), 'naver(F2) updated via key match');
  assert(w.some((x) => x.range === 'product_links!G2' && x.value === 'https://naver/orig'), 'naver_prev(G2) preserved via key match');
});

it('returns empty when required columns are missing (run sheets:headers first)', () => {
  const noPrev = [['product_name', 'brand', 'naver'], ['P', 'B', 'https://naver/a']];
  const w = planNaverLinkWriteback(noPrev, [sub('P', 'https://naver/b')]);
  assert(w.length === 0, 'no naver_prev column → no writes');
});

it('returns empty for empty subs or header-only sheet', () => {
  assert(planNaverLinkWriteback([HEADER], [sub('P', 'x')]).length === 0, 'header only → none');
  assert(planNaverLinkWriteback([HEADER, ['P', 'B', '', '', 'https://naver/a', '', '', '']], []).length === 0, 'no subs → none');
});

console.log('\n=== linkWriteback.test.ts Results ===');
for (const r of results) console.log(r);
if (failed) {
  console.error('\nResult: FAILED');
  process.exit(1);
} else {
  console.log('\nResult: ALL PASSED');
}
