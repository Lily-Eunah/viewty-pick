# Claude Code 작업 프롬프트 — 어댑터 없는 판매처(zigzag/ably)를 "실패"로 집계하지 않기

> 버그: crawl 요약의 **Failed 34**는 전부 **zigzag(active 19) + ably(active 15)** — 어댑터가 없어 스킵되는 link-only 판매처(`is_price_comparison_enabled=false`)인데, `run.ts`에서 `if (!adapter) { ...; failureCount++; }`로 **실패 카운트**되고 있음. 이들은 의도된 link-only라 실패가 아님.
> 베이스: 최신 `main`. 분기 `fix/no-adapter-not-failure`. 대상: `crawler/run.ts` 크롤 루프(어댑터 없음 분기, 현재 ~238행)와 요약 카운터.

## 변경
- 어댑터 없음(`!adapter`) 분기에서 **`failureCount++` 제거**. 대신 별도 `skippedNoAdapter` 카운터(정보성)로 집계하고 `continue`.
  - fail_count(§4.4 staircase) 증가·비활성화 없음(이미 continue라 없음) — 그대로.
- 요약/Discord 카운트 재정의:
  - **Failed** = 진짜 실패만(healthcheck `failed` + catch된 throw). zigzag/ably 스킵은 제외.
  - 가능하면 요약에 **"Skipped (link-only, no adapter): N"** 줄 추가(정보성). 또는 No offer/link-only에 합산.
- `product`/`seller` not found 분기(현재 ~230행)는 진짜 데이터 이상이므로 **failure 유지**(또는 별도 dataIssue 카운터) — 판단 후 일관되게.
- 성공률 분모도 점검: `successCount / listings.length`에서 **크롤 불가(no-adapter) 링크를 분모에서 빼는 게** 더 정확(예: 크롤 대상 105 기준). 최소한 요약 문구가 오해 없게.

## 참고 (현재 실측, 회귀 기준)
- listings active 139 = naver 48 + coupang 19 + oliveyoung 38 + zigzag 19 + ably 15.
- zigzag/ably 34 = 현재 Failed 34. 수정 후 **Failed = 0**(진짜 실패 없을 때), Skipped(no-adapter) 34로 표기되어야 함.

## 테스트
- zigzag/ably listing만 있는 케이스 → `failureCount` 증가 0, `skippedNoAdapter`로 집계, continue.
- healthcheck `failed`/throw 케이스 → 기존대로 Failed 카운트 + fail_count staircase 동작(회귀 0).
- 요약 출력에 Failed가 진짜 실패만 반영. `test:all`·typecheck·build·lint green.

## 적용
- `fix/no-adapter-not-failure`: `fix(crawler): do not count adapter-less sellers (zigzag/ably) as failures`, `test`, `docs: worklog`. 영어 PR → CI → merge → `crawler:sync`로 요약 재확인(Failed 34 → 0/Skipped 34).
