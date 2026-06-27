/**
 * parsePackage 게이트 라우팅 + LLM 폴백/검증 테스트 (네트워크 없음).
 * LLM은 모킹(stub)이라 결정적. 설계 docs/title-parsing-llm-hybrid-design.md §3·§5.
 *
 * Run: tsx crawler/core/__tests__/parsePackage.test.ts
 */
import { analyzeGate, parsePackage } from '../parsePackage';
import type { ParseContext } from '../parsePackage';
import type { LlmTitleResult } from '../titleParseGuards';

let failed = false;
const log: string[] = [];
function check(name: string, cond: boolean, detail = '') {
  if (cond) log.push(`  ✓ ${name}`);
  else {
    failed = true;
    log.push(`  ✗ ${name} ${detail}`);
  }
}

const CTX = (over: Partial<ParseContext> = {}): ParseContext => ({ volumeMl: null, ...over });

console.log('=== parsePackage gate routing ===');

// ── 게이트 라우팅 (analyzeGate, 순수) ──────────────────────────────────────
type GateCase = { title: string; ctx?: Partial<ParseContext>; route: string; count?: number; amount?: number | null; unitType?: string };
const gateCases: GateCase[] = [
  // ① 신호 없는 단품
  { title: '라운드랩 자작나무 토너 100ml', route: 'trivial-single', count: 1, amount: 100, unitType: 'ml' },
  { title: '조선미녀 맑은쌀 선크림', route: 'trivial-single', count: 1, amount: null, unitType: 'unknown' },
  // ②a 용량 동반 멀티팩
  { title: '센카 퍼펙트휩 폼클렌징 120ml 2개', route: 'clean-multipack', count: 2, amount: 120, unitType: 'ml' },
  { title: '상품명 60ml x 2', route: 'clean-multipack', count: 2, amount: 60, unitType: 'ml' },
  { title: '토너 110ml, 1개', route: 'clean-multipack', count: 1, amount: 110, unitType: 'ml' },
  { title: '크림 50g 2개', route: 'clean-multipack', count: 2, amount: 50, unitType: 'g' }, // 수용된 잔여 케이스
  // ②b 용량 미표기 멀티팩 (콤마 투명)
  { title: '라운드랩 자작나무 토너 2개', route: 'clean-multipack', count: 2, amount: null, unitType: 'count' },
  { title: '토너, 2개', route: 'clean-multipack', count: 2, amount: null, unitType: 'count' },
  // ③ 시트 제품의 매수
  { title: '메디힐 마스크팩 70매', ctx: { volumeUnit: '매', productName: '마스크팩' }, route: 'sheet', count: 70, unitType: 'sheet' },
  { title: '아비브 어성초 패드 60매', ctx: { productName: '어성초 패드' }, route: 'sheet', count: 60, unitType: 'sheet' },
  // needs-llm: 부속/단독 매, 결합, 세트/증정, 다중 용량, 괄호
  { title: '에스쁘아 세범컷 쿨링 쿠션 15.8g 퍼프 3매', route: 'needs-llm' }, // 비-시트 + 부속 매
  { title: '쿠션 퍼프 2개', route: 'needs-llm' }, // 부속 개
  { title: '에스쁘아 커버쿠션 15g 본품+리필', route: 'needs-llm' }, // + & 본품/리필
  { title: '닥터지 세럼 30ml 1+1', route: 'needs-llm' }, // +
  { title: '제니피끄 세럼 2종 세트', route: 'needs-llm' }, // 세트/종
  { title: '[퍼프 3매 추가 증정] 에스쁘아 쿠션 15.8g', route: 'needs-llm' }, // 대괄호 + 증정
  { title: '토너 100ml 세럼 30ml', route: 'needs-llm' }, // 다중 용량
];

for (const c of gateCases) {
  const g = analyzeGate(c.title, CTX(c.ctx));
  check(`route "${c.title.slice(0, 30)}" → ${c.route}`, g.route === c.route, `(got ${g.route}: ${g.reason})`);
  if (c.route !== 'needs-llm') {
    if (c.count !== undefined) check(`  count=${c.count}`, g.unitCount === c.count, `(got ${g.unitCount})`);
    if (c.amount !== undefined) check(`  amount=${c.amount}`, g.unitAmount === c.amount, `(got ${g.unitAmount})`);
    if (c.unitType !== undefined) check(`  unitType=${c.unitType}`, g.unitType === c.unitType, `(got ${g.unitType})`);
  }
}

// ── parsePackage: 비-LLM 라우트는 동기 게이트 결과를 그대로 ─────────────────
(async () => {
  const r1 = await parsePackage('토너 2개', CTX());
  check('parsePackage ②b (no llm) count=2 method=regex', r1.unitCount === 2 && r1.method === 'regex' && r1.route === 'clean-multipack');

  // ── needs-llm + llm 없음 → regexFallback (저신뢰·검수) ──
  const r2 = await parsePackage('에스쁘아 커버쿠션 15g 본품+리필', CTX());
  check('parsePackage needs-llm, no stub → fallback(needsInspection)', r2.needsInspection === true && r2.confidence === 'low' && r2.route === 'needs-llm');

  // ── needs-llm + 정상 LLM stub → 채택(method=llm) ──
  const stubBundle = async (): Promise<LlmTitleResult> => ({
    composition: 'homogeneous_bundle', main_unit_volume: 15, main_unit: 'g', main_count: 2,
    gifts: [], per_unit_computable: true, confidence: 'high', evidence: '본품+리필',
  });
  const r3 = await parsePackage('에스쁘아 커버쿠션 15g 본품+리필', CTX({ volumeMl: 15 }), stubBundle);
  check('parsePackage llm bundle → count=2 amount=15 method=llm', r3.method === 'llm' && r3.unitCount === 2 && r3.unitAmount === 15 && r3.heterogeneous === false);

  // ── LLM이 증정 분리: 퍼프 3매 → 본품 단품(count=1) ──
  const stubGift = async (): Promise<LlmTitleResult> => ({
    composition: 'single', main_unit_volume: 15.8, main_unit: 'g', main_count: 1,
    gifts: [{ name: '퍼프', volume: null, unit: '매', reason: '증정' }], per_unit_computable: true, confidence: 'high', evidence: '쿠션 15.8g',
  });
  const r4 = await parsePackage('에스쁘아 세범컷 쿨링 쿠션 15.8g 퍼프 3매', CTX({ volumeMl: 15 }), stubGift);
  check('parsePackage llm gift-strip → count=1 (증정 분리)', r4.method === 'llm' && r4.unitCount === 1 && (r4.gifts?.length ?? 0) === 1);

  // ── 이종세트 → heterogeneous + needsInspection ──
  const stubSet = async (): Promise<LlmTitleResult> => ({
    composition: 'heterogeneous_set', main_unit_volume: null, main_unit: null, main_count: 1,
    gifts: [], per_unit_computable: false, confidence: 'high', evidence: '토너 75ml + 세럼 35ml',
  });
  const r5 = await parsePackage('토너 75ml 세럼 35ml', CTX(), stubSet);
  check('parsePackage llm hetero → heterogeneous + needsInspection', r5.heterogeneous === true && r5.needsInspection === true && r5.method === 'llm');

  // ── 가드: 근거 없는 다수 개수 환각 → 기각 → fallback ──
  const stubHallucinate = async (): Promise<LlmTitleResult> => ({
    composition: 'homogeneous_bundle', main_unit_volume: 100, main_unit: 'ml', main_count: 5,
    gifts: [], per_unit_computable: true, confidence: 'high', evidence: '없는근거',
  });
  // 제목엔 카운트/배수/세트 신호 전무 → 게이트는 trivial-single이라 LLM조차 안 탐.
  // needs-llm으로 보내려 일부러 괄호 포함 제목 사용(게이트 needs-llm) + 카운트 신호는 없음.
  const r6 = await parsePackage('토너 (단독) 에디션', CTX(), stubHallucinate);
  check('parsePackage guard rejects hallucinated count → fallback(regex)', r6.method === 'regex' && r6.needsInspection === true);

  // ── medium confidence → 검수(자동 노출 X) ──
  const stubMedium = async (): Promise<LlmTitleResult> => ({
    composition: 'homogeneous_bundle', main_unit_volume: 50, main_unit: 'ml', main_count: 2,
    gifts: [], per_unit_computable: true, confidence: 'medium', evidence: '50ml 2개',
  });
  const r6c = await parsePackage('애매 세트 50ml 2개', CTX(), stubMedium);
  check('parsePackage medium confidence → needsInspection', r6c.method === 'llm' && r6c.needsInspection === true);

  // ── 캐시 주입: get 히트 → 게이트/LLM 건너뜀 ──
  const cached = { detected: true, unitType: 'ml' as const, unitAmount: 99, unitCount: 1, totalAmount: 99, promoType: 'none' as const, confidence: 'high' as const, evidence: 'cached', method: 'llm' as const, heterogeneous: false, route: 'needs-llm' as const };
  let llmCalledDespiteCache = false;
  const hitCache = { get: async () => cached, set: async () => {} };
  const r7 = await parsePackage('아무 제목 세트', CTX(), async () => { llmCalledDespiteCache = true; return null; }, hitCache);
  check('parsePackage cache hit → returns cached, no LLM call', r7.unitAmount === 99 && r7.method === 'llm' && !llmCalledDespiteCache);

  // ── 캐시 miss + LLM 채택 → set 호출 / 게이트(자명)는 set 안 함 ──
  const setKeys: string[] = [];
  const recCache = { get: async () => null, set: async (t: string) => { setKeys.push(t); } };
  await parsePackage('센카 폼클렌징 120ml 2개', CTX(), undefined, recCache); // 게이트 multipack → method regex
  await parsePackage('에스쁘아 커버쿠션 15g 본품+리필', CTX({ volumeMl: 15 }), stubBundle, recCache); // llm 채택
  check('parsePackage caches LLM result only (not gate)', setKeys.length === 1 && setKeys[0].includes('본품+리필'));

  console.log(log.join('\n'));
  console.log(failed ? '\n✗ FAILED' : '\n✓ ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
