# feature/product-detail-isr — 카탈로그 페이지 빌드 타임 프리렌더 (SSG/ISR)

## 배경 (왜)

간헐적 Cloudflare **Error 1102 / 503**의 근본 원인이 Workers Logs로 확정됨:
`outcome: "exceededCpu"`, `cpuTimeMs: 10` — **Workers Free 플랜의 요청당 10ms CPU 한도**를
풀 SSR 경로가 초과. 캐시 히트는 cache interception으로 ~1–2ms라 통과하지만,
SSR이 도는 요청은 10ms 언저리 복불복이었다 (실측: `/c/feminine-hygiene`,
`/p/p1ygmtp8` RSC 내비게이션에서 exceededCpu).

핵심 발견: **App Router에서 dynamic-segment 라우트는 `generateStaticParams`가 없으면
`export const revalidate`가 무시되고 매 요청 SSR**로 동작한다. 빌드 테이블에서
`/c/[category]`·`/skin/[type]/[category]`가 `revalidate = 86400` 선언에도 ƒ(Dynamic)로
나오고 있었고, `/p/[slug]`는 아예 완전 동적이었다 (load-improvement-plan의 미착수 PR4).

해결 방향: **빌드는 Worker 밖(CI/로컬)에서 돌므로 10ms 한도가 없다** → 전 카탈로그
페이지를 빌드 타임에 프리렌더해서 Worker는 캐시 서빙만 하게 한다.

## 구현

1. `/p/[slug]` (상세): `generateStaticParams`(전 활성 상품 slug) + `revalidate = 86400` 추가
   → 144개 상세 페이지 빌드 타임 프리렌더. 신규 slug는 dynamicParams로 온디맨드.
2. `/c/[category]`: `generateStaticParams`(전 카테고리 slug, 대분류+소분류) 추가 → 35개 SSG.
3. `/skin/[type]/[category]`: `generateStaticParams`(6 피부타입 × 전 카테고리) 추가 → 210개 SSG.
4. `lib/queries`: `getActiveProductSlugs()` / `getAllCategorySlugs()` / `getSkinTypeSlugs()` 헬퍼 추가.
5. `getProductDetailPageData` 견고화: 결과가 이제 라우트 캐시에 하루 동안 박제되므로,
   쿼리 실패 시 조용히 빈 값으로 렌더하던 것을 **withRetry + throw**로 변경
   (틀린 "제품 없음"/가격 없는 페이지가 캐시되는 것 방지 — fetchAllData와 동일한 철학).
   관련상품 쿼리 실패는 기존대로 soft(빈 목록).

`/pick/[badge]/[category]`는 경량 redirect뿐이라 동적 유지.

## 주요 변경 파일

- `app/p/[slug]/page.tsx` — generateStaticParams + revalidate 86400
- `app/c/[category]/page.tsx` — generateStaticParams
- `app/skin/[type]/[category]/page.tsx` — generateStaticParams
- `lib/queries/index.ts` — slug 헬퍼 3종 + 상세 쿼리 에러 가드(withRetry/throw)

## 테스트 결과

- `npm run typecheck` ✅ (exit 0)
- `npm run test:weblayer` / `test:buildall` / `test:publicprices` ✅ ALL PASSED
- 변경 파일 대상 `npx eslint` ✅ 무경고 (repo 전체 lint의 7 errors는 untracked 스크립트의 기존 노이즈)
- `npm run build` ✅ — 빌드 테이블 검증:
  - `● /p/[slug] 1d` (144 paths), `● /c/[category] 1d` (35 paths, feminine-hygiene 포함),
    `● /skin/[type]/[category] 1d` (210 paths)

## 남은 이슈 / TODO

- 가격 신선도는 후속 PR(크롤 후 CI rebuild+deploy)이 담당 — Worker 위 ISR 재검증은
  10ms 한도로 신뢰 불가, 재검증 실패 시 stale 서빙(에러 아님)이라 안전.
- `/best`·`/best/[slug]`의 revalidate 3600→86400 완화는 별도 PR.
- 존재하지 않는 slug 요청은 여전히 동적 렌더(소프트 404가 URL별로 캐시됨) — 실해는 없으나
  추후 `notFound()` 전환 고려.
