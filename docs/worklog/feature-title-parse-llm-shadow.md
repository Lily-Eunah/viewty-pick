# feature/title-parse-llm-shadow

## 목표
제목 구성 파싱(개수/용량/추가구성)을 **regex fast-path + LLM 폴백** 하이브리드로 개선.
1단계는 **기존 로직을 지우지 않고 옆에 붙여 shadow 비교**만 한다(표시·sync 무영향).
설계: `docs/title-parsing-llm-hybrid-design.md`. 원인 분석: `docs/offer-parsing-rules.md` §8 (G3 증정 "퍼프 3매"→3 오독, G4 올영 형제 변종 오매칭).

## 구현 (전부 신규 파일, 기존 코드 미변경)
- `crawler/core/parsePackage.ts` — 단일 진입점. `analyzeGate`(triviality gate, 순수) + `parsePackage`(async, LLM 의존성 주입).
  - 라우트: `trivial-single` ① / `clean-multipack` ②a·②b / `sheet` ③ / `needs-llm`.
  - 인접성=콤마·공백 투명. 카운트 귀속 allowlist(직전 토큰이 용량/form noun/본품). 부속 명사·단독 매(비시트)·세트/증정/괄호/`+`/다중용량 → needs-llm.
- `crawler/core/titleParseGuards.ts` — `applyTitleParseGuards`: 범위 clamp(개수 1~20·시트 1~300, 용량 1~1000), 근거 교차검증(다수 개수 환각 차단), 증정 용량 제외, 이종세트/per-unit불가/저신뢰→needsInspection.
- `crawler/core/llmTitleParse.ts` — Gemini REST(fetch, SDK 의존성 0). temp=0 + responseSchema. 제목별 캐시. mock/test/키없음→null(=regex 폴백). env `GEMINI_API_KEY`, `GEMINI_MODEL`(기본 gemini-2.5-flash-lite).
- `crawler/core/__tests__/parsePackage.test.ts` — 게이트 라우팅 + LLM 폴백/가드 오프라인 테스트(LLM stub, 네트워크 없음).
- `scripts/ops/title-parse-shadow.ts` — READ-ONLY 하베스트. `price_snapshots.source_text`→제목 추출, old(extractPackageFromTitle) vs new(parsePackage) diff를 `docs/worklog/title-parse-shadow.md`로.
- `package.json` — `test:parsepackage`, `shadow:title-parse` 스크립트 추가, `test:all`에 편입.

## 테스트 결과
- `npm run test:parsepackage` → ALL PASSED (게이트 라우팅 17케이스 + 폴백/가드 6케이스).
- `npm run package:extract:test` → PASSED (기존 regex 회귀 없음, 미변경).
- `npx tsc --noEmit` → exit 0.

## 실행 방법 (시험)
```
# 게이트 로직만(키 없이): 
npm run test:parsepackage
# 실제 제목으로 shadow 비교(READ-ONLY; .env Supabase 필요, GEMINI_API_KEY 있으면 LLM 실호출):
npx tsx -r dotenv/config scripts/ops/title-parse-shadow.ts --limit=300
```
- LLM 미설정이면 needs-llm은 regex 폴백으로 표시 → "어떤 제목이 LLM 경로로 가는가"만 봐도 유용.
- 결과: `docs/worklog/title-parse-shadow.md` 의 🔴불일치 표가 새 로직이 바꾸는 지점.

## shadow 1차 결과 (2026-06-27, gemini-3.1-flash-lite, 60건)
- LLM 채택 26/29 needs-llm, 불일치 14/60. route: trivial 21 · multipack 7 · sheet 3 · needs-llm 29.
- **모델 발견:** 무료 쿼터는 **모델별로 별도**. `gemini-2.5-flash-lite`/`2.0-flash-lite`는 당일 429/503, 그러나 `gemini-3.1-flash-lite`·`gemini-flash-lite-latest`·`gemini-3.5-flash`는 200+정상 JSON. **Gemma 4 31B는 thinking형이라 구조화 출력 부적합**(추론 후 MAX_TOKENS, off-schema). → 권장 모델 = `gemini-3.1-flash-lite`.
- 불일치 분류:
  - 시트/패드 `N매` 10건: old=개수 N vs new=count 1·용량 N매. → **매당 단가/`volume_unit='매'` 정합 결정 필요**(최다 클래스).
  - `1L` 2건: old 용량 미파싱 vs new 1000ml. **개선**(packageExtractor엔 L 규칙 없음).
  - `쿠션 13g + 퍼프 2p 세트` 1건: old 2 vs new 1·13g. **목표 버그 교정**.
  - `크림 100ml 기획 3종` 1건: new=heterogeneous+검수(보수적).
- 증정 strip·본품+리필·1+1·×N·퍼프 분리 모두 정확. 폴백 3건은 일시적 miss → regex+needsInspection 안전 강등.

## shadow 2차 결과 (2026-06-27, gemini-3.1-flash-lite, prompt v2-bonus-sum, 136건 전체)
- distinct 136 · needs-llm 69(51%) · LLM 채택 64 · 가드 기각→폴백 5 · 불일치 25.
- **디스크 캐시 검증:** 재실행 시 네트워크 **0콜 / 캐시 히트 69** (`.cache/title-parse-llm.json`, gitignore). 쿼터 문제 해소(제목 변경 시에만 호출).
- **v2 정책(동일 제품 보너스 합산) 정상:** `90매(+12매)→102`, `150ml(+50ml)→200`, `(+20ml)→170`, `(+80ml)→300`, `250ML+30ML→280`, `+10매→80`.
- **원래 신고 버그 해결:** `[퍼프 3매 추가 증정] …쿨링 쿠션 15.8g` old=3 → new=1/15.8.
- **명확한 개선:** `쿠션 리필 13g`(리필 단독) old=2→new=1, `1L→1000ml`(×2), `쿠션+퍼프 2p`→1, `_195ml` 파싱.
- **새 가드 추가(이번 표본이 노출):** 제목에 ml/g/매/L 숫자가 전혀 없는데 LLM이 용량을 지어낸 2건(`(더블/대용량)`→120, `선 세럼`→40)을 **용량 환각 가드**로 null+검수 처리(titleParseGuards). 캐시 재실행으로 0콜 검증.
- **정책 결정(→ v3):** `유세린 …세럼 30ml (+에피셀린 세럼 7ml*2)` 같은 **소량 샘플(7ml·미니·파우치)은 동일제품이라도 합산하지 않고 샘플로 둔다**(=30, 검수 아님). 정상 추가분(리필·+대용량·+N매·1+1)만 합산. 프롬프트 v3-sample-exclude 반영(코드만; 캐시 무효화 비용 때문에 재실행은 다음 run에서). 검증은 다음 실행 시.

## 남은 이슈 / TODO
- **stage-2 설계서: `docs/title-parse-stage2-design.md`** (실 적용 + LLM-prefill 검수 O/X + 멀티키/알람/degraded).
- [x] `GEMINI_API_KEY` 추가 후 shadow 실행(1·2차) → 🔴불일치 검토 완료. 골든셋 라벨링은 stage-2.
- [ ] (stage-2) `title_parse_cache` DB화 + normalize 주입(이중 파싱 제거) + run.ts 자동노출/prefill검수 라우팅.
- [ ] (stage-2) inspection 탭에 예측 컬럼 + O 확정→manual 캐시. 멀티키 로테이션 + `sendCriticalAlarm` + degraded.
- [ ] (stage-3) `LLM_TITLE_PARSE=on` 전환 + brittle fallback "검수로" 단순화.
- [ ] 무료 티어 RPM 초과 시 `LLM_SHADOW_DELAY_MS` 상향(기본 1200ms).
- [ ] 부속 명사 allowlist/시트 form 사전은 parsePackage 로컬 정의 — 추후 naver.ts FORM_TOKENS와 통합 검토.
- 별개 branch: 올리브영 goodsNo 앵커(식별 문제, G4).
