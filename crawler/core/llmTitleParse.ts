/**
 * llmTitleParse — Gemini로 제목에서 본품 개수/용량/구성/증정을 구조화 추출한다.
 * 설계 §4·§6·§9. REST(fetch) 직접 호출이라 SDK 의존성 추가 없음(naver/coupang 어댑터와 동일 패턴).
 *
 *  - temperature=0 + responseSchema 강제(자유 텍스트 금지) → 결정성.
 *  - mock/test/키없음 → null(=parsePackage가 regex 폴백). sync를 절대 실패시키지 않는다.
 *  - 제목별 in-memory 캐시(per-process). 동일 제목 재호출 금지.
 *
 * 환경: GEMINI_API_KEY (필수), GEMINI_MODEL(기본 gemini-2.5-flash-lite).
 */
import type { LlmExtractFn } from './parsePackage';
import type { LlmTitleResult } from './titleParseGuards';

// 기본 = non-thinking + 구조화 출력(responseSchema) 지원 + 무료 쿼터 여유 확인된 모델.
// (gemini-2.5-flash-lite는 당일 429/503 빈번, Gemma는 thinking형이라 구조화 부적합 — worklog 참조.)
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
// Gemma 오픈모델은 Gemini API에서 systemInstruction/responseSchema(구조화 JSON)를
// 지원하지 않는다 → system을 user 프롬프트에 합치고, 응답 텍스트에서 JSON을 직접 추출한다.
const IS_GEMMA = MODEL.toLowerCase().startsWith('gemma');

/** ```json 펜스/잡문을 걷어내고 첫 번째 { … } 객체를 파싱(Gemma 자유텍스트 대비). */
function extractJson<T>(text: string): T | null {
  if (!text) return null;
  let s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(s) as T;
  } catch {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function isMock(): boolean {
  return (
    process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
    process.env.CRAWLER_MODE === 'mock' ||
    process.env.NODE_ENV === 'test'
  );
}

// 프롬프트 정책 버전 — 변경 시 bump(영속 캐시 무효화 키).
// v2 = 동일제품 보너스 합산. v3 = 소량 샘플 sachet은 합산 제외(샘플로 둠).
export const LLM_PROMPT_VERSION = 'v3-sample-exclude';

const SYSTEM = [
  '너는 한국 화장품 판매 제목에서 "본품"의 용량/개수/구성을 추출한다.',
  '핵심 판별 — 추가/증정이 "본품과 같은 제품이냐":',
  '- 같은 제품 추가(리필 · +N매 · 1+1 · 동일 제품 추가증정 · 동일용량 A+A)는 본품에 **합산**한다.',
  '    · 개수로 세는 게 자연스러우면 main_count↑ (예: 1+1, 본품+리필 → main_count=2).',
  '    · 용량/매수로 합치는 게 자연스러우면 main_unit_volume에 **더한다** (예: 90매+12매 → 102, 100ml+동일50ml증정 → 150). 이때 main_count=1.',
  '    · 어느 쪽이든 per_unit_computable=true (받는 총량 기준으로 단가 계산).',
  '    · 단, 본품보다 현저히 작은 소량 샘플/사셰(예: 7ml*2, 10ml 미만 증정, 미니·트래블·파우치 표기)는 같은 제품이라도 합산하지 않고 gifts로 둔다. "리필 · +대용량(수십 ml) · +N매 · 1+1" 같은 정상 추가분만 합산.',
  '- 다른 품목(퍼프·파우치·거울·케이스·쇼핑백·미니어처·다른 제품 샘플)은 gifts로 분리하고 본품 용량/개수에 포함하지 않는다.',
  '규칙:',
  '- "N종 중 택1"(옵션선택)은 실구매가 단품이므로 composition=option_select, main_count=1.',
  '- "세트/패키지/콜렉션/기프트"로 서로 다른 제품을 묶은 것은 heterogeneous_set, per_unit_computable=false.',
  '- 단품은 single, main_count=1. main_unit_volume/main_unit 은 본품 1개의 용량(미표기면 null).',
  '- evidence 에는 판단 근거가 된 제목 substring을 적는다.',
  '예시:',
  '  "에스쁘아 비벨벳 커버쿠션 15g 본품+리필" → {composition:"homogeneous_bundle", main_unit_volume:15, main_unit:"g", main_count:2, gifts:[], per_unit_computable:true, confidence:"high", evidence:"본품+리필"}',
  '  "더랩바이블랑두 패드 90매 기획 (+12매)" → {composition:"homogeneous_bundle", main_unit_volume:102, main_unit:"sheet", main_count:1, gifts:[], per_unit_computable:true, confidence:"high", evidence:"90매 (+12매)"}  // 동일 패드 추가 → 합산 102매',
  '  "[퍼프 3매 추가 증정 기획] 에스쁘아 세범컷 쿨링 쿠션 15.8g" → {composition:"single", main_unit_volume:15.8, main_unit:"g", main_count:1, gifts:[{name:"퍼프",volume:null,unit:"매",reason:"증정"}], per_unit_computable:true, confidence:"high", evidence:"쿠션 15.8g"}  // 퍼프=다른품목 제외',
  '  "토너 100ml (+앰플 10ml 증정)" → {composition:"single", main_unit_volume:100, main_unit:"ml", main_count:1, gifts:[{name:"앰플",volume:10,unit:"ml",reason:"증정"}], per_unit_computable:true, confidence:"high", evidence:"토너 100ml"}  // 앰플=다른품목 제외',
  '  "유세린 에피셀린 세럼 30ml 기획 (+에피셀린 세럼 7ml*2)" → {composition:"single", main_unit_volume:30, main_unit:"ml", main_count:1, gifts:[{name:"에피셀린 세럼",volume:7,unit:"ml",reason:"샘플"}], per_unit_computable:true, confidence:"high", evidence:"세럼 30ml"}  // 동일제품이라도 7ml 소량샘플 → 합산X',
  '  "세럼 30ml 1+1" → {composition:"homogeneous_bundle", main_unit_volume:30, main_unit:"ml", main_count:2, gifts:[], per_unit_computable:true, confidence:"high", evidence:"1+1"}',
  '  "롬앤 글래스팅 쿠션 2종 택1" → {composition:"option_select", main_unit_volume:null, main_unit:null, main_count:1, gifts:[], per_unit_computable:true, confidence:"medium", evidence:"2종 택1"}',
  '  "제니피끄 세럼 2종 세트" → {composition:"heterogeneous_set", main_unit_volume:null, main_unit:null, main_count:1, gifts:[], per_unit_computable:false, confidence:"high", evidence:"2종 세트"}',
  '  "토너 75ml + 세럼 35ml" → {composition:"heterogeneous_set", main_unit_volume:null, main_unit:null, main_count:1, gifts:[], per_unit_computable:false, confidence:"high", evidence:"토너 75ml + 세럼 35ml"}',
  '  "마스크팩 70매" → {composition:"single", main_unit_volume:70, main_unit:"sheet", main_count:1, gifts:[], per_unit_computable:true, confidence:"high", evidence:"70매"}',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    composition: { type: 'STRING', enum: ['single', 'homogeneous_bundle', 'heterogeneous_set', 'option_select'] },
    main_unit_volume: { type: 'NUMBER', nullable: true },
    main_unit: { type: 'STRING', enum: ['ml', 'g', 'sheet'], nullable: true },
    main_count: { type: 'INTEGER' },
    gifts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', nullable: true },
          volume: { type: 'NUMBER', nullable: true },
          unit: { type: 'STRING', nullable: true },
          reason: { type: 'STRING', nullable: true },
        },
      },
    },
    per_unit_computable: { type: 'BOOLEAN' },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    evidence: { type: 'STRING' },
  },
  required: ['composition', 'main_count', 'per_unit_computable', 'confidence', 'evidence'],
} as const;

const cache = new Map<string, LlmTitleResult | null>();

/** parsePackage에 주입할 LLM 추출 함수. 실패/불가 시 null. */
export const llmExtractTitle: LlmExtractFn = async (title, ctx) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || isMock() || !title) return null;

  const cacheKey = `${MODEL}|${title}|${ctx.volumeMl ?? ''}|${ctx.volumeUnit ?? ''}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const userPrompt = [
    `제목: ${title}`,
    ctx.brand ? `브랜드(참고): ${ctx.brand}` : '',
    ctx.productName ? `큐레이션 제품명(참고): ${ctx.productName}` : '',
    ctx.volumeMl != null ? `DB 본품 용량(참고): ${ctx.volumeMl}${ctx.volumeUnit || 'ml'}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const body = IS_GEMMA
    ? JSON.stringify({
        // Gemma: system 미지원 → user에 합치고, 스키마 대신 "JSON만" 지시.
        contents: [{ role: 'user', parts: [{ text: `${SYSTEM}\n\n${userPrompt}\n\n위 제목을 분석해 아래 형식의 JSON 객체 하나만 출력하라(설명·코드펜스 금지):\n{"composition","main_unit_volume","main_unit","main_count","gifts","per_unit_computable","confidence","evidence"}` }] }],
        // Gemma는 thinking 성향 → 추론 후 끝에 JSON을 emit하므로 토큰 여유 필요(extractJson이 후미 {…} 회수).
        generationConfig: { temperature: 0, maxOutputTokens: 2048 },
      })
    : JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  // 429(쿼터)/503(과부하)/5xx는 백오프 재시도. 그 외 오류는 즉시 null(=regex 폴백).
  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const json = await res.json();
        const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          cache.set(cacheKey, null);
          return null;
        }
        const parsed = extractJson<LlmTitleResult>(text);
        cache.set(cacheKey, parsed);
        return parsed;
      }
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < MAX_ATTEMPTS) {
        const backoff = 2000 * attempt + Math.floor(Math.random() * 1000); // 2~3s, 4~5s
        console.warn(`[llmTitleParse] HTTP ${res.status} — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${backoff}ms ("${title.slice(0, 32)}")`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      console.warn(`[llmTitleParse] HTTP ${res.status} (giving up) for "${title.slice(0, 40)}"`);
      cache.set(cacheKey, null);
      return null;
    } catch (e) {
      if (attempt < MAX_ATTEMPTS) {
        const backoff = 2000 * attempt;
        console.warn(`[llmTitleParse] ${(e as Error).message} — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
      console.warn(`[llmTitleParse] failed for "${title.slice(0, 40)}": ${(e as Error).message}`);
      cache.set(cacheKey, null);
      return null;
    }
  }
  cache.set(cacheKey, null);
  return null;
};

export function clearLlmTitleCache(): void {
  cache.clear();
}
