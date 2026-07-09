# fix/best-revalidate-daily — /best 계열 revalidate 3600 → 86400

## 배경 (왜)

Workers Free 플랜(요청당 CPU 10ms)에서 풀 SSR은 exceededCpu(1102/503) 복불복이다.
`/best`(허브) + `/best/[slug]`(활성 ~40페이지)가 `revalidate = 3600`이라 **배포/purge
시점 기준 매시 정각에 40여 페이지가 동시에 stale**이 되고, 그 직후 유입되는 요청마다
백그라운드 재검증 SSR(각각 10ms 예산)이 폭주했다. 실제 1102 발생 시각(14:00:22 UTC 등)이
정각 직후에 몰리는 패턴과 일치.

가격 데이터는 하루 1회(새벽 크롤)만 바뀌고, 크롤이 이미 `revalidateTag('products')`
온디맨드 재검증을 쏘므로 시간당 ISR은 신선도 이득이 전혀 없었다.

## 구현

- `app/best/page.tsx`: `revalidate` 3600 → 86400
- `app/best/[slug]/page.tsx`: `revalidate` 3600 → 86400 (주석의 "hourly so
  freshly-imported pages appear" 근거는 revalidateTag + nightly rebuild로 대체됨)

## 주요 변경 파일

- `app/best/page.tsx`
- `app/best/[slug]/page.tsx`

## 테스트 결과

- `npm run typecheck` ✅ (exit 0)
- `npm run build` ✅ — 빌드 테이블에서 `/best` `1d`, `● /best/[slug]` `1d` (59 paths) 확인

## 남은 이슈 / TODO

- 크롤 직후 CI rebuild+deploy PR이 머지되면 시간 기반 ISR은 순수 안전망 역할만 남는다.
