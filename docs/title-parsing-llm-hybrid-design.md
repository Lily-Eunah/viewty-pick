# 제목 구성 파싱 — Regex + LLM 하이브리드 설계

> **목적:** 판매처 offer 제목에서 **개수·용량·추가구성(증정/리필/세트)** 을 추출하는 로직을, 규칙 기반(`extractPackageFromTitle`)에 **Gemini LLM 폴백**을 결합해 정확도를 높인다.
> **상태:** 설계(spec). 구현 전. 관련 코드: `crawler/core/packageExtractor.ts`, `crawler/core/normalize.ts`, `crawler/adapters/{naver,oliveyoung,coupang}.ts`.
> **선결/병행:** 올리브영 **goodsNo 앵커**(식별 문제)는 별도 branch로 먼저. 본 설계는 **구성 파싱**(앵커와 직교) 문제를 다룬다.

---

## 1. 왜 앵커만으로 부족한가 (문제 정의)

앵커(네이버 `/products/{N}`, 쿠팡 `productId`, 올영 goodsNo)는 **"우리가 고른 그 SKU인가?"** 만 보장한다. 그러나 그 SKU의 **판매 구성**은 여전히 제목으로 판단해야 하고, 위험 케이스가 많다:

| 케이스 | 함정 | 올바른 처리 |
|--------|------|-------------|
| 단품 링크가 없어 **1+1을 등록** | 1+1 가격을 단품가로 오인 | count=2 → effective = 가격/2 |
| **본품 + 증정 앰플 10ml** | 10ml를 본품 용량에 **합산**해 ml당 왜곡 | 증정은 용량/개수에서 제외, 본품 용량만 |
| **본품 + 리필**(쿠션) | 1개? 2개? | 동일제품 ×2 |
| **퍼프 3매 추가 증정** | `3매`를 개수 3으로 오독 (G3) | 증정 → 개수 1 |
| **N종 택1** vs **N종 세트** | 옵션선택(단품)을 세트로 | 택1=단품, 세트compound=세트 |
| **토너 + 세럼**(이종 세트) | per-unit 계산 불가한데 단가 산출 | 비교 제외 + 검수 |

이 분류는 **의미 판단**이라 규칙으로는 변종마다 깨진다. 반면 입력이 짧고 출력 스키마가 고정이라 LLM이 강한 전형 태스크다.

**범위(scope):**
- LLM이 푸는 것: 제목 **한 줄**에서 `본품 용량/단위`, `본품 개수`, `구성 종류`, `증정/부속(용량 포함) 분리`, `per-unit 가격 계산 가능 여부`.
- LLM이 풀지 않는 것: **제품 식별(앵커/매칭)**, 가격 추출, 판매처 선택. (그건 어댑터·앵커의 책임.)

---

## 2. 파이프라인 내 위치

```
adapter.fetchOffer() ─ 앵커/매칭으로 offer 확정(sourceText = offer 제목) ─►
                                   │
              ┌────────────────────┴─────────────────────┐
              ▼                                            ▼
   parsePackage(title, ctx)  ◄── 본 설계의 단일 진입점 ───┘
   ├─ 1) regex fast-path (자명한 단품)        → 채택
   ├─ 2) LLM 추출 (그 외 전부)                → 검증 통과 시 채택
   └─ 3) 검증 실패 / LLM 불가                 → regex 결과 + needsInspection
              ▼
   normalizePrice() 가 결과의 count/volume 사용 (기존 흐름 그대로)
```

- **단일 진입점** `parsePackage()` 를 신설해 `normalize.ts`와 어댑터가 직접 `extractPackageFromTitle`을 부르던 자리를 대체한다. 출력 타입은 기존 `PackageExtractionResult`(이미 `method:"regex"|"llm"|"manual"` 보유)를 확장.
- LLM은 **오프라인(배치) 컨텍스트**에서만 호출(run.ts 일회성 크롤). 웹 런타임/요청 경로에는 호출 없음.

---

## 3. 결정 정책 (regex-first, LLM은 비자명 케이스)

### 3-1. Triviality gate — "신호 없는 단품"만 regex로 확정

이 게이트는 **"본품 개수가 1"을 판단하는 게 아니라, "개수/구성을 의심할 단서가 제목에 하나도 없는가"** 를 판단한다. 단서가 없으면 개수는 1로 단정해도 안전하고(추가구성을 가리키는 어떤 표기도 없으므로), 그런 제목만 LLM을 건너뛴다.

**전제:** 판정은 항상 **정제된 제목**(`cleanTitleText`로 `SPF\d+`·`PA++`·연도·6자리+숫자 제거) 위에서 한다. 그래야 `100시간`·`SPF50` 같은 마케팅 숫자가 신호로 오인되지 않는다.

**핵심 통찰 — 용량 인접 여부가 안전성을 가른다.** 기존 regex는 `개/입/팩/병` 을 **용량에 인접할 때만** 개수로 센다(case 4 `(\d+)(ml|g)[,\s]+(\d+)(개|입|…)`). 그래서 `쿠션 15g 퍼프 2개`의 `2개`는 용량(`15g`)과 사이에 `퍼프`가 끼어 **매칭되지 않고 단품(count=1)으로 떨어진다** — 우연히 안전하다. 반대로 `매/장`(case 5)은 **용량 인접 없이 단독으로** 잡혀서 `퍼프 3매`가 개수 3으로 새어 나갔다(G3). 즉 위험한 건 "개수 접미사가 있다"가 아니라 **"용량과 떨어진/단독 카운트"** 다.

따라서 fast-path(LLM 미호출)는 아래 **세 형태(①②③)** 를 받는다.

> **인접성 정의 (②·③ 공통, 매우 중요):** "카운트가 X에 인접/부착되었다"는 **콤마·공백을 건너뛴 직전 의미 토큰이 X**라는 뜻이다. `,` 와 공백은 투명하게 취급한다(기존 regex의 `(?:,|\s)+`와 동일). 따라서 `토너, 2개` 는 `2개` 직전 의미 토큰이 `토너`(콤마 무시) → 제품에 인접 → 통과. `토너 110ml, 1개` 도 `1개` 직전이 `110ml` → 통과. 반대로 `쿠션, 퍼프 2개` 는 `2개` 직전이 `퍼프` → 비제품 → 탈락.
>
> **카운트 귀속 규칙 (allowlist):** 카운트(`N개/입/팩/병`, 시트는 `N매/장`)는 **그 직전 의미 토큰이 (a) 용량 토큰, (b) 제품 form noun(토너/크림/쿠션/세럼/패드 …), 또는 (c) `본품` 일 때만** 본품 수량으로 인정한다. 그 외 토큰(퍼프·파우치·거울 등 비-form 명사) 뒤의 카운트는 본품 수량이 아니다 → 탈락(LLM). **부속을 일일이 나열(denylist)하지 않고, 제품에 붙은 것만 통과(allowlist)** 시키므로 목록에 없는 부속에도 안전하다.

**① 신호 없는 단품**
- 용량 토큰 **1개**, 아래 "탈락 신호" 전무 → `단품 · 그 용량 · count=1`
- 용량 토큰 **0개**, 탈락 신호 전무 → `단품 · 용량 미표기(→ normalize가 DB volume_ml) · count=1`

**② 깨끗한 동종 멀티팩** (사용자 케이스: "1개/2개가 한 번만" · 용량 표기 유무 무관)
공통 조건: 카운트 표기가 **정확히 한 번**(`본품 1개 + 리필 2개` 같은 다중 카운트 제외), **위 "카운트 귀속 규칙(allowlist)"을 만족**(직전 의미 토큰이 용량/form noun/본품), 아래 "탈락 신호" 전무.
- **②a 용량 동반** — `Nml ×M` / `Nml M개/입/팩/병`처럼 카운트 직전이 **용량**(case 3·4가 high로 매칭). 가장 안전. `토너 110ml, 1개`(콤마 투명)도 여기.
  → `동종번들 · 그 용량 · count=M`.
- **②b 용량 미표기** — 용량 토큰 0개인데 카운트 직전이 **form noun/본품**(`토너 2개`, `토너, 2개`, `세럼 3개`).
  → `동종번들 · 용량은 DB volume_ml · count=M`. (M 2~20; M=1이면 단품 ①과 동일.)

> **②b 안전장치 = 귀속 규칙(allowlist):** 용량이 없으면 "용량 인접"으로 본품 카운트임을 확인할 수 없으므로, **"카운트 직전 의미 토큰이 form noun/본품일 때만 통과"** 규칙이 그 역할을 한다. `토너 2개`·`토너, 2개` → 직전이 `토너` → 통과(count=2). `쿠션 퍼프 2개`(용량 없음) → 직전이 `퍼프`(비-form) → 탈락 → LLM. 부속 denylist가 아니라 **제품 부착 allowlist**라, 목록에 없는 부속에도 안전하다.
>
> **구현 메모:** 현재 regex엔 **용량 없는 단독 `N개` 규칙이 없다**(case 4는 용량 인접 필수). ②b를 살리려면 "카운트 직전(콤마·공백 무시)이 form noun/본품인 단독 `N개/입/팩/병`" 규칙을 추가하거나 `parsePackage`에서 처리해야 한다.

**③ 시트 단위 제품의 매수** (시트팩·패드처럼 `매`가 곧 제품 단위)
- **제품 자체가 시트 제품**일 때 — 큐레이션 제품의 `volume_unit==='매'`, 또는(미설정 시) 제품명/제목의 form noun이 시트류(`마스크/마스크팩/패드/시트/팩`) — 그리고
- `매`/`장`이 **정확히 한 번**(`70매`, `10매입`, 또는 `25ml, 10매입` 같은 시트+용량 case 2), 그리고
- 아래 "탈락 신호"가 전무(특히 증정/추가/괄호/대괄호 없음)
- → `sheet · 매수=N`(필요 시 용량 동반). `패드 70매` 가 여기서 통과.

> 왜 안전한가: `퍼프 3매`가 샌 건 **제품이 쿠션(ml/g)** 인데 `매`가 끼어든 **부속(퍼프)** 이었기 때문이다(게다가 `[…]`·`증정`·`추가`를 동반 → 어차피 탈락). 제품 form 자체가 시트가 아니면 단독 `매`는 부속으로 보고 LLM에 맡기고, **시트 제품의 매는 제품 수량**이므로 통과시킨다.

**탈락 신호(하나라도 있으면 → LLM):**
- 결합 기호 `+`
- **귀속 규칙 위반 카운트** — 직전 의미 토큰(콤마·공백 무시)이 용량/form noun/`본품`이 **아닌** 카운트. 즉 비-form 명사(퍼프/파우치/거울/케이스/스펀지/브러시/면봉 …) 뒤의 `N개/매/…`(예 `쿠션 퍼프 3매`, `쿠션 퍼프 2개`). 증정어가 없어도 탈락.
- **`매`·`장`인데 제품이 시트류가 아닐 때**(③ 미충족) — 시트 제품이면 ③으로 통과, 아니면 탈락.
- 카운트/용량 토큰이 **2개 이상**(예: `100ml … 30ml`, `본품 1개 + 리필 2개`, 시트 제품이라도 `매`가 2회 이상)
- 세트·구성·증정 키워드: `세트/기획/패키지/콜렉션/컬렉션/기프트/더블/증정/사은품/샘플/리필/본품/종`
- 괄호·대괄호 안 텍스트: `( … )`, `[ … ]`

> **용어 정리(모순 아님):** "용량 토큰이 1개"의 *1개* 는 **용량 표기가 한 번 등장(토큰 수)** 이고, ②의 `2개` 는 **제품에 붙은 깨끗한 멀티팩 개수**다. 위험한 건 `개`라는 글자가 아니라 *제품(용량/form noun/본품)에서 떨어진 카운트*(비-form 명사 뒤)이므로, 제품에 붙은 카운트는 fast-path가 받고 떨어진 카운트만 LLM으로 보낸다.
>
> **confidence 의존 제거:** 게이트는 regex `confidence`에 기대지 않는다(용량 0개 단품은 `detected:false`라 confidence 게이트로는 멀쩡한 단품이 샌다). 오직 **신호 구조**로 정의한다.

→ `토너 100ml`, `조선미녀 선크림`, **`센카 폼클렌징 120ml 2개`**(②a), **`토너 2개`**(②b, 용량 미표기→DB), **`마스크팩 70매`**(③ 시트)까지 regex로 즉시·결정적·공짜 처리. 애매한 건(`쿠션 … 퍼프 3매 증정`, `쿠션 퍼프 2개`, `본품+리필`, 증정 동반) LLM이 본다(캐시되므로 반복 비용 0).

> **잔여 리스크(수용):** 증정어 없이 용량에 바로 붙은 가짜 카운트(예 `크림 50g 2개`인데 1개가 증정)는 ②가 count=2로 볼 수 있다. 다만 (a) 증정은 보통 `증정/+/괄호/2번째 용량`을 동반해 탈락하고, (b) 같은 제품 2개면 per-unit 단가는 어차피 동일 → ml당 왜곡은 없다. 이 좁은 잔여 케이스는 허용한다.

### 3-2. LLM 경로
비자명 제목은 LLM 호출 → **§5 검증** 통과 시 채택(`method:"llm"`). 실패/불가 시 §3-3.

### 3-3. 폴백 (LLM 신뢰 못 할 때)
- LLM 호출 실패(429/5xx/타임아웃/스키마 위반) **또는** 출력이 검증 실패 → **regex 결과를 쓰되 `confidence`를 낮추고 `needsInspection=true`**(기존 inspection O/X 라우팅 재사용). 절대 sync 전체를 실패시키지 않는다.
- LLM이 스스로 `confidence:"low"` 또는 `per_unit_computable:false`(이종 세트 등) → 가격 자동노출 금지 → `needsInspection`.

> **trust-first 불변식:** LLM 결과든 regex 결과든, **저신뢰는 자동 노출하지 않고 검수로** 보낸다. 잘못된 ml당을 보여주느니 비운다.

---

## 4. LLM 추출 스키마 (structured output)

`temperature=0` + `responseMimeType:"application/json"` + `responseSchema` 강제. 자유 텍스트 금지.

```jsonc
{
  "is_single_product": true,            // 본품이 1종(동일 제품)인가? false면 이종세트
  "composition": "single | homogeneous_bundle | heterogeneous_set | option_select",
                                        //  single            : 단품
                                        //  homogeneous_bundle: 같은 제품 다수(1+1, 본품+리필, N개, ×N)
                                        //  heterogeneous_set : 서로 다른 제품 묶음(토너+세럼)
                                        //  option_select     : 'N종 중 택1' (실구매=단품)
  "main_unit_volume": 50,               // 본품 1개 용량(숫자). 미표기면 null
  "main_unit": "ml | g | sheet | null", // 용량 단위
  "main_count": 2,                      // 본품을 몇 개 받는가(1+1→2, 본품+리필→2, 단품→1)
  "gifts": [                            // 증정/부속(본품 용량·개수에서 제외할 것)
    { "name": "앰플", "volume": 10, "unit": "ml", "reason": "증정" }
  ],
  "per_unit_computable": true,          // per-unit(=ml당) 단가를 신뢰 계산 가능한가
  "confidence": "high | medium | low",
  "evidence": "본품+리필 (+앰플 10ml 증정)"  // 판단 근거가 된 제목 substring
}
```

**매핑 → 기존 `PackageExtractionResult`:**
- `unitType` ← `main_unit`(없으면 `count`/`unknown`)
- `unitAmount` ← `main_unit_volume`
- `unitCount` ← `main_count`
- `totalAmount` ← `main_unit_volume * main_count`(용량 있을 때)
- `promoType` ← bundle/set/none(composition에서)
- `heterogeneous` ← `composition==="heterogeneous_set"`
- `confidence`, `evidence`, `method:"llm"`
- **증정(`gifts`)은 본품 용량·개수에서 항상 제외** — 이게 "10ml 증정 앰플 합산" 사고를 막는 핵심.

---

## 5. 검증 가드레일 (LLM 출력을 그대로 믿지 않음)

LLM 출력에 **기존 규칙 검증을 동일 적용**한 뒤에만 채택:

1. **범위 clamp:** `main_count` 1~20, `main_unit_volume` 1~1000, `gifts[].volume` 1~1000. 벗어나면 기각→폴백.
2. **근거 교차검증(evidence):** `evidence` substring이 실제 원본 제목에 존재해야 함. `main_count>1`인데 제목에 `+`·`매/개/입/팩/병`·`x/×`·`리필`·`종` 신호가 전혀 없으면 환각 의심 → 기각.
3. **단위 일관성:** `main_unit`이 제목 용량 토큰의 단위와 불일치하면 기각.
4. **증정 누수 차단:** `gifts`로 분류된 용량은 `total_ml` 계산에 절대 포함 안 함(코드에서 강제, LLM 신뢰 아님).
5. **이종/저신뢰:** `per_unit_computable:false` 또는 `confidence:low` → `needsInspection`.

→ 결정성·안전성은 **코드 검증이 책임**지고, LLM은 "어느 게 본품/증정/구성인가"라는 의미 라벨만 제공.

---

## 6. 프롬프트 설계 (few-shot, 한국어 화장품 도메인)

- **시스템:** "너는 한국 화장품 판매 제목에서 본품 용량/개수/구성을 추출한다. 증정/사은품/샘플/퍼프/파우치는 본품에 포함하지 않는다. 'N종 중 택1'은 단품이다. 출력은 스키마 JSON만."
- **few-shot(대표 함정 포함, 최소 6~8개):**
  - `에스쁘아 비벨벳 커버쿠션 15g 본품+리필` → bundle, vol15g, count2, gifts[]
  - `[퍼프 3매 추가 증정 기획] … 쿠션 15.8g` → single, vol15.8g, count1, gifts[퍼프3매]
  - `토너 100ml (+앰플 10ml 증정)` → single, vol100, count1, gifts[앰플10ml]
  - `세럼 30ml 1+1` → bundle, vol30, count2
  - `롬앤 틴트 쿠션 2종 택1` → option_select, count1
  - `제니피끄 세럼 2종 세트` → heterogeneous_set, per_unit_computable:false
  - `토너 75ml + 세럼 35ml` → heterogeneous_set
  - `패드 70매` → single, unit:sheet, count70 (매수=용량개념)
- few-shot은 §13 골든셋과 동일 소스에서 관리(중복 방지).

---

## 7. 코드 통합 지점

| 위치 | 변경 |
|------|------|
| `crawler/core/parsePackage.ts`(신규) | `parsePackage(title, {dbVolumeMl, productName}): Promise<PackageExtractionResult>` — triviality gate → regex/LLM → 검증 → 폴백 |
| `crawler/core/llmTitleParse.ts`(신규) | Gemini 호출 + 스키마 + 캐시. mock/test·키없음 시 즉시 null |
| `crawler/core/packageExtractor.ts` | 그대로 유지(=regex 엔진 & fast-path & 검증 헬퍼) |
| `crawler/core/normalize.ts` | `extractPackageFromTitle(sourceText)` 직접호출 → 사전 계산된 결과 주입으로 변경(아래 주의) |
| 어댑터(naver/oy/coupang) | `parsePackage`로 단일화. `homogeneousBundleQty`/`stripMinorAddOn`/`priceGiftBundleOnMain` 의 휴리스틱을 점진 대체 |

> **주의(중요):** `normalize.ts`는 동기 함수이고 LLM은 비동기다. **LLM 호출은 어댑터/run.ts(비동기)에서 수행**해 결과를 `PriceOffer`에 실어 보내고, normalize는 그 결과를 **재파싱 없이** 사용하도록 바꾼다(현재 normalize가 `sourceText`를 또 파싱하는 이중 파싱 제거). → 한 offer당 LLM 1회.

---

## 8. 결정성 · 캐시 · 영속화

- **캐시 키 = 정규화 제목 문자열**(+ DB 용량 컨텍스트). 동일 제목 재호출 금지(per-run 메모리 캐시 + DB 영속).
- **영속화:** 추출 결과를 저장(예: `title_parse_cache(title_hash, result_json, model, created_at)` 또는 snapshot의 parse 필드). 제목이 안 바뀌면 다음 run에서 LLM 미호출 → **표시 데이터가 run마다 흔들리지 않음** + 감사 로그.
- **버전:** `model`·프롬프트 버전을 캐시에 기록. 프롬프트 변경 시 무효화.

---

## 9. 설정 · 모델 · 비용

- 모델: `gemini-2.5-flash-lite`(빠름·무료 한도 큼). 키 `GEMINI_API_KEY`(CI secret).
- 토글: `LLM_TITLE_PARSE=off|shadow|on`(기본 off). SDK: `@google/genai`.
- 규모: ~40제품 × 3판매처, **비자명 제목만 + 캐시** → 일 호출 수십 건 → 무료 티어 충분.
- **무료(AI Studio) 데이터 사용 주의:** 입력이 모델 개선에 쓰일 수 있음. 제목은 공개 마케팅 텍스트(비민감)라 허용 가능. 민감해지면 Vertex로 승격 옵션만 열어둠.
- 운영 리스크: 키 1개 추가(과거 Discord secret 오타 사고 있었음 → 이름/존재 확인 체크 추가).

---

## 10. 실패 모드 매트릭스

| 상황 | 동작 |
|------|------|
| 키 없음 / mock / test | LLM 미호출 → regex 결과 |
| 429 / 5xx / 타임아웃 | 1회 재시도 → 실패 시 regex + needsInspection |
| 스키마 위반 / 파싱 불가 | regex + needsInspection |
| 검증(§5) 실패 | regex + needsInspection |
| LLM confidence low / 이종세트 | 가격 자동노출 금지 → needsInspection |
| 정상 | LLM 결과 채택(method:llm) |

**불변식:** LLM은 sync를 절대 실패시키지 않는다(전부 graceful fallback). 가격을 **틀리게 노출하느니** 검수로.

---

## 11. 테스트 전략

- **골든셋:** 실제 수집된 까다로운 제목 30~50개 + 기대 출력(JSON) 고정. `parsePackage`(검증·매핑 포함)를 대상으로 단위테스트. LLM은 **녹화 응답(fixture) 모의**로 결정적 테스트.
- 기존 `packageExtractor.test.ts`/`normalize.test.ts` 회귀 유지.
- **shadow 모드:** `on` 전, regex와 LLM 결과를 **둘 다 계산해 로그/저장만**(노출엔 regex 사용). 불일치 케이스를 수집해 골든셋·프롬프트 보강 → 신뢰 확보 후 `on`.

---

## 12. 롤아웃 순서

1. `parsePackage` 단일 진입점 + triviality gate + 이중 파싱 제거(LLM 없이 regex만) — **거동 동일, 리팩토링** (회귀테스트로 보호).
2. `llmTitleParse` + 스키마 + 캐시 + `shadow` 모드 — 노출 영향 0, 불일치 수집.
3. 골든셋·프롬프트 안정화 → `on`. 저신뢰는 inspection으로.
4. 휴리스틱(`homogeneousBundleQty` 등) 중복 정리.

---

## 13. 미해결/결정 필요

- 영속화 위치: 신규 `title_parse_cache` 테이블 vs `price_snapshots` 컬럼 확장?
- shadow 모드 불일치 로그를 어디에 모을지(시트 탭 vs 로그 파일 vs Discord).
- few-shot 골든셋 1차 소스(실수집 제목) 확보 — run 로그/시트에서 추출.
- 매(sheet)·g당 단위(`volume_unit`) 와의 정합(이미 머지된 단위 인프라와 연결).

---

## 부록: 핵심 한 줄 요약
**앵커 = 같은 SKU 보장(식별), LLM = 그 SKU의 구성 해석(증정 분리·1+1·본품 용량 식별), 코드 검증 = 안전망(범위·근거·증정 누수 차단).** 셋은 직교하며 함께 쓴다.
