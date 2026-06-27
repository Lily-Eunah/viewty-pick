# feature/title-parse-stage2

## 목표
stage-1(shadow)을 실 sync에 주입. 설계: `docs/title-parse-stage2-design.md`.
**전부 `LLM_TITLE_PARSE=off`(기본)라 prod 거동 무변경** — 운영자가 flag+키 설정 + 마이그레이션 0018 적용 시에만 활성화.

## 구현 (이번 PR 범위)
- **영속 캐시** — `supabase/migrations/0018_title_parse_cache.sql`(배치 전용, RLS deny-by-default) + `crawler/core/titleParseCache.ts`(`makeDbParseCache`, 조회 manual>llm[같은 prompt_version], `setManualParse`) + `crawler/core/titleHash.ts`. `parsePackage(title, ctx, llmExtract, cache?)` 4번째 인자로 주입 — 캐시 히트 시 0콜.
- **멀티키 + 견고성** — `llmTitleParse`: `GEMINI_API_KEYS`(쉼표, 다계정) 로테이션, 429→키 소진 처리 후 다음 키, 5xx→백오프(상한). `llmRunStats`(networkCalls/quotaErrors/allKeysExhausted) + `resetLlmRunStats`/`getLlmModel`/`llmKeyCount`.
- **normalize 주입** — `PriceOffer.parsedPackage`(adapters/index) → normalize가 재파싱 대신 사용. **normalize의 기존 `confidence==='high'` 게이트** 덕에 저신뢰/환각-가드 결과는 무시(보수적).
- **run.ts 배선** — `LLM_TITLE_PARSE=on`일 때 priced offer 제목(`rawOfferTitle`로 접두 제거)을 `parsePackage`(게이트+LLM+DB캐시)로 파싱해 주입. 모든 키 429 → `sendCriticalAlarm`(Discord)로 키 추가/리셋 알림.

## 테스트
- `npm run test:parsepackage`(캐시 주입/우선순위 포함) ✅, `npm run test:all` ✅(exit 0, 회귀 없음), `npx tsc --noEmit` ✅.
- run.ts는 off-flag + 단위테스트로 검증(메모리 경고: `crawler:test`는 실제 .env로 prod에 써서 로컬 실행 금지).

## 운영 적용 순서(활성화 시)
1. 마이그레이션 0018 적용(`title_parse_cache`).
2. `GEMINI_API_KEYS`(또는 `GEMINI_API_KEY`) + `GEMINI_MODEL`(기본 gemini-3.1-flash-lite) 설정.
3. `LLM_TITLE_PARSE=on`.

## step 4 — 검수 prefill (part 2, 구현 완료)
- inspection 탭 확장: `제목 / 예측개수 / 예측용량 / 예측단위 / 구성` 컬럼 추가(범위 A:M). 헤더는 매 sync 자동 기록(운영자 sheets:headers 불필요). off면 예측 컬럼은 빈 칸.
- **저신뢰 priced offer 보류**: `LLM_TITLE_PARSE=on` + `parsedPackage.needsInspection`(저신뢰/세트/환각-가드) → `offer.inspectionWarning` 세팅 → healthcheck status=warning(숨김) → 기존 priced-warning push 경로로 **예측 prefill된 검수행** 생성. 자동 노출 안 함.
- **O 확정 → manual**: run.ts 시작 시 O행을 `manualParseEntries`로 변환 → `setManualParse`(title_parse_cache, source='manual'). 이후 그 제목은 LLM/규칙이 재결정/덮어쓰기 안 함. 가격은 기존 `approvalOverrides` 경로 그대로.
- 테스트: `manualParseEntries`(번들/이종/스킵) + `test:all` ✅, `tsc` ✅. 전부 off-flag 뒤라 prod 무변경(빈 컬럼만 추가).

## 남은 작업
- [ ] **flip & cleanup(stage-3):** brittle fallback을 "검수로" 단순화, 기존 production 경로 완전 이관.
- 별개: 올리브영 goodsNo 앵커(식별 문제).
