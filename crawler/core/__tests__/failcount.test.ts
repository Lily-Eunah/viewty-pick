/**
 * fail_count semantics — the core regression: a legitimate no-match must NOT be
 * treated as a fetch failure (no fail_count increment, no auto-deactivation),
 * while real fetch failures still advance the DESIGN §4.4 staircase.
 *
 * Tests the pure resolver resolveListingOutcome(listing, outcome) which run.ts
 * uses for every listing. outcome ∈ { 'ok', 'no_offer', 'failed' }.
 */
import { resolveListingOutcome, handleConsecutiveFailures } from '../healthcheck';
import { Listing } from '../../../lib/types';
import { FetchOutcome } from '../../adapters';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 10, link_key: 'naver-001', product_id: 1, seller_id: 3,
    url: 'https://smartstore.naver.com/brand/products/123',
    affiliate_url: null, store_name: '브랜드스토어', is_official_store: true,
    is_rocket: false, crawl_enabled: true, crawl_method: 'naver_sourced',
    last_crawled_at: null, fail_count: 0, is_active: true,
    ...overrides,
  };
}

/**
 * Simulate N consecutive runs with the same outcome, threading the resolved
 * fail_count / is_active back onto the listing the way run.ts does.
 */
function simulate(start: Listing, outcome: FetchOutcome, runs: number): Listing {
  let cur = { ...start };
  for (let i = 0; i < runs; i++) {
    const res = resolveListingOutcome(cur, outcome);
    cur = { ...cur, fail_count: res.fail_count, is_active: res.is_active };
  }
  return cur;
}

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
  };
}

// ---------------------------------------------------------------------------
// 1. Legitimate no-match must NOT deactivate (the bug this fix targets)
// ---------------------------------------------------------------------------
console.log('\n--- no-match (OK_NO_OFFER) never increments fail_count ---');
it('10 consecutive no_offer → fail_count stays 0, listing stays active', () => {
  const after = simulate(listing(), 'no_offer', 10);
  expect(after.fail_count).toBe(0);
  expect(after.is_active).toBe(true);
});

it('no_offer when fail_count already >0 → resets to 0, stays active', () => {
  const after = simulate(listing({ fail_count: 2 }), 'no_offer', 1);
  expect(after.fail_count).toBe(0);
  expect(after.is_active).toBe(true);
});

it('no_offer does not request notification or previous-price carry', () => {
  const res = resolveListingOutcome(listing(), 'no_offer');
  expect(res.should_notify).toBe(false);
  expect(res.use_previous_price).toBe(false);
});

// ---------------------------------------------------------------------------
// 2. Real fetch failures still advance the §4.4 staircase
// ---------------------------------------------------------------------------
console.log('\n--- fetch failure (FETCH_FAILED) staged behavior ---');
it('1st failure → fail_count=1, active, use_previous_price', () => {
  const res = resolveListingOutcome(listing({ fail_count: 0 }), 'failed');
  expect(res.fail_count).toBe(1);
  expect(res.is_active).toBe(true);
  expect(res.use_previous_price).toBe(true);
  expect(res.should_notify).toBe(false);
});

it('2nd failure → fail_count=2, active, notify + use_previous_price', () => {
  const res = resolveListingOutcome(listing({ fail_count: 1 }), 'failed');
  expect(res.fail_count).toBe(2);
  expect(res.is_active).toBe(true);
  expect(res.should_notify).toBe(true);
  expect(res.use_previous_price).toBe(true);
});

it('3rd failure → fail_count=3, DEACTIVATED + notify', () => {
  const res = resolveListingOutcome(listing({ fail_count: 2 }), 'failed');
  expect(res.fail_count).toBe(3);
  expect(res.is_active).toBe(false);
  expect(res.should_notify).toBe(true);
});

it('5th failure → fail_count=5, notify (manual inspection)', () => {
  const res = resolveListingOutcome(listing({ fail_count: 4, is_active: false }), 'failed');
  expect(res.fail_count).toBe(5);
  expect(res.should_notify).toBe(true);
});

it('resolveListingOutcome("failed") matches handleConsecutiveFailures', () => {
  const l = listing({ fail_count: 1 });
  const a = resolveListingOutcome(l, 'failed');
  const b = handleConsecutiveFailures(l);
  expect(a.fail_count).toBe(b.fail_count);
  expect(a.is_active).toBe(b.is_active);
  expect(a.should_notify).toBe(b.should_notify);
});

// ---------------------------------------------------------------------------
// 3. Mixed: a success (priced OR no_offer) after failures resets the streak
// ---------------------------------------------------------------------------
console.log('\n--- mixed: success resets the failure streak ---');
it('2 failures then ok → fail_count resets to 0', () => {
  const failedTwice = simulate(listing(), 'failed', 2);
  expect(failedTwice.fail_count).toBe(2);
  const recovered = resolveListingOutcome(failedTwice, 'ok');
  expect(recovered.fail_count).toBe(0);
});

it('2 failures then no_offer → fail_count resets to 0 (no-match counts as success)', () => {
  const failedTwice = simulate(listing(), 'failed', 2);
  const recovered = resolveListingOutcome(failedTwice, 'no_offer');
  expect(recovered.fail_count).toBe(0);
  expect(recovered.is_active).toBe(true);
});

it('priced ok keeps fail_count at 0 over many runs', () => {
  const after = simulate(listing(), 'ok', 5);
  expect(after.fail_count).toBe(0);
  expect(after.is_active).toBe(true);
});

// ---------------------------------------------------------------------------
console.log('\n=== failcount.test.ts Results ===');
if (failed) {
  console.error('Result: FAILED');
  process.exit(1);
} else {
  console.log('Result: ALL PASSED');
}
