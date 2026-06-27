/**
 * titleParseGuards — LLM 제목 추출 결과를 "그대로 믿지 않고" 검증해 채택/기각한다.
 * 설계 §5. 결정성·안전은 여기(코드)가 책임지고, LLM은 의미 라벨만 제공한다.
 *
 *  - 범위 clamp: count 1~20(시트 1~300), volume 1~1000.
 *  - 근거 교차검증: main_count>1 인데 제목에 카운트/배수/세트 신호가 전무하면 환각 → 기각(null).
 *  - 증정(gifts) 용량은 본품 용량/개수에서 항상 제외(코드가 강제; main_unit_volume만 사용).
 *  - per_unit_computable=false / 이종세트 / confidence=low → needsInspection.
 *
 * 기각(null) 시 caller(parsePackage)는 regexFallback으로 떨어진다.
 */
import type { ParseContext, ParsePackageResult } from './parsePackage';

export interface LlmTitleResult {
  composition: 'single' | 'homogeneous_bundle' | 'heterogeneous_set' | 'option_select';
  main_unit_volume?: number | null;
  main_unit?: 'ml' | 'g' | 'sheet' | null;
  main_count: number;
  gifts?: { name?: string; volume?: number | null; unit?: string | null; reason?: string | null }[];
  per_unit_computable: boolean;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

const norm = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '');

/** main_count>1 의 근거가 제목에 실제로 있는지(환각 차단). */
function countHasEvidence(title: string): boolean {
  const t = title || '';
  return (
    /\+/.test(t) ||
    /\d+\s*(개|입|팩|병|매|장)/.test(t) ||
    /[xX*×]\s*\d+/.test(t) ||
    /\d+\s*종/.test(t) ||
    /리필|본품|더블/.test(t)
  );
}

export function applyTitleParseGuards(
  llm: LlmTitleResult,
  title: string,
  _ctx: ParseContext
): ParsePackageResult | null {
  if (!llm || typeof llm !== 'object') return null;

  // --- count clamp ---
  const isSheet = llm.main_unit === 'sheet';
  const maxCount = isSheet ? 300 : 20;
  let count = Number(llm.main_count);
  if (!Number.isFinite(count)) return null;
  count = Math.round(count);
  if (count < 1 || count > maxCount) return null;

  // --- volume clamp (out of range → null, 본품 용량 미상으로 처리; 기각까지는 아님) ---
  let volume: number | null = llm.main_unit_volume == null ? null : Number(llm.main_unit_volume);
  if (volume != null && (!Number.isFinite(volume) || volume < 1 || volume > 2000)) volume = null;

  // --- 용량 환각 차단: 제목에 어떤 용량/규격 숫자(ml/g/매/장/L)도 없으면 LLM이 만든
  //     용량은 신뢰 불가 → null(→ 다운스트림 DB 용량 폴백) + 검수. (합산값 102처럼 제목에
  //     숫자가 있으면 영향 없음.) ───────────────────────────────────────────────
  const titleHasSizeToken = /\d+(?:\.\d+)?\s*(?:ml|g|매|장|l)\b/i.test(title);
  let volumeHallucinated = false;
  if (volume != null && !titleHasSizeToken) {
    volume = null;
    volumeHallucinated = true;
  }

  // --- 근거 교차검증: 다수 개수 주장엔 제목 신호가 있어야 한다 ---
  if (count > 1 && !countHasEvidence(title)) return null;

  // --- evidence substring 약검증(있으면 일부라도 제목에 존재해야) ---
  if (llm.evidence && llm.evidence.length >= 2) {
    const ev = norm(llm.evidence).replace(/[()[\]+,/]/g, '');
    const nt = norm(title);
    // 숫자/단위 토큰 하나라도 제목에 있으면 통과(문구 전체 일치는 요구하지 않음).
    const tokens = ev.match(/\d+(?:\.\d+)?(?:ml|g|매|개|입|팩|병)?|리필|본품|세트|기획/g) || [];
    if (tokens.length > 0 && !tokens.some((tok) => nt.includes(tok))) return null;
  }

  // --- composition 매핑 ---
  const heterogeneous = llm.composition === 'heterogeneous_set';
  let promoType: ParsePackageResult['promoType'];
  switch (llm.composition) {
    case 'homogeneous_bundle':
      promoType = 'bundle';
      break;
    case 'heterogeneous_set':
      promoType = 'set';
      break;
    default: // single | option_select
      promoType = 'none';
  }
  if (llm.composition === 'option_select' || llm.composition === 'single') count = Math.max(1, count);

  // 자동 노출은 high-confidence만. medium/low(구성 모호) · 이종세트 · per-unit 불가 ·
  // 용량 환각 → prefill 검수로(조용한 기본값 노출 방지). 표기 없는 정상 단품은 프롬프트가
  // high로 두므로 여기서 검수로 새지 않는다.
  const needsInspection =
    heterogeneous || llm.per_unit_computable === false || llm.confidence !== 'high' || volumeHallucinated;

  const unitType: ParsePackageResult['unitType'] = heterogeneous
    ? 'unknown'
    : llm.main_unit ?? (volume != null ? 'ml' : 'count');

  return {
    detected: true,
    unitType,
    unitAmount: heterogeneous ? null : volume,
    unitCount: heterogeneous ? null : count,
    totalAmount: !heterogeneous && volume != null ? volume * count : null,
    promoType,
    confidence: llm.confidence,
    evidence: llm.evidence || null,
    method: 'llm',
    heterogeneous,
    route: 'needs-llm',
    needsInspection,
    gifts: llm.gifts,
    llmRaw: llm,
  };
}
