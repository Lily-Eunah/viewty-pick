# fix/no-adapter-not-failure

## 문제

Crawl 요약의 **Failed 34**가 전부 **zigzag(active 19) + ably(active 15)** —
어댑터가 없어 스킵되는 link-only 판매처(`is_price_comparison_enabled=false`)인데,
`run.ts`의 크롤 루프가 `if (!adapter) { ...; failureCount++; }`로 **실패**로
집계하고 있었음. 이들은 의도된 link-only라 실패가 아님.

실측(회귀 기준): listings active 139 = naver 48 + coupang 19 + oliveyoung 38 +
zigzag 19 + ably 15. zigzag/ably 34 = 기존 Failed 34.

## 변경 요약

- **어댑터 없음(`!adapter`) 분기**: `failureCount++` 제거 →
  정보성 `skippedNoAdapter` 카운터로 집계 후 `continue`. fail_count(§4.4
  staircase) 변화 없음(원래 continue라 없음). 로그도 `warn` → `log`(정상 동작).
- **product/seller not found 분기**: 진짜 데이터 이상이므로 **failure 유지**
  (Failed에 그대로 노출). 의도된 link-only(no-adapter)와 구분되도록 주석 명시.
- **요약/Discord 카운트 재정의**: `Failed` = 진짜 실패만(healthcheck `failed`
  + catch된 throw + 데이터 이상). 요약에 **"수집 제외 (Skipped · link-only,
  어댑터 없음): N개"** 정보 줄 추가.
- **성공률 분모**: `successCount / listings.length` →
  `successCount / (listings.length - skippedNoAdapter)`. 크롤 불가(no-adapter)
  링크는 분모에서 제외하여 실제 크롤 헬스를 반영.
- **테스트 가능성 리팩토링**:
  - `notify.ts`: 메시지 빌드를 순수 함수 `buildDailySummaryMessage(stats)`로
    분리(기존 `sendDailySummary`는 이를 감싸 전송). `DailySummaryStats` 인터페이스
    export + `skippedNoAdapterCount` 필드 추가.
  - `run.ts`: 어댑터 레지스트리를 `buildAdapters()`로 export — zigzag/ably가
    레지스트리에 없음을 단위 테스트로 고정.

## 주요 변경 파일

- `crawler/run.ts` — no-adapter 분기 skip 처리, skippedNoAdapter 카운터,
  성공률 분모, `buildAdapters()` export, 요약 호출에 skippedNoAdapterCount 전달.
- `crawler/core/notify.ts` — `buildDailySummaryMessage` 분리, `DailySummaryStats`
  export, Skipped(link-only) 요약 줄.
- `crawler/core/__tests__/summary.test.ts` — 신규 테스트.
- `package.json` — `test:summary` 추가 + `test:all` 체인에 포함.

## 테스트 결과

- `npm run test:summary`: ALL PASSED
  - buildAdapters: naver/coupang/oliveyoung 어댑터 존재, zigzag/ably 없음.
  - 요약: 34 skip + 0 real failure → Failed 0개 / Skipped 34개.
  - 실패가 있을 때 Failed는 skip과 독립적으로 노출.
  - skippedNoAdapterCount 생략 시 0개 기본값.
- `npm run test:all`: ALL PASSED (회귀 0).
- `npm run typecheck`: clean.
- `npm run lint`: 0 errors (1 pre-existing warning, 본 변경과 무관).
- `npm run build`: success.

## 남은 이슈 / TODO

- Merge 후 `crawler:sync`로 요약 재확인: Failed 34 → 0, Skipped(no-adapter) 34
  로 표기되는지 확인.
