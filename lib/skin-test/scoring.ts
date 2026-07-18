/**
 * 피부타입 테스트 채점 — 축 집계 + 판정 위계.
 *
 * 위계: ① 민감 ON(4/6점 이상)이면 유분 축 우세에 따라 민감건성/민감복합으로 최우선
 * 라우팅(표에 없는 민감지성·민감중성 조합도 여기로 수렴) ② 민감 OFF면 유분 베이스에
 * 수분부족 ON(3/4점 이상)을 분기(지성→수부지, 중성→수분부족 중성). 건성·복합은
 * 수분 여부와 무관하게 단일 결과(수분 신호는 결과 카피에서만 언급).
 */
import {
  BONUS_QUESTION,
  BonusAnswer,
  BaseKey,
  OilAxis,
  QUESTIONS,
  ToppingSlug,
} from './quizData';

export const SENSITIVE_THRESHOLD = 4;
export const WATER_THRESHOLD = 3;

export interface QuizResult {
  base: BaseKey;
  topping: ToppingSlug;
  sensitiveOn: boolean;
  waterOn: boolean;
  /** 수분 2점 — ON은 아니지만 "살짝 속건조 기미" 카피용. */
  waterHint: boolean;
  /** 강한 증상 응답(Q8③·Q9①) → 결과지에 피부과 상담 권고 라인. */
  careAdvised: boolean;
  /** Q10 선택 고민이 앞 문항의 보조 신호와 일치 → 정합성 멘트. */
  hintMatched: boolean;
  /** 보너스 문항 "최근 몇 달 사이" → 일시적 장벽 손상 가능성 카피. */
  recentSensitive: boolean;
  scores: { oil: Record<OilAxis, number>; water: number; sensitive: number };
}

/** 유분 축 동점 규칙: 복합 포함/건·지 대립이면 복합, 중성이 끼면 신호 있는 쪽. */
export function resolveOilWinner(oil: Record<OilAxis, number>): OilAxis {
  const max = Math.max(oil.dry, oil.combo, oil.normal, oil.oily);
  const top = (Object.keys(oil) as OilAxis[]).filter((a) => oil[a] === max);
  if (top.length === 1) return top[0];
  if (top.includes('combo')) return 'combo';
  if (top.includes('dry') && top.includes('oily')) return 'combo';
  return top.find((a) => a !== 'normal') ?? 'normal';
}

/**
 * @param picks 문항별 선택지 인덱스(0-based), QUESTIONS 순서와 동일한 길이 10.
 * @param bonus 민감 ON일 때만 물은 보너스 응답(없으면 null).
 */
export function computeResult(picks: number[], bonus: BonusAnswer | null = null): QuizResult {
  if (picks.length !== QUESTIONS.length) {
    throw new Error(`answers length ${picks.length} !== ${QUESTIONS.length}`);
  }

  const oil: Record<OilAxis, number> = { dry: 0, combo: 0, normal: 0, oily: 0 };
  let water = 0;
  let sensitive = 0;
  let careAdvised = false;
  let topping: ToppingSlug = 'none';
  const hints = new Set<string>();

  QUESTIONS.forEach((q, i) => {
    const opt = q.options[picks[i]];
    if (!opt) throw new Error(`question ${q.id}: no option at index ${picks[i]}`);
    const e = opt.effect;
    if (e.oil) for (const [axis, pts] of Object.entries(e.oil)) oil[axis as OilAxis] += pts;
    if (e.water) water += e.water;
    if (e.sensitive) sensitive += e.sensitive;
    if (e.care) careAdvised = true;
    if (e.hint) hints.add(e.hint);
    if (opt.topping) topping = opt.topping;
  });

  const sensitiveOn = sensitive >= SENSITIVE_THRESHOLD;
  const waterOn = water >= WATER_THRESHOLD;
  const winner = resolveOilWinner(oil);

  let base: BaseKey;
  if (sensitiveOn) {
    base = winner === 'dry' || winner === 'normal' ? 'dry-sensitive' : 'combo-sensitive';
  } else if (winner === 'oily') {
    base = waterOn ? 'oily-dehydrated' : 'oily';
  } else if (winner === 'normal') {
    base = waterOn ? 'normal-dehydrated' : 'normal';
  } else {
    base = winner; // 'dry' | 'combo'
  }

  return {
    base,
    topping,
    sensitiveOn,
    waterOn,
    waterHint: !waterOn && water === 2,
    careAdvised,
    hintMatched: topping !== 'none' && hints.has(topping),
    recentSensitive: sensitiveOn && bonus === 'recent',
    scores: { oil, water, sensitive },
  };
}

/** 결과 페이지 경로 — /skin-test/result/[base]/[topping]. */
export function resultPath(base: BaseKey, topping: ToppingSlug): string {
  return `/skin-test/result/${base}/${topping}`;
}

export { BONUS_QUESTION };
