# Stage-2 설계 — 실 적용 + LLM-prefill 검수(O/X) + LLM 운영 안정성

> **선행:** stage-1(shadow) 완료 — `parsePackage`(게이트+LLM+가드) + 디스크 캐시 + shadow 하베스트. 본 문서는 이를 **실 sync에 주입**하고, **검수 O/X에 LLM 예측을 prefill**하며, **LLM 죽음/쿼터 소진 시 알람+키 로테이션**을 더한다.
> **관련 코드:** `crawler/core/{parsePackage,titleParseGuards,llmTitleParse}.ts`, `crawler/sheets/inspection.ts`, `crawler/core/{normalize,routeNoOffer,notify}.ts`, `crawler/run.ts`.
> **원칙(불변):** trust-first — 확신 없으면 자동 노출 금지, **prefill된 검수로**. 규칙은 안 늘린다(애매하면 LLM, 그래도 불확실하면 사람).

---

## 1. 동작 모델 — 자동 노출 vs prefill 검수

`parsePackage` 결과를 두 갈래로 라우팅한다.

| 분기 | 조건 | 처리 |
|------|------|------|
| **자동 노출** | 게이트 `trivial-single`/`clean-multipack`/`sheet` (결정적) · **또는** LLM `method='llm'` + `confidence='high'` + `!needsInspection` + per-unit 계산 가능(single/homogeneous_bundle/option_select) | 바로 가격/개당·ml당 노출 |
| **prefill 검수** | LLM `confidence∈{medium,low}` · `needsInspection`(이종세트·환각 플래그·per_unit 불가) · **또는** fallback(LLM 불가) | inspection 탭에 **LLM 예측 prefill** → 운영자 O / 수정+O / X |

- **신뢰 구축 다이얼** `TITLE_PARSE_REVIEW_MODE`:
  - `strict` — 비-자명(게이트 trivial 외) 전부 검수로(초기, prefill이라 대부분 O 한 번).
  - `normal` — 위 표대로 불확실한 것만 검수(정상 운영).
- **캐시 확정분은 항상 자동** — O로 확정된 title은 manual 캐시라 재검수 없음(§4).

---

## 2. 검수 시트 — 기존 inspection 탭 확장 (prefill + O/X 재사용)

기존 `inspection.ts`가 이미 "크롤러가 prefill → 운영자 O/X → `manual_override`→`ok`"를 한다(헤더 `product_key,product_name,seller,추정가격,출처,사유,링크,승인`). 여기에 **LLM 예측 파싱 컬럼**을 추가한다.

**확장 헤더(예):**
```
product_key, product_name, seller, 추정가격,
예측개수, 예측용량, 예측단위, 구성,         ← LLM 예측 prefill (운영자 편집 가능)
출처, 사유, 링크, 승인
```
- `InspectionItem` 에 `pred_count`, `pred_volume`, `pred_unit('ml'|'g'|'매')`, `composition`, `pred_per_unit`(개당·ml당) 필드 추가. `rowToValues`/`readInspectionRows`/`INSPECTION_HEADERS` 동기 확장.
- **운영자 행동:** prefill이 맞으면 **O 한 번**. 틀리면 예측개수/용량을 **고치고 O**. 아니면 **X**.
- `mergeInspectionRows`의 sticky-approval(O/X 보존, blank refresh)·`parseApproval`은 그대로 재사용.

**확정값 적용(중요 — 파싱 정확성):**
- 가격만이 아니라 **개수/용량까지 확정**해야 개당·ml당이 맞다. 그래서 O 시:
  - (편집됐을 수 있는) 예측개수/용량/구성을 **`title_parse_cache`에 `method='manual'`로 기록**(§4) → 다음 sync부터 `parsePackage`가 그 값을 그대로 사용.
  - 가격은 기존 `approvalOverrides`(추정가격 → price `manual_override` → `ok`) 경로 그대로.
- 즉 O = "이 title의 파싱+가격을 사람이 확정". 한 번 확정되면 재질문·LLM 덮어쓰기 없음.

---

## 3. run.ts 라우팅 흐름

```
offer 확정(어댑터) → title = offer.sourceText(매칭 제목)
  parse = await parsePackage(title, ctx, llmExtractTitle)   // ctx: DB volume/unit/name/brand
  if (자동 노출 조건)  → normalize(parse)로 가격/개당 산출 → 정상 스냅샷
  else                → InspectionItem(prefill: 예측개수/용량/구성/개당 + 추정가격) → upsertInspection()
```
- `normalize.ts`는 더 이상 `sourceText`를 재파싱하지 않고 **parse 결과(개수/용량)를 주입받아** 사용(이중 파싱 제거, stage-1 설계 §7).
- 비-LLM 게이트 결과(자명)는 LLM 호출 없이 그대로 자동 노출.

---

## 4. 영속 캐시 `title_parse_cache` (재질문/덮어쓰기 방지)

stage-1의 디스크 캐시를 **DB 테이블**로 승격.

```
title_parse_cache(
  title_hash text primary key,     -- normalize(title)의 해시
  title text,
  result_json jsonb,               -- ParsePackageResult(개수/용량/구성/…)
  source text,                     -- 'manual' | 'llm' | 'regex'
  model text, prompt_version text, -- LLM 결과의 출처 버전
  confirmed_ox boolean default false,
  updated_at timestamptz
)
```
**조회 우선순위(parsePackage 진입 시):**
1. `source='manual'`(O 확정) → **그대로 사용, LLM/규칙 무시.**
2. `source='llm'` AND `prompt_version` 일치 → 재사용(0콜).
3. 미스/버전 불일치 → LLM 호출 → 성공 시 `source='llm'`로 저장.

- `prompt_version` 변경 = LLM 캐시만 무효(매뉴얼은 유지). 정책 바뀔 때 의도적 재파싱.
- 제목 안 바뀌면 호출 0 → 월 쿼터 충분(stage-1에서 검증: 재실행 0콜).

---

## 5. LLM 운영 안정성 — 키 로테이션 + 알람 + degraded

### 5-1. 멀티 API 키 로테이션
- `GEMINI_API_KEYS` = 쉼표구분 키 목록(또는 `GEMINI_API_KEY`,`GEMINI_API_KEY_2`…). 다른 계정 키를 넣어 쿼터 풀을 늘림.
- `llmTitleParse`: 현재 키로 호출 → **429/쿼터**면 다음 키로 로테이션 후 재시도. 모든 키가 429면 그 run은 "LLM 소진" 상태로 표시.
- 키별 소진 상태를 run 내에서 기억(소진된 키 재시도 안 함).

### 5-2. 쿼터/장애 알람 (Discord, 기존 `sendCriticalAlarm` 재사용)
- run 종료 시 LLM 상태 집계: `모든 키 429` 또는 `오류율 높음(5xx/timeout)` 또는 `새 title N건이 LLM 미해결로 검수로 빠짐`.
- 조건 충족 시 **run당 1회** `sendCriticalAlarm('LLM 제목 파싱 불가', '...')`:
  - 예: `gemini 쿼터 소진(모든 키 429) — 새 title 7건이 LLM 예측 없이 검수로. 다른 계정 키 추가 또는 내일 리셋 후 재sync 필요.`
- 일일 요약(`sendDailySummary`)에도 `LLM: 호출 N · 캐시 H · 미해결(검수) M` 한 줄 추가.

### 5-3. degraded 모드 (절대 sync 실패 안 함)
- LLM 전부 불가여도: **캐시된 title은 영향 0**(manual/llm 캐시 사용), **새/바뀐 title만** LLM 예측 없이 prefill-검수(예측 비움)로 →
  - 자동 노출엔 안 올라가고(안전), 운영자가 채우거나 키 복구 후 재sync 시 자동 채워짐.
- 크롤 파이프라인 자체는 정상 완료(가격/이미지 등 다른 경로 영향 없음).

---

## 6. 마이그레이션 순서

1. **캐시 DB화** — `title_parse_cache` 마이그레이션 + `parsePackage` 조회/저장(manual>llm>call). (stage-1 디스크 캐시 대체)
2. **normalize 주입** — `normalize`가 parse 결과를 받도록 변경(이중 파싱 제거). 회귀테스트 필수.
3. **run.ts 라우팅** — `LLM_TITLE_PARSE=shadow|on` 플래그. shadow=병행 로그만, on=자동노출/검수 라우팅.
4. **inspection 탭 확장** — 예측 컬럼 + O 확정 시 manual 캐시 기록. `sheets:headers` 재실행.
5. **LLM 안정성** — 멀티키 로테이션 + `sendCriticalAlarm` + degraded.
6. **flip & 정리** — `on` 전환. brittle fallback은 "검수로" 단순화(규칙 의존 제거, 이전 논의). `extractPackageFromTitle`은 다른 production 경로가 완전 이관될 때까지 유지.

---

## 7. 미결 / 주의
- 자동 노출 임계(confidence 'high'만 자동 / 'medium'은 검수?) 초기엔 보수적(`strict`)으로, 골든셋 쌓이면 완화.
- `title_parse_cache` 키 정규화 범위(대괄호 마케팅 접두 제거 여부) — 과정규화 시 다른 구성 오재사용 위험 → **원문 기준 권장**(stage-1과 동일).
- O 확정 파싱과 가격 `manual_override`의 정합(둘 다 같은 product+seller). 한 행에서 동시 기록.
- 멀티키: 키별 쿼터·요금 주체 분리 인지(무료 키 여러 개 vs billing 1개). 무료 다계정은 약관 확인 권장.
- shadow(stage-1) 리포트의 🔴불일치를 골든셋으로 라벨링 → 회귀 테스트/프롬프트 보강 소스.
