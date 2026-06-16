/**
 * crawler production-write guard — resolveCrawlTarget decision table.
 * Run: tsx crawler/core/__tests__/prodguard.test.ts
 */
import { resolveCrawlTarget } from '../../run';

let failed = false;
function it(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed = true; console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

const REAL: Record<string, string | undefined> = { NEXT_PUBLIC_SUPABASE_URL: 'https://fttlbozyjvtuieznytda.supabase.co' };

console.log('--- resolveCrawlTarget ---');
it('test/mock mode → mock DB, never Supabase, never refused', () => {
  const t = resolveCrawlTarget({ ...REAL, VIEWTYPICK_MOCK_MODE: 'true', CRAWLER_MODE: 'mock' }, true);
  assert(t.mockMode && !t.useSupabase && !t.refused, JSON.stringify(t));
});
it('CRAWLER_MODE=mock alone → mock DB', () => {
  const t = resolveCrawlTarget({ ...REAL, CRAWLER_MODE: 'mock' }, true);
  assert(t.mockMode && !t.useSupabase, JSON.stringify(t));
});
it('LIVE local, no flag, no CI → REFUSED (would write prod)', () => {
  const t = resolveCrawlTarget({ ...REAL, CRAWLER_MODE: 'live' }, true);
  assert(t.useSupabase && t.refused, JSON.stringify(t));
  assert(t.projectRef === 'fttlbozyjvtuieznytda', `ref ${t.projectRef}`);
});
it('LIVE + CRAWLER_ALLOW_PROD_WRITE=true → allowed (not refused)', () => {
  const t = resolveCrawlTarget({ ...REAL, CRAWLER_ALLOW_PROD_WRITE: 'true' }, true);
  assert(t.useSupabase && !t.refused, JSON.stringify(t));
});
it('LIVE + CI=true → allowed (CI/cron bypass)', () => {
  const t = resolveCrawlTarget({ ...REAL, CI: 'true' }, true);
  assert(t.useSupabase && !t.refused, JSON.stringify(t));
});
it('Supabase not configured (CI without secrets) → mock DB, not refused', () => {
  const t = resolveCrawlTarget({}, false);
  assert(!t.useSupabase && !t.refused && t.projectRef === 'none', JSON.stringify(t));
});

console.log(failed ? '\nResult: FAILED' : '\nResult: ALL PASSED');
if (failed) process.exit(1);
