/**
 * parsePackage 게이트 라우팅 + LLM 폴백/검증 테스트 (네트워크 없음).
 * LLM은 모킹(stub)이라 결정적. 설계 docs/title-parsing-llm-hybrid-design.md §3·§5.
 *
 * Run: tsx crawler/core/__tests__/parsePackage.test.ts
 */
import { analyzeGate, parsePackage, canAutoApplyVerify, toCanonicalQuantity } from '../parsePackage';
import type { ParsePackageResult } from '../parsePackage';
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
  // PR-3: 무신호 괄호 스트립 → 마케팅 태그는 제거되고 단품 확정
  { title: '[10% 추가적립] 아로셀 멜라 선세럼 40ml', route: 'trivial-single', count: 1, amount: 40, unitType: 'ml' },
  { title: '[흔적미백]메디큐브 PDRN 토너 250ml', route: 'trivial-single', count: 1, amount: 250, unitType: 'ml' },
  { title: '조선미녀 톤업 선크림 50ml (퍼플/그린)', route: 'trivial-single', count: 1, amount: 50, unitType: 'ml' },
  // 신호 있는 괄호는 유지 → needs-llm
  { title: '바이오던스 크림 50ml 기획 (+10ml)', route: 'needs-llm' },
  // 리뷰 #1: 괄호 안 한글-단위 개수는 신호로 인식되어 유지 → needs-llm (개수 손실 방지)
  { title: '구달 청귤 비타C 잡티세럼 30ml (2개입)', route: 'needs-llm' },
  { title: '메디힐 마스크 (60매)', ctx: { volumeUnit: '매' }, route: 'needs-llm' },
  // PR-3: 매-표준패턴 (매수 + 개, 카운트 2토큰이어도 결정적)
  { title: '비플레인 시카테롤 패드 185ml, 80매입, 1개', ctx: { volumeUnit: '매', volumeMl: 80 }, route: 'sheet', count: 80, unitType: 'sheet' },
  { title: '리얼베리어 크림 마스크 27ml, 10개입, 1개', ctx: { volumeUnit: '매', volumeMl: 10 }, route: 'sheet', count: 10, unitType: 'sheet' },
  // PR-3: ×N개는 배수와 동일 신호 → clean-multipack
  { title: '메디큐브 토너 250ml X 2개', route: 'clean-multipack', count: 2, amount: 250, unitType: 'ml' },
  // PR-3: 역순 카운트+용량
  { title: '아도르 애사비 샴푸 지성용, 1개, 530ml', route: 'clean-multipack', count: 1, amount: 530, unitType: 'ml' },
  // PR-3: L/리터 → ml
  { title: '메디큐브 레드 아크네 바디워시 1L, 1개', route: 'clean-multipack', count: 1, amount: 1000, unitType: 'ml' },
  // PR-3: 리필-제품명(증상 D) → 단품 (리필은 제품명 일부)
  { title: '아이소이 비건 제로 쿠션 리필 (리필) 13g', ctx: { productName: '비건 제로 쿠션 리필', volumeUnit: 'g', volumeMl: 13 }, route: 'trivial-single', count: 1, amount: 13, unitType: 'g' },
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
  // needs-llm으로 보내되(세트 키워드) 카운트/배수 신호는 전무 → 가드가 환각 개수(5)를 기각.
  const r6 = await parsePackage('토너 세트 에디션', CTX(), stubHallucinate);
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

  // ── 엣지 케이스 가드 & 보정 테스트 ──
  // 1) 기기 본품에 화장품 ml 용량이 오독된 경우 교정 (오큐라 티타늄셀 케이스)
  const stubDeviceWithMl = async (): Promise<LlmTitleResult> => ({
    composition: 'single', main_unit_volume: 200, main_unit: 'ml', main_count: 1,
    gifts: [], per_unit_computable: true, confidence: 'high', evidence: '200ml',
  });
  const rEdge1 = await parsePackage(
    '오큐라 티타늄셀 4.0(부스터젤 200ml 2개 포함)',
    CTX({ volumeUnit: '개', volumeMl: null }),
    stubDeviceWithMl
  );
  check(
    'Edge 1: Device(개) with ml volume in LLM -> corrected to volume=null & unitType=count',
    rEdge1.unitAmount === null && rEdge1.unitType === 'count'
  );

  // 2) 시트(매) 본품에 액체 용량 ml이 오독된 경우 교정 (비플레인 패드 케이스)
  const stubSheetWithMl = async (): Promise<LlmTitleResult> => ({
    composition: 'single', main_unit_volume: 185, main_unit: 'ml', main_count: 1,
    gifts: [], per_unit_computable: true, confidence: 'high', evidence: '185ml',
  });
  const rEdge2 = await parsePackage(
    '비플레인 시카테롤 블레미쉬 패드 185ml, 80개입, 1개',
    CTX({ volumeUnit: '매', volumeMl: 80 }),
    stubSheetWithMl
  );
  check(
    'Edge 2: Sheet(매) with ml volume in LLM -> corrected to volume=null (fallback to DB) & unitType=sheet',
    rEdge2.unitAmount === null && rEdge2.unitType === 'sheet'
  );

  // 3) 마스크팩 번들 및 단위 매핑 검증 (리얼베리어 케이스)
  const stubMaskBundle = async (): Promise<LlmTitleResult> => ({
    composition: 'single', main_unit_volume: 27, main_unit: 'ml', main_count: 10,
    gifts: [], per_unit_computable: true, confidence: 'high', evidence: '27ml, 10개입',
  });
  const rEdge3 = await parsePackage(
    '리얼베리어 익스트림 크림 마스크 27ml, 10개입, 1개',
    CTX({ volumeUnit: 'ml', volumeMl: 27 }),
    stubMaskBundle
  );
  check(
    'Edge 3: Bundle mask 27ml 10-pack -> unitAmount=27 & unitCount=10',
    rEdge3.unitAmount === 27 && rEdge3.unitCount === 10
  );

  // ── 캐시 miss + LLM 채택 → set 호출 / 게이트(자명)는 set 안 함 ──
  const setKeys: string[] = [];
  const recCache = { get: async () => null, set: async (t: string) => { setKeys.push(t); } };
  await parsePackage('센카 폼클렌징 120ml 2개', CTX(), undefined, recCache); // 게이트 multipack → method regex
  await parsePackage('에스쁘아 커버쿠션 15g 본품+리필', CTX({ volumeMl: 15 }), stubBundle, recCache); // llm 채택
  check('parsePackage caches LLM result only (not gate)', setKeys.length === 1 && setKeys[0].includes('본품+리필'));

  // ── §B canAutoApplyVerify: high LLM single/bundle → 자동 적용, 그 외 → 검수 ──
  const mk = (o: Partial<ParsePackageResult>): ParsePackageResult => ({
    detected: true, unitType: 'ml', unitAmount: 50, unitCount: 1, totalAmount: 50,
    promoType: 'none', confidence: 'high', evidence: 'x', method: 'llm', heterogeneous: false, route: 'needs-llm', ...o,
  });
  check('verify: llm high single → auto-apply', canAutoApplyVerify(mk({})) === true);
  check('verify: medium → no auto', canAutoApplyVerify(mk({ confidence: 'medium' })) === false);
  check('verify: heterogeneous → no auto', canAutoApplyVerify(mk({ heterogeneous: true })) === false);
  check('verify: needsInspection → no auto', canAutoApplyVerify(mk({ needsInspection: true })) === false);
  check('verify: regex method → no auto', canAutoApplyVerify(mk({ method: 'regex' })) === false);

  // ── toCanonicalQuantity (PR-2 정준 단위 관문) ──────────────────────────────
  const cq = (ext: ParsePackageResult | undefined, ctx: Partial<ParseContext>, src?: string | null, pvr?: number | null) =>
    toCanonicalQuantity(ext, CTX(ctx), src, pvr);

  const c1 = cq(mk({ unitAmount: 150, unitCount: 1 }), { volumeMl: 50, volumeUnit: 'ml' });
  check('canonical ml: parsed size 150, pack 1, from-listing', c1.unitSize === 150 && c1.packCount === 1 && c1.sizeFromListing && c1.unitPriceApplies);

  const c2 = cq(undefined, { volumeMl: 50, volumeUnit: 'ml' }, null, 100);
  check('canonical ml: adapter parsedVolumeRaw 100', c2.unitSize === 100 && c2.sizeFromListing);

  const c3 = cq(undefined, { volumeMl: 50, volumeUnit: 'ml' });
  check('canonical ml: DB fallback 50, not from listing', c3.unitSize === 50 && !c3.sizeFromListing);

  const c4 = cq(mk({ unitAmount: 50, unitCount: 2, promoType: 'bundle' }), { volumeMl: 50, volumeUnit: 'ml' });
  check('canonical ml: pack 2 bundle', c4.packCount === 2 && c4.bundle === true);

  const c5 = cq(mk({ unitAmount: 185, unitCount: 1, unitType: 'sheet' }), { volumeMl: 70, volumeUnit: '매' });
  check('canonical 매: DB count 70, discards ml 185', c5.unitSize === 70 && c5.unit === '매' && !c5.sizeFromListing && c5.unitPriceApplies);

  const c6 = cq(undefined, { volumeMl: 70, volumeUnit: '매' }, null, 27);
  check('canonical 매: adapter ml 27 ignored → 70', c6.unitSize === 70 && !c6.sizeFromListing);

  const c7 = cq(undefined, { volumeMl: 1, volumeUnit: '개' }, null, 200);
  check('canonical 개: size 1, no per-unit price', c7.unitSize === 1 && c7.unitPriceApplies === false);

  const c8 = cq(undefined, { volumeMl: 50, volumeUnit: 'ml' }, '토너 100ml 2개');
  check('canonical ml: sourceText regex → size 100 pack 2', c8.unitSize === 100 && c8.packCount === 2);

  // 리뷰 #1: 저신뢰 ext가 주입되면(게이트/LLM이 불신) 제목을 무가드 regex로 재파싱하지 않는다.
  const lowExt = mk({ confidence: 'low', unitAmount: null, unitCount: null, promoType: 'set', route: 'needs-llm' });
  const c9 = cq(lowExt, { volumeMl: 50, volumeUnit: 'ml' }, '토너 100ml + 세럼 30ml 2개');
  check('canonical: distrusted low ext → NOT re-parsed → pack 1, DB size', c9.packCount === 1 && c9.unitSize === 50 && !c9.sizeFromListing);

  console.log(log.join('\n'));
  console.log(failed ? '\n✗ FAILED' : '\n✓ ALL PASSED');
  process.exit(failed ? 1 : 0);
})();
