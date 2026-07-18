/**
 * 피부타입 테스트 채점 라우팅 테스트.
 * Run: tsx lib/skin-test/__tests__/scoring.test.ts
 */
import { computeResult, resolveOilWinner, resultPath } from '../scoring';
import { QUESTIONS } from '../quizData';
import { BASE_RESULTS, TOPPING_RESULTS, BASE_KEYS } from '../results';

let failed = false;
function it(name: string, fn: () => void) {
  try { fn(); console.log(`  ✓ ${name}`); } catch (e) { failed = true; console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); }
}
function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

// picks 헬퍼 — 기본은 "무난" 응답(중성·무자극), 지정 문항만 덮어쓴다.
// 기본값: Q1③ Q2③ Q3③ Q4③(중성) / Q5③ Q6②(수분 0) / Q7① Q8① Q9④(민감 0) / Q10⑥(없음)
const CALM = [2, 2, 2, 2, 2, 1, 0, 0, 3, 5];
function picks(over: Record<number, number> = {}): number[] {
  const a = [...CALM];
  for (const [q, idx] of Object.entries(over)) a[Number(q) - 1] = idx;
  return a;
}

console.log('--- 유분 베이스 판정 ---');
it('올 중성 응답 → 투게더 바닐라(normal)', () => {
  const r = computeResult(picks());
  assert(r.base === 'normal', `got ${r.base}`);
  assert(r.topping === 'none', 'topping none');
});
it('순수 지성(Q1④Q2①Q3④Q4④) → 폴라포(oily)', () => {
  const r = computeResult(picks({ 1: 3, 2: 0, 3: 3, 4: 3 }));
  assert(r.base === 'oily', `got ${r.base}`);
  assert(r.scores.oil.oily === 8, `oily score ${r.scores.oil.oily}`);
});
it('순수 건성 → 빵또아(dry)', () => {
  const r = computeResult(picks({ 1: 0, 2: 3, 3: 0, 4: 0 }));
  assert(r.base === 'dry', `got ${r.base}`);
});
it('T존 복합 → 월드콘(combo)', () => {
  const r = computeResult(picks({ 1: 1, 2: 1, 3: 1, 4: 1 }));
  assert(r.base === 'combo', `got ${r.base}`);
});
it('Q6③(수분크림 부담)은 지성에 +1', () => {
  const r = computeResult(picks({ 1: 3, 2: 0, 3: 3, 4: 3, 6: 2 }));
  assert(r.scores.oil.oily === 9, `oily score ${r.scores.oil.oily}`);
});

console.log('--- 동점 규칙 ---');
it('건성 4 : 복합 4 → 복합 수렴', () => {
  const r = computeResult(picks({ 1: 0, 2: 3, 3: 1, 4: 1 }));
  assert(r.base === 'combo', `got ${r.base}`);
});
it('건성 4 : 지성 4 → 복합 수렴', () => {
  const r = computeResult(picks({ 1: 0, 2: 0, 3: 0, 4: 3 }));
  assert(r.base === 'combo', `got ${r.base}`);
});
it('중성 4 : 지성 4 → 신호 있는 지성 우선', () => {
  const r = computeResult(picks({ 3: 3, 4: 3 }));
  assert(r.base === 'oily', `got ${r.base}`);
});
it('resolveOilWinner 단독 최고점은 그대로', () => {
  assert(resolveOilWinner({ dry: 6, combo: 2, normal: 0, oily: 0 }) === 'dry', 'dry wins');
});

console.log('--- 수분 축(수부지·수분부족 중성) ---');
it('지성 + 수분 4점 → 탱크보이(oily-dehydrated)', () => {
  const r = computeResult(picks({ 1: 3, 2: 0, 3: 3, 4: 3, 5: 0, 6: 0 }));
  assert(r.base === 'oily-dehydrated', `got ${r.base}`);
  assert(r.waterOn, 'waterOn');
});
it('수분 경계 3점 = ON (Q5② + Q6①)', () => {
  const r = computeResult(picks({ 5: 1, 6: 0 }));
  assert(r.waterOn, 'waterOn at 3');
  assert(r.base === 'normal-dehydrated', `got ${r.base}`);
});
it('수분 2점 = OFF + waterHint(속건조 기미)', () => {
  const r = computeResult(picks({ 5: 0 }));
  assert(!r.waterOn, 'off at 2');
  assert(r.waterHint, 'hint at 2');
  assert(r.base === 'normal', `got ${r.base}`);
});
it('건성은 수분 ON이어도 빵또아 유지(라우팅 무관)', () => {
  const r = computeResult(picks({ 1: 0, 2: 3, 3: 0, 4: 0, 5: 0, 6: 0 }));
  assert(r.base === 'dry', `got ${r.base}`);
});

console.log('--- 민감 축(최우선 라우팅) ---');
it('민감 4점 + 건성 우세 → 캔디바(dry-sensitive)', () => {
  const r = computeResult(picks({ 1: 0, 2: 3, 3: 0, 4: 0, 7: 2, 8: 1, 9: 1 }));
  assert(r.sensitiveOn, 'sensitiveOn');
  assert(r.base === 'dry-sensitive', `got ${r.base}`);
});
it('민감 ON + 중성 우세 → 캔디바로 수렴', () => {
  const r = computeResult(picks({ 7: 2, 8: 2, 9: 1 }));
  assert(r.base === 'dry-sensitive', `got ${r.base}`);
});
it('민감 ON + 지성 우세 → 스크류바(combo-sensitive)로 수렴', () => {
  const r = computeResult(picks({ 1: 3, 2: 0, 3: 3, 4: 3, 7: 2, 8: 1, 9: 1 }));
  assert(r.base === 'combo-sensitive', `got ${r.base}`);
});
it('민감 경계 3점 = OFF', () => {
  const r = computeResult(picks({ 7: 1, 8: 1, 9: 1 }));
  assert(!r.sensitiveOn, 'off at 3');
  assert(r.base === 'normal', `got ${r.base}`);
});
it('지성+트러블 응답(Q9③)은 민감 점수 없음 — 오염 방지', () => {
  const r = computeResult(picks({ 1: 3, 2: 0, 3: 3, 4: 3, 9: 2 }));
  assert(r.scores.sensitive === 0, `sensitive ${r.scores.sensitive}`);
  assert(r.base === 'oily', `got ${r.base}`);
});

console.log('--- 케어 권고·토핑·보너스 ---');
it('Q8③ 또는 Q9① → careAdvised', () => {
  assert(computeResult(picks({ 8: 2 })).careAdvised, 'Q8③');
  assert(computeResult(picks({ 9: 0 })).careAdvised, 'Q9①');
  assert(!computeResult(picks()).careAdvised, 'calm no care');
});
it('Q10 선택이 토핑으로 확정', () => {
  const r = computeResult(picks({ 10: 0 }));
  assert(r.topping === 'trouble', `got ${r.topping}`);
});
it('보조 신호와 토핑 일치 → hintMatched', () => {
  const r = computeResult(picks({ 3: 3, 1: 3, 2: 0, 4: 3, 10: 1 }));
  assert(r.hintMatched, 'pores hint matched');
  const r2 = computeResult(picks({ 10: 4 }));
  assert(!r2.hintMatched, 'elasticity has no hint source');
});
it('보너스 recent는 민감 ON일 때만 유효', () => {
  const on = computeResult(picks({ 7: 2, 8: 2 }), 'recent');
  assert(on.recentSensitive, 'sensitive+recent');
  const off = computeResult(picks(), 'recent');
  assert(!off.recentSensitive, 'calm+recent ignored');
});

console.log('--- 데이터 무결성 ---');
it('모든 베이스·토핑 결과에 카피와 에셋이 있다', () => {
  for (const k of BASE_KEYS) {
    const b = BASE_RESULTS[k];
    assert(b.flavor && b.typeName && b.desc && b.care.length >= 2 && b.asset, `base ${k}`);
  }
  for (const t of Object.values(TOPPING_RESULTS)) {
    assert(t.petName && t.copy && t.asset, `topping ${t.petName}`);
  }
});
it('Q10 토핑 선택지가 TOPPING_RESULTS와 1:1', () => {
  const q10 = QUESTIONS[9];
  const keys = q10.options.map((o) => o.topping).filter((t) => t && t !== 'none');
  assert(keys.length === Object.keys(TOPPING_RESULTS).length, `q10 covers ${keys.length}`);
  for (const k of keys) assert(k! in TOPPING_RESULTS, `missing ${k}`);
});
it('resultPath 형태', () => {
  assert(resultPath('oily', 'none') === '/skin-test/result/oily/none', 'path shape');
});

if (failed) { console.error('SKIN-TEST SCORING TESTS FAILED'); process.exit(1); }
console.log('all skin-test scoring tests passed');
