# 제목 파싱 현황: 규칙(regex) vs LLM 분기 정리

> "어떤 제목이 규칙으로 파싱되고, 어떤 제목이 LLM으로 넘어가는가" 와
> 각 계층이 쓰는 **규칙·프롬프트 기준**을 2026-07-06 코드베이스 기준으로 정리한다.
> 관련 파일: `crawler/core/parsePackage.ts`, `packageExtractor.ts`, `titleParseGuards.ts`,
> `llmTitleParse.ts`, `titleParseCache.ts`, `crawler/run.ts`, `crawler/core/normalize.ts`.

---

## 0. 한눈에 보는 파이프라인

```
run.ts (priced offer마다)
  └─ LLM_TITLE_PARSE=on 이고 키 있음?  ─── 아니오 ──► parsedPackage 미주입
        │ 예                                         └─ normalize가 자체 regex
        ▼                                              (extractPackageFromTitle) 사용
  parsePackage(title, ctx, llmExtractTitle, parseCache)
        │
        ├─ ① 영속 캐시 조회 (title_parse_cache)
        │     manual 확정 → 그대로 반환(0콜)
        │     llm + prompt_version 일치 → 그대로 반환(0콜)
        │
        ├─ ② analyzeGate(title, ctx)  ◄── 규칙 vs LLM 을 가르는 핵심 게이트
        │     route ∈ { trivial-single, clean-multipack, sheet } → **규칙 확정** (LLM 미호출)
        │     route = needs-llm                                    → ③ 로 진행
        │
        └─ ③ llmExtractTitle(title, ctx)  → titleParseGuards 검증
              통과 → 채택(method='llm'),  기각/실패 → regexFallback(=옛 regex + 저신뢰+검수)
```

핵심: **`analyzeGate`가 "규칙으로 확정할지 / LLM에 넘길지"를 단독으로 결정**한다.
LLM은 게이트가 `needs-llm`으로 판정한 "모호·위험" 제목만 처리한다.

---

## 1. 언제 LLM이 아예 안 도는가 (전역 토글)

`crawler/run.ts:213`
```ts
const llmTitleParseOn = process.env.LLM_TITLE_PARSE === 'on' && !mockMode && llmKeyCount() > 0;
```
- `LLM_TITLE_PARSE !== 'on'` / mock / 키 없음 → `offer.parsedPackage`를 **주입하지 않음**(`run.ts:449`).
  이때 `normalize`는 자체적으로 `extractPackageFromTitle`(옛 regex 엔진)만 사용한다(§5-B).
- 현재 `.github/workflows/crawl.yml`에 `LLM_TITLE_PARSE: 'on'` + `GEMINI_API_KEYS` 설정됨 → **운영 크롤은 LLM on.**
- 로컬/테스트/`--test`(mock)는 항상 LLM off → 규칙만.

---

## 2. 캐시 계층 (LLM 호출 전 단락) — `titleParseCache.ts`

`title_parse_cache` 테이블(migration 0018). 조회 우선순위:
1. `source='manual'` (검수 O 확정) → **항상 사용**, 규칙·LLM 무시.
2. `source='llm'` **AND** `prompt_version === LLM_PROMPT_VERSION` → 재사용(0콜).
3. 미스/stale(프롬프트 버전 불일치) → null → 게이트·LLM 진행.

- 캐시 히트면 게이트조차 재계산 안 함 → "**제목이 바뀔 때만 LLM 호출**"로 무료 쿼터 보호.
- 프롬프트 버전(`LLM_PROMPT_VERSION`)을 bump하면 기존 llm 캐시가 전부 stale → 재파싱.
  (현재 `v6-volume-unit-constraint`.)
- 검수 O 확정 파싱은 `setManualParse`로 manual 고정 → 이후 규칙/LLM이 못 덮음.

---

## 3. 규칙 vs LLM 분기표 — `analyzeGate` (parsePackage.ts:89-146)

게이트는 제목을 `cleanForGate`(증정 strip + SPF/PA/연도/긴숫자 제거)한 뒤,
**신호 구조만으로** 라우트를 정한다. "인접" = 콤마·공백 건너뛴 직전 의미 토큰.

### 3.1 규칙으로 확정되는 경우 (LLM 미호출)

| route | 조건 | 결과(method='regex', confidence='high') |
|-------|------|------|
| `trivial-single` | 카운트 토큰 없음 + 용량 0~1개 | 단품 1개 (용량 있으면 그 값, 없으면 null) |
| `clean-multipack` | `용량 ml/g × N` 배수 (용량 인접, 카운트토큰 없음, N 1~20) | 용량 × N 번들 |
| `clean-multipack` | 카운트 토큰 **정확히 1개**이고 직전이 **용량 or form noun/본품** (개/입/팩/병, M 1~20) | 그 개수 번들 |
| `sheet` | `N매/장` + 시트 컨텍스트(`volumeUnit='매'` or form noun `마스크/팩/패드/시트` or 제품명에 시트어) (M 1~300) | 매수 시트 |

`FORM_NOUNS` = 선크림·쿠션·크림·로션·세럼·토너·앰플·패드·마스크 등 (parsePackage.ts:50-54).
`SHEET_FORMS` = 마스크팩·마스크·패드·시트·팩.

### 3.2 LLM으로 넘어가는 경우 (`needs-llm`)

`analyzeGate`가 아래 **탈락 신호** 중 하나라도 만나면 즉시 `needs-llm`:

| 사유(코드 reason) | 트리거 |
|---|---|
| `plus combiner` | 제목에 `+` 존재 (본품+리필, 50ml+50ml, 1+1 …) |
| `set/gift keyword` | 세트·기획·패키지·콜렉션·컬렉션·기프트·더블·증정·사은품·샘플·**리필·본품·종** |
| `paren/bracket content` | 증정 strip 후에도 남은 `( ) [ ]` |
| `multiple volume tokens` | ml/g 용량 토큰 2개 이상 |
| `volume out of range` | 용량 <1 또는 >1000 |
| `multiplier + count token` | 배수(×N)와 카운트(N개)가 **동시** (모호) |
| `multiplier out of range` | 배수 <1 또는 >20 |
| `multiple count tokens` | 카운트 토큰 2개 이상 (예: "80매입, 1개") |
| `count attached to accessory` | 카운트 직전이 부속명사(퍼프·파우치·거울·케이스·스펀지·브러시·면봉·티슈·쇼핑백) |
| `매/장 on non-sheet product` | `N매/장`인데 시트 컨텍스트 아님 → 부속(퍼프 3매 등) 의심 |
| `count out of range` | 개/입/팩/병 카운트 <1 또는 >20 |
| `count not attached to product` | 카운트 직전이 용량도 form noun도 아님 |

→ 요약: **결합(+)·세트/증정/리필·복수 토큰·부속 인접·비인접·범위이탈**은 전부 LLM.
"깨끗한 단품 / 깨끗한 ×N / 정상 시트"만 규칙이 확정한다.

### 3.3 규칙 라우트의 후처리 가드 (parsePackage.ts:207-221)

규칙 확정 결과에도 **DB 단위 정합 가드**를 적용:
- `ctx.volumeUnit==='개'` 인데 unitType이 ml/g → 용량 제거, `unitType='count'`, `needsInspection=true`.
- `ctx.volumeUnit==='매'/'sheet'` 인데 ml/g → 용량 제거, `unitType='sheet'`, `needsInspection=true`.

---

## 4. LLM 파싱 기준 — `llmTitleParse.ts` (프롬프트 v6)

### 4.1 호출 방식
- 모델: `GEMINI_MODEL` 기본 **`gemini-3.1-flash-lite`** (non-thinking, 구조화 JSON 지원, 무료쿼터 여유).
- `temperature=0` + `responseSchema` 강제 → 결정성. 자유 텍스트 금지.
- 멀티키(`GEMINI_API_KEYS` 쉼표) 로테이션: 429는 그 키 소진 처리 후 다음 키, 5xx/네트워크는 백오프 재시도(≤3).
  모든 키 소진 → `null`(→ regexFallback=검수) + `llmRunStats.allKeysExhausted`(run.ts가 알람).
- per-process in-memory 캐시(cacheKey = `MODEL|title|volumeMl|volumeUnit`).

### 4.2 SYSTEM 프롬프트 판별 규칙 (요지)
1. **합산 vs 분리 (본품과 같은 제품인가):**
   - 같은 제품 추가(리필·+N매·1+1·동일용량 A+A)는 **본품에 합산**.
     · 개수로 세면 `main_count↑`(1+1, 본품+리필 → 2). · 용량/매수로 합치면 `main_unit_volume`에 **더함**(90매+12매→102, main_count=1).
   - **소량 샘플/사셰**(7ml*2, 10ml 미만 증정, 미니·트래블·파우치)는 같은 제품이라도 **gifts로 분리**.
   - 다른 품목(퍼프·파우치·거울·케이스·쇼핑백·미니어처·타제품 샘플)은 **gifts 분리**, 본품에 미포함.
2. **구성 분류:** `N종 택1`→`option_select`(main_count=1). `세트/패키지/콜렉션/기프트`로 다른 제품 묶음→`heterogeneous_set`(per_unit_computable=false). 단품→`single`.
3. **제품명 숫자/접미사 예외:** 큐레이션 `productName` 자체에 `X2/2종/3종`이 들어있고 제목과 매칭되면 그건 제품명 일부(배수 아님) → 다른 번들표시 없으면 단품.
4. **DB 본품 단위 제약 (v6 신규 — §용량혼동 대응):**
   - `DB 단위=매/sheet`: 제목의 `ml`(185ml)은 에센스 함량일 뿐 → **매수(80매)만 `main_unit_volume`, `main_unit='sheet'`**.
   - `DB 단위=개`(기기): 제목의 `ml/g`(젤 200ml)은 기기 용량 아님 → `main_count=1, main_unit_volume=null`, 동봉 화장품은 gifts.
   - `DB 단위=ml/g`: 제목의 ml/g를 본품 용량으로, 묶음(10개입)이면 `main_count`=총량.
5. **기본값:** 개수 판단 불가 → `main_count=1`. 용량 판단 불가 → `main_unit_volume=null`(시스템이 DB 용량 사용). **없는 용량 지어내기 금지.**
6. **confidence:** "구성 판단의 확신도"(단품/번들/세트·증정분리). 개수·용량 표기가 없다는 이유만으로 낮추지 말 것 — "단품 1개 + 용량 null"도 high. low/medium은 구성 자체가 모호할 때만.

### 4.3 출력 스키마 (`RESPONSE_SCHEMA`)
`composition`(enum) · `main_unit_volume`(nullable) · `main_unit`(ml/g/sheet, nullable) · `main_count`(int) ·
`gifts[]`(name/volume/unit/reason) · `per_unit_computable`(bool) · `confidence`(high/medium/low) · `evidence`(string).

---

## 5. LLM 결과의 채택/기각 가드 — `titleParseGuards.ts`

LLM 응답을 **그대로 믿지 않고** 코드가 검증한다(결정성·안전은 코드 책임).

- **count clamp:** 1~20(sheet 1~300) 벗어나면 **기각(null)**.
- **volume clamp:** 1~2000 벗어나면 용량만 null(기각은 아님).
- **용량 환각 차단:** 제목에 어떤 규격토큰(ml/g/매/장/L)도 없는데 LLM이 용량을 냈으면 → null + `volumeHallucinated`(→검수).
- **DB 단위 정합 가드:** `volumeUnit='개'`→ml/g면 용량 제거+count, `'매'`→ml/g면 용량 제거+sheet (프롬프트와 이중 안전).
- **근거 교차검증:** `count>1`인데 제목에 카운트/배수/세트/리필/본품 신호가 전무하면 → **기각(null)**.
- **evidence 약검증:** evidence의 숫자/단위 토큰이 제목에 하나도 없으면 → 기각.
- **검수 라우팅:** `needsInspection = heterogeneous || per_unit_computable===false || confidence!=='high' || volumeHallucinated`.
- 기각(null) 시 caller는 `regexFallback`(옛 regex + confidence='low' + needsInspection=true).

---

## 6. 결과 소비 — normalize & 검수 라우팅

### 6.A run.ts 주입 (LLM on)
- `run.ts:451` priced offer마다 `parsePackage(...)` → `offer.parsedPackage`.
- `run.ts:465` `parsedPackage.needsInspection && !inspectionWarning && !anchored` → `inspectionWarning` 세팅
  → healthcheck가 warning(숨김)으로 잡고 예측값과 함께 **inspection 탭 prefill**. (앵커된 SKU는 검수 제외.)
- `run.ts:332~` §B: 세트/저신뢰 의심 오퍼는 LLM 재검증(`canAutoApplyVerify` = method='llm' & confidence='high' & !inspection & !hetero → 자동 노출).

### 6.B normalize의 파싱 소비 우선순위 (`normalize.ts`)
개수(141-)·용량(186-)에서 각각:
1. **`offer.parsedPackage`** 가 `detected && confidence==='high'` → 그 값 채택.
2. (용량만) `offer.parsedVolumeRaw` (어댑터가 직접 준 용량).
3. **`extractPackageFromTitle(sourceText)`** — 옛 regex 엔진 재파싱. ← **LLM off이거나 parsedPackage 저신뢰일 때의 실질 경로**. ⚠️ 여기엔 DB 단위 정합 가드가 **없다**(§용량혼동 분석 문서 참조).

즉 **regex 엔진은 두 개가 공존**한다:
- `analyzeGate`(parsePackage.ts): LLM on일 때 게이트 겸 규칙 계산.
- `extractPackageFromTitle`(packageExtractor.ts): LLM off / normalize 폴백의 옛 엔진. (규칙 1~6: 합산·리필 1b·1+1·더블·시트·배수·카운트·이종세트·단품.)

---

## 7. 현재 현황 요약

| 항목 | 현재 상태 |
|---|---|
| 운영 크롤 LLM | **ON** (crawl.yml: `LLM_TITLE_PARSE=on`, `GEMINI_API_KEYS`, model 기본 gemini-3.1-flash-lite) |
| 로컬/테스트 | 항상 OFF → 옛 regex(`extractPackageFromTitle`)만 |
| 프롬프트 버전 | `v6-volume-unit-constraint` (DB 단위 제약 포함) |
| 규칙 확정 대상 | 깨끗한 단품 / 깨끗한 ml·g ×N / 정상 시트(매) — `analyzeGate` 3개 route |
| LLM 위임 대상 | +결합·세트/증정/리필/본품/종·복수토큰·부속인접·비인접·범위이탈 (게이트 needs-llm) |
| 안전장치 | 캐시(manual>llm) · 가드(clamp/환각/단위정합/근거교차) · 기각시 regexFallback+검수 · 앵커 SKU 검수제외 |
| 남은 리스크 | ① normalize Check-3 옛 regex 경로엔 단위 정합 가드 없음 ② 매수(sheet count)를 UI까지 보존하는 필드 부재 ③ "리필 단품"과 "본품+리필"을 규칙이 구분 못함 (→ `volume-unit-conflation-analysis.md`) |

---

## 8. 판정 로직 요약 (한 문장)

> 제목이 **"규칙이 봐도 명백한"**(깨끗한 단품·×N·시트) 형태면 `analyzeGate`가 regex로 즉시 확정하고,
> **결합/세트/증정/리필/부속/복수토큰 등 모호·위험** 신호가 하나라도 있으면 LLM(v6 프롬프트)에 위임한 뒤
> `titleParseGuards`(clamp·환각·단위정합·근거교차)로 검증해 통과분만 채택, 나머지는 옛 regex 폴백 + 검수 라우팅한다.
> 단, 같은 제목은 `title_parse_cache`(manual>llm) 덕에 최초 1회만 실제로 파싱된다.
```
