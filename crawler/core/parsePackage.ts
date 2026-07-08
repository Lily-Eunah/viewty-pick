/**
 * parsePackage — 제목 구성 파싱의 단일 진입점 (regex fast-path + LLM 폴백).
 *
 * 설계: docs/title-parsing-llm-hybrid-design.md
 *   1) Triviality gate(analyzeGate)로 ①신호없는 단품 / ②깨끗한 멀티팩 / ③시트 매수 를
 *      regex로 결정적으로 처리한다(LLM 미호출).
 *   2) 그 외(needs-llm)는 주입된 llmExtract로 LLM 추출 → titleParseGuards로 검증 → 채택.
 *   3) LLM 불가/검증 실패 → 기존 extractPackageFromTitle 결과를 쓰되 confidence=low +
 *      needsInspection=true (절대 sync를 실패시키지 않음).
 *
 * 기존 packageExtractor.ts(=regex 엔진)는 그대로 두고, 이 모듈을 옆에 붙여 shadow 비교한다.
 * LLM은 의존성 주입(llmExtract)이라 테스트/하베스트에서 모킹으로 결정적으로 돌릴 수 있다.
 */
import {
  PackageExtractionResult,
  extractPackageFromTitle,
  stripPromoGifts,
} from './packageExtractor';
import { applyTitleParseGuards } from './titleParseGuards';
import type { LlmTitleResult } from './titleParseGuards';

export type ParseRoute = 'trivial-single' | 'clean-multipack' | 'sheet' | 'needs-llm';

export interface ParseContext {
  volumeMl: number | null;
  volumeUnit?: string | null; // 'ml' | 'g' | '매'
  productName?: string | null;
  brand?: string | null;
}

export interface ParsePackageResult extends PackageExtractionResult {
  route: ParseRoute;
  needsInspection?: boolean;
  gifts?: { name?: string; volume?: number | null; unit?: string | null }[];
  llmRaw?: unknown; // shadow 디버깅용 (원본 LLM 응답)
}

export type LlmExtractFn = (title: string, ctx: ParseContext) => Promise<LlmTitleResult | null>;

/**
 * 영속 파싱 캐시(선택 주입). 조회 우선순위는 구현 책임(manual > llm[같은 prompt_version]).
 * get 히트면 LLM/게이트를 건너뛰고 그대로 반환 → "제목 변경 시에만 호출"로 쿼터 보호.
 */
export interface ParseCache {
  get(title: string): Promise<ParsePackageResult | null>;
  set(title: string, result: ParsePackageResult): Promise<void>;
}

// 제품 form noun(카운트가 본품에 붙었는지 판정하는 allowlist). 길이순 무관(endsWith).
const FORM_NOUNS = [
  '올인원', '선크림', '선스틱', '선세럼', '선쿠션', '선밤', '클렌징폼', '클렌징오일', '클렌징젤',
  '클렌저', '클렌징', '에멀전', '쿠션', '크림', '로션', '세럼', '앰플', '에센스', '토너', '스킨',
  '미스트', '오일', '젤', '폼', '밤', '패드', '마스크', '파우더', '스틱',
];
// 시트류 제품 form(매수가 곧 제품 단위) — ③ 시트 route 판정.
const SHEET_FORMS = ['마스크팩', '마스크', '패드', '시트', '팩'];
// 비-form 부속 명사(여기에 붙은 카운트는 본품 수량 아님 → LLM).
const ACCESSORY_NOUNS = ['퍼프', '파우치', '거울', '케이스', '스펀지', '스폰지', '브러시', '면봉', '티슈', '쇼핑백'];

/** 게이트 판정 + (비-LLM 라우트일 때) 파싱된 개수/용량. */
interface GateResult {
  route: ParseRoute;
  unitType: PackageExtractionResult['unitType'];
  unitAmount: number | null;
  unitCount: number;
  evidence: string;
  reason: string; // needs-llm 사유(로그/디버깅)
}

/** gift를 떼고 SPF/PA/연도/긴숫자를 제거한, 게이트 판정용 정제 제목. */
function cleanForGate(title: string): string {
  return stripPromoGifts(title || '')
    .replace(/SPF\s*\d+\+*/gi, ' ')
    .replace(/PA\s*\++/gi, ' ')
    .replace(/\b20\d{2}년?/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function needsLlm(reason: string): GateResult {
  return { route: 'needs-llm', unitType: 'unknown', unitAmount: null, unitCount: 1, evidence: '', reason };
}

/**
 * Triviality gate (docs §3-1). 정제 제목 위에서 신호 구조만으로 라우트를 정한다.
 * "인접" = 콤마·공백을 건너뛴 직전 의미 토큰. 카운트 귀속(allowlist) = 직전이 용량/form noun/본품.
 */
export function analyzeGate(title: string, ctx: ParseContext): GateResult {
  const t = cleanForGate(title);
  if (!t) return { route: 'trivial-single', unitType: 'unknown', unitAmount: null, unitCount: 1, evidence: '', reason: '' };

  // 탈락 신호: 결합(+) / 세트·증정 키워드 / 잔여 괄호·대괄호.
  if (/\+/.test(t)) return needsLlm('plus combiner');
  if (/세트|기획|패키지|콜렉션|컬렉션|기프트|더블|증정|사은품|샘플|리필|본품|종/.test(t)) return needsLlm('set/gift keyword');
  if (/[()[\]]/.test(t)) return needsLlm('paren/bracket content');

  const vols = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(ml|g)\b/gi)];
  if (vols.length >= 2) return needsLlm('multiple volume tokens');
  const vol0 = vols[0] ? { amt: parseFloat(vols[0][1]), unit: vols[0][2].toLowerCase() as 'ml' | 'g' } : null;
  if (vol0 && (vol0.amt < 1 || vol0.amt > 1000)) return needsLlm('volume out of range');

  // 배수: 용량 × N (용량 인접 필수).
  const mult = t.match(/(\d+(?:\.\d+)?)\s*(ml|g)\s*[,\s]*[xX*×]\s*(\d+)\b/);
  const countMatches = [...t.matchAll(/(\d+)\s*(개|입|팩|병|매|장)/g)];
  if (mult) {
    if (countMatches.length > 0) return needsLlm('multiplier + count token (ambiguous)');
    const m = parseInt(mult[3], 10);
    if (m < 1 || m > 20) return needsLlm('multiplier out of range');
    return { route: 'clean-multipack', unitType: mult[2].toLowerCase() as 'ml' | 'g', unitAmount: parseFloat(mult[1]), unitCount: m, evidence: mult[0], reason: '' };
  }

  if (countMatches.length >= 2) return needsLlm('multiple count tokens');

  if (countMatches.length === 1) {
    const cm = countMatches[0];
    const M = parseInt(cm[1], 10);
    const suffix = cm[2];
    const before = t.slice(0, cm.index!).replace(/[\s,]+$/, '');
    if (ACCESSORY_NOUNS.some((a) => before.endsWith(a))) return needsLlm('count attached to accessory');

    if (suffix === '매' || suffix === '장') {
      const sheetByUnit = (ctx.volumeUnit || '') === '매';
      const sheetByForm = SHEET_FORMS.some((f) => before.endsWith(f));
      const sheetByName = SHEET_FORMS.some((f) => (ctx.productName || '').replace(/\s+/g, '').includes(f));
      if ((sheetByUnit || sheetByForm || sheetByName) && M >= 1 && M <= 300) {
        return { route: 'sheet', unitType: 'sheet', unitAmount: vol0 ? vol0.amt : null, unitCount: M, evidence: cm[0], reason: '' };
      }
      return needsLlm('매/장 on non-sheet product (likely accessory)');
    }

    // 개/입/팩/병 — 귀속 규칙(allowlist): 직전이 용량 또는 form noun/본품.
    if (M < 1 || M > 20) return needsLlm('count out of range');
    const volAdjacent = /(\d+(?:\.\d+)?)\s*(ml|g)$/i.test(before);
    const formAdjacent = before.endsWith('본품') || FORM_NOUNS.some((f) => before.endsWith(f));
    if (volAdjacent || formAdjacent) {
      const unitType: PackageExtractionResult['unitType'] = vol0 ? vol0.unit : 'count';
      return { route: 'clean-multipack', unitType, unitAmount: vol0 ? vol0.amt : null, unitCount: M, evidence: cm[0], reason: '' };
    }
    return needsLlm('count not attached to product (no volume/form noun before)');
  }

  // 카운트 토큰 없음 → 단품.
  if (vol0) return { route: 'trivial-single', unitType: vol0.unit, unitAmount: vol0.amt, unitCount: 1, evidence: vols[0][0], reason: '' };
  return { route: 'trivial-single', unitType: 'unknown', unitAmount: null, unitCount: 1, evidence: '', reason: '' };
}

function fromGate(g: GateResult): ParsePackageResult {
  return {
    detected: true,
    unitType: g.unitType,
    unitAmount: g.unitAmount,
    unitCount: g.unitCount,
    totalAmount: g.unitAmount != null ? g.unitAmount * g.unitCount : null,
    promoType: g.unitCount > 1 ? 'bundle' : 'none',
    confidence: 'high',
    evidence: g.evidence || null,
    method: 'regex',
    heterogeneous: false,
    route: g.route,
  };
}

/**
 * §B 검증 통과 판정: LLM이 high-confidence로 comparable single/bundle(이종세트 아님,
 * 검수 불필요)라고 본 경우만 inspection 대신 자동 적용. (medium/low/이종/환각 → 검수 유지.)
 */
export function canAutoApplyVerify(r: ParsePackageResult): boolean {
  return r.method === 'llm' && r.confidence === 'high' && !r.needsInspection && !r.heterogeneous;
}

/**
 * 정준 단위 수량(PR-2, docs §1·§3.2). 어떤 파싱 경로의 결과든 "제품의 정준 단위
 * (product.volume_unit) 좌표계"로 환산하는 단일 관문. normalize는 이 결과만 소비하므로
 * ml 숫자에 매/개 라벨이 붙는 사고가 구조적으로 불가능해진다.
 *
 *  - ml/g: unitSize=용량(ml). 우선순위 = 주입된 ext(high) > 어댑터 parsedVolumeRaw >
 *          제목 regex > DB. (ext가 high면 authoritative — unitAmount=null이어도 DB로만 폴백,
 *          parsedVolumeRaw로 새지 않음.)
 *  - 매/장: unitSize=매수 = DB 정준값(§7-b clean). 제목의 ml은 함량이므로 폐기.
 *  - 개(기기): unitSize=1, unitPriceApplies=false(개당=가격, 단가 라인 없음).
 *  - packCount: 팩 묶음 수(1~20). 시트는 PR-2에서 1로 고정(멀티팩 시트는 PR-3에서 refine).
 *
 * clamp 분리(§3.2): packCount 1~20 / unitSize ml 1~2000 (매수는 DB 신뢰).
 */
export interface CanonicalQuantity {
  unit: string;               // = ctx.volumeUnit || 'ml' (제품 정준 단위)
  unitSize: number | null;    // 판매 1단위 크기 (ml량 / 매수 / 1대)
  packCount: number;          // 팩 묶음 수 (1~20)
  unitPriceApplies: boolean;  // false = 기기(개): 개당==가격이라 단가 라인 없음
  sizeFromListing: boolean;   // ml/g에서 size가 판매처 파싱값(→ mismatch·reliability 신호)
  bundle: boolean;            // packCount>1 또는 bundle promo → 번들 라벨
  evidence: string | null;
  trace: string;              // 판정 근거 1줄(§3.5 디버깅)
}

const inMlRange = (n: number | null | undefined): n is number => n != null && n >= 1 && n <= 2000;
const inCountRange = (n: number | null | undefined): n is number => n != null && n >= 1 && n <= 20;

export function toCanonicalQuantity(
  ext: ParsePackageResult | undefined,
  ctx: ParseContext,
  sourceText?: string | null,
  parsedVolumeRaw?: number | null
): CanonicalQuantity {
  const unit = (ctx.volumeUnit || 'ml').trim() || 'ml';
  const isSheet = unit === '매' || unit === '장' || unit === 'sheet';
  const isDevice = unit === '개';
  const db = ctx.volumeMl;

  const extHigh = !!(ext && ext.detected && ext.confidence === 'high');
  // 개수 판정용 authoritative parse: 주입된 ext(high) 우선.
  // (ParsePackageResult ⊇ PackageExtractionResult 이므로 둘 다 담을 수 있는 상위 타입으로.)
  let countParse: PackageExtractionResult | undefined = extHigh ? ext : undefined;
  let countSrc = extHigh ? ext!.method : '';
  // 제목 regex 재파싱은 **주입된 ext가 아예 없을 때만**(ext === undefined) 한다. ext가 있으나
  // 저신뢰면 게이트/LLM이 그 제목을 의도적으로 불신한 것(세트·증정·본품 등 needs-llm)이므로,
  // 무가드 regex로 되살려 번들 수량(÷N)을 만들면 안 된다. (리뷰 #1)
  if (ext === undefined && !countParse && sourceText) {
    const rx = extractPackageFromTitle(sourceText);
    if (rx.detected && rx.confidence === 'high') {
      countParse = rx;
      countSrc = 'regex(title)';
    }
  }

  // packCount — 시트는 1 고정(PR-2). ml/g·기기는 파싱된 팩 수.
  let packCount = 1;
  if (countParse && !isSheet && inCountRange(countParse.unitCount)) packCount = countParse.unitCount;
  const evidence = countParse?.evidence ?? null;
  const bundle = countParse?.promoType === 'bundle' || packCount > 1;

  let unitSize: number | null;
  let sizeFromListing = false;
  let sizeSrc = 'db';
  if (isDevice) {
    unitSize = 1;
    sizeSrc = 'device';
  } else if (isSheet) {
    unitSize = db != null && db >= 1 ? db : 1; // DB 매수(정준). 제목 ml은 함량 → 폐기.
    sizeSrc = 'db(매)';
  } else if (extHigh) {
    // ext(high)가 authoritative: unitAmount 있으면 그것, 없으면(기기교정·용량없음) DB로만 폴백.
    // unitAmount=null은 "용량 없음" 신호이므로 DB 없을 때 기본 1(옛 `volume_ml || 1` 보존).
    if (inMlRange(ext!.unitAmount)) { unitSize = ext!.unitAmount; sizeFromListing = true; sizeSrc = ext!.method; }
    else { unitSize = db != null && db >= 1 ? db : 1; }
  } else if (inMlRange(parsedVolumeRaw)) {
    unitSize = parsedVolumeRaw; sizeFromListing = true; sizeSrc = 'adapter';
  } else if (countParse && inMlRange(countParse.unitAmount)) {
    unitSize = countParse.unitAmount; sizeFromListing = true; sizeSrc = countSrc;
  } else {
    unitSize = db != null && db >= 1 ? db : 50;
  }

  const t = [`unit=${unit}`, `size=${unitSize}${isSheet ? '매' : isDevice ? '개' : ''}(${sizeSrc})`, `pack=${packCount}`];
  if (evidence) t.push(`ev="${evidence.slice(0, 30)}"`);

  return { unit, unitSize, packCount, unitPriceApplies: !isDevice, sizeFromListing, bundle, evidence, trace: t.join(' ') };
}

/** needs-llm 폴백: 기존 regex 최선 결과 + 저신뢰·검수 플래그. sync를 절대 실패시키지 않는다. */
function regexFallback(title: string): ParsePackageResult {
  return {
    ...extractPackageFromTitle(title),
    method: 'regex',
    confidence: 'low',
    route: 'needs-llm',
    needsInspection: true,
  };
}

/**
 * 단일 진입점. llmExtract 미주입(테스트/키없음) 또는 LLM 실패/검증실패 시 regexFallback.
 */
export async function parsePackage(
  title: string,
  ctx: ParseContext,
  llmExtract?: LlmExtractFn,
  cache?: ParseCache
): Promise<ParsePackageResult> {
  // 캐시 우선(manual 확정 / 같은 prompt_version의 llm) → 0콜 재사용.
  if (cache) {
    try {
      const hit = await cache.get(title);
      if (hit) return hit;
    } catch {
      /* 캐시 장애는 무시하고 계속 */
    }
  }

  const g = analyzeGate(title, ctx);
  let result: ParsePackageResult;
  if (g.route !== 'needs-llm') {
    result = fromGate(g);
    // Apply unit guards on gate outcomes (same logic as applyTitleParseGuards)
    if (ctx.volumeUnit === '개') {
      if (result.unitType === 'ml' || result.unitType === 'g') {
        result.unitAmount = null;
        result.unitType = 'count';
        result.totalAmount = null;
        result.needsInspection = true;
      }
    } else if (ctx.volumeUnit === '매' || ctx.volumeUnit === 'sheet') {
      if (result.unitType === 'ml' || result.unitType === 'g') {
        result.unitAmount = null;
        result.unitType = 'sheet';
        result.totalAmount = null;
        result.needsInspection = true;
      }
    }
  } else if (!llmExtract) {
    result = regexFallback(title);
  } else {
    let llm: LlmTitleResult | null = null;
    try {
      llm = await llmExtract(title, ctx);
    } catch {
      llm = null;
    }
    result = llm ? applyTitleParseGuards(llm, title, ctx) ?? regexFallback(title) : regexFallback(title);
  }

  // LLM 확정 결과만 캐시(게이트는 재계산이 공짜, 폴백은 일시적이라 재시도 위해 캐시 안 함).
  if (cache && result.method === 'llm') {
    try {
      await cache.set(title, result);
    } catch {
      /* best-effort */
    }
  }
  return result;
}
