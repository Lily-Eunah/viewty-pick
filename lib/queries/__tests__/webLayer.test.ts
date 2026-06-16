/**
 * Web-layer pure-helper tests: composition labels (구성) + updatedAt formatting.
 * Run: tsx lib/queries/__tests__/webLayer.test.ts
 */
import { compositionLabel } from '../index';
import { updatedAt } from '../../format';

let failed = false;
function it(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed = true; console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

console.log('--- compositionLabel ---');
it('buy_x_get_y → N+M from promo_text', () => {
  assert(compositionLabel('buy_x_get_y', '1+1 기획', 2) === '1+1', 'should read 1+1');
});
it('gift / 증정 text → 증정', () => {
  assert(compositionLabel('gift', null, 1) === '증정', 'gift type');
  assert(compositionLabel('none', '본품 + 미니 증정', 1) === '증정', '증정 text');
});
it('multipack quantity → N개', () => {
  assert(compositionLabel('bundle', '265ml, 6개', 6) === '6개', 'qty label');
});
it('plain single → null', () => {
  assert(compositionLabel('none', null, 1) === null, 'single has no composition');
});

console.log('--- updatedAt (KST) ---');
it('formats ISO to KST label', () => {
  // 2026-06-17T05:49:59Z + 9h = 14:49 KST
  assert(updatedAt('2026-06-17T05:49:59Z') === '2026.06.17 14:49 KST', `got ${updatedAt('2026-06-17T05:49:59Z')}`);
});
it('empty / invalid → empty string', () => {
  assert(updatedAt(null) === '' && updatedAt('nope') === '', 'graceful empty');
});

console.log(failed ? '\nResult: FAILED' : '\nResult: ALL PASSED');
if (failed) process.exit(1);
