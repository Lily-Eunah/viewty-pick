/**
 * Import key-matching: links/badges/overrides resolve by stable product_key, so a
 * product RENAME never breaks them (the recurring badge-skip cause). Falls back to
 * product_name only when no key is given.
 * Run: tsx crawler/sheets/__tests__/keymatch.test.ts
 */
import { resolveProductKey, expandListings, buildNameToKey } from '../validate';

let failed = false;
function it(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed = true; console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

const nameToKey = new Map<string, string>([['하이알루론 에피셀린 세럼', 'pox90ld']]);

console.log('--- resolveProductKey ---');
it('explicit product_key wins (rename-proof — name need not match)', () => {
  // badges sheet has the key but a STALE old name; matching still succeeds.
  assert(resolveProductKey({ product_key: 'pox90ld', product_name: '하이아르론(old)' }, nameToKey) === 'pox90ld', 'key should win');
});
it('falls back to product_name when no key', () => {
  assert(resolveProductKey({ product_name: '하이알루론 에피셀린 세럼' }, nameToKey) === 'pox90ld', 'name fallback');
});
it('renamed product, name-only, no key → undefined (the OLD badge-skip case)', () => {
  assert(resolveProductKey({ product_name: '하이아르론 에피셀린 세럼' }, nameToKey) === undefined, 'stale name misses');
});

console.log('--- expandListings (key-based) ---');
it('links row matched by product_key despite a stale product_name', () => {
  const products = [{ product_key: 'pox90ld', name: '하이알루론 에피셀린 세럼', brand: '유세린', category: '에센스/세럼/앰플', volume_ml: '30' }] as unknown as Record<string, string>[];
  const n2k = buildNameToKey(products);
  const links = [{ product_key: 'pox90ld', product_name: 'WRONG OLD NAME', naver: 'https://brand.naver.com/x/products/1' }] as unknown as Record<string, string>[];
  const flat = expandListings(links, n2k);
  assert(flat.length === 1 && flat[0].product_key === 'pox90ld' && flat[0].seller === 'naver', `got ${JSON.stringify(flat)}`);
});

console.log(failed ? '\nResult: FAILED' : '\nResult: ALL PASSED');
if (failed) process.exit(1);
