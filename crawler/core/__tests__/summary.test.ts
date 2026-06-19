/**
 * Crawl-summary accounting — the regression: link-only sellers with no price
 * adapter (zigzag/ably, is_price_comparison_enabled=false) must NOT be counted
 * as failures. They are skipped (informational) and excluded from the
 * success-rate denominator; only real failures (healthcheck 'failed' + thrown
 * errors + data anomalies) feed the Failed count.
 *
 * Run: tsx crawler/core/__tests__/summary.test.ts
 */
import { buildDailySummaryMessage } from '../notify';
import { buildAdapters } from '../../run';

let failed = false;
function it(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed = true; console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

// ---------------------------------------------------------------------------
// Adapter registry: zigzag/ably are NOT crawlable → the loop hits the skip
// branch for them, the three real retailers are crawled.
// ---------------------------------------------------------------------------
console.log('--- buildAdapters registry ---');
it('has adapters for naver, coupang, oliveyoung', () => {
  const slugs = Object.keys(buildAdapters());
  for (const s of ['naver', 'coupang', 'oliveyoung']) {
    assert(slugs.includes(s), `expected adapter for ${s}`);
  }
});
it('has NO adapter for link-only sellers zigzag/ably', () => {
  const slugs = Object.keys(buildAdapters());
  assert(!slugs.includes('zigzag'), 'zigzag must be link-only (no adapter)');
  assert(!slugs.includes('ably'), 'ably must be link-only (no adapter)');
});

// ---------------------------------------------------------------------------
// Daily summary message: Failed shows only real failures; the link-only skips
// are surfaced as a separate informational line.
// ---------------------------------------------------------------------------
console.log('--- buildDailySummaryMessage ---');

it('regression: 34 link-only skips, 0 real failures → Failed 0, Skipped 34', () => {
  // listings active 139 = naver 48 + coupang 19 + oliveyoung 38 + zigzag 19 + ably 15.
  // The 34 zigzag/ably are skipped (no adapter), not failed.
  const msg = buildDailySummaryMessage({
    totalLinks: 139,
    successCount: 100,
    warningCount: 5,
    failureCount: 0,
    durationSeconds: 12.3,
    noOfferCount: 5,
    skippedNoAdapterCount: 34,
  });
  assert(/실패 제외 \(Failed\)\*\*: 0개/.test(msg), `Failed should be 0:\n${msg}`);
  assert(/Skipped · link-only, 어댑터 없음\)\*\*: 34개/.test(msg), `Skipped should be 34:\n${msg}`);
});

it('real failures still surface in Failed independently of skips', () => {
  const msg = buildDailySummaryMessage({
    totalLinks: 139,
    successCount: 90,
    warningCount: 3,
    failureCount: 7,
    durationSeconds: 9,
    skippedNoAdapterCount: 34,
  });
  assert(/실패 제외 \(Failed\)\*\*: 7개/.test(msg), `Failed should be 7:\n${msg}`);
  assert(/Skipped · link-only, 어댑터 없음\)\*\*: 34개/.test(msg), `Skipped should be 34:\n${msg}`);
});

it('skippedNoAdapterCount omitted → defaults to 0개', () => {
  const msg = buildDailySummaryMessage({
    totalLinks: 10,
    successCount: 10,
    warningCount: 0,
    failureCount: 0,
    durationSeconds: 1,
  });
  assert(/Skipped · link-only, 어댑터 없음\)\*\*: 0개/.test(msg), `Skipped should default to 0:\n${msg}`);
});

it('N종 verify items surface as an info line (price kept)', () => {
  const msg = buildDailySummaryMessage({
    totalLinks: 10,
    successCount: 10,
    warningCount: 0,
    failureCount: 0,
    durationSeconds: 1,
    nJongVerifyItems: ['롬앤 쿠션 @ 올리브영 https://oy.run/x'],
  });
  assert(/N종 옵션 링크 — 세트 여부 확인/.test(msg), `N종 verify line missing:\n${msg}`);
  assert(/롬앤 쿠션 @ 올리브영/.test(msg), `N종 item not listed:\n${msg}`);
  assert(/1건/.test(msg), `N종 count should be 1:\n${msg}`);
});

it('no N종 verify items → no N종 line', () => {
  const msg = buildDailySummaryMessage({
    totalLinks: 10,
    successCount: 10,
    warningCount: 0,
    failureCount: 0,
    durationSeconds: 1,
  });
  assert(!/N종 옵션 링크/.test(msg), `N종 line should be absent when empty:\n${msg}`);
});

console.log(failed ? '\nResult: FAILED' : '\nResult: ALL PASSED');
if (failed) process.exit(1);
