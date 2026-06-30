# refactor/list-query-cleanup

부하 개선 계획([docs/load-improvement-plan.md](../load-improvement-plan.md))의 **PR1 — 무위험 정리 작업**.
캐시 인프라(PR2) 없이도 즉시 렌더 비용을 줄이는, 동작 보존(behavior-preserving) 변경만 포함.

## 구현 요약

1. **미사용 `current_prices` fetch 제거** (`refactor`)
   - `fetchAllData()`가 매 렌더마다 `current_prices` 전체를 `select('*')`로 가져와 `mapToUIProduct`에 `dbPrices`로 넘겼으나, 본문에서 **한 번도 참조되지 않던 dead code**였다. (카드/리스트 가격은 `listing_prices_public` 뷰에서 나온다.)
   - 제거 효과: **렌더당 Supabase 풀테이블 쿼리 1개 감소** + `dbPrices` 파라미터 배선 정리(시그니처·전 호출부).
   - `current_prices` 테이블/크롤러 쓰기 경로는 그대로(운영용). 웹 렌더 경로에서만 미사용분 제거.

2. **`getSeoPageData`를 React `cache()`로 래핑** (`perf`)
   - `/best/[slug]`가 `generateMetadata`와 페이지 본문에서 `getSeoPageData(slug)`를 **2번 호출** → 전 상품 `mapToUIProduct` 매핑 + `matchSeoProducts`가 요청당 2회 실행되던 것을, slug 키 기반 per-request dedup으로 **1회**로 축소. 가장 무거운 페이지의 렌더 비용 절반.

## 주요 변경 파일

- `lib/queries/index.ts`
  - `mapToUIProduct` 시그니처에서 `dbPrices` 제거 + 전 호출부(getProducts / getProductBySlug / getProductDetailPageData supabase·mock 경로) 인자 정리
  - `RawData`에서 `dbPrices` 제거, `fetchAllData`의 `current_prices` 쿼리·반환 제거(supabase·mock 양쪽), `CurrentPrice` import 제거
  - `getSeoPageData`: `export async function` → `export const … = cache(async …)`

## 테스트 결과

- `npx tsc --noEmit` — clean
- `npx eslint lib/queries/index.ts` — clean
- `npm run test:weblayer` — ALL PASSED
- `npm run test:publicprices` — ALL PASSED
- `npm run test:seomatch` — ALL PASSED

(웹 테스트는 순수 헬퍼/뷰 매핑만 검증하며 `mapToUIProduct`·`dbPrices`·`current_prices`를 직접 참조하지 않음 → 시그니처 변경에 영향 없음.)

## 남은 이슈 / TODO (후속 PR)

- **PR2 (기반):** R2 인크리멘털 캐시 + KV 태그 캐시 연결 → ISR 실작동. 절차: [docs/cloudflare-cache-setup.md](../cloudflare-cache-setup.md). 운영자 R2/KV 프로비저닝 필요.
- **PR3 (핵심):** `getProducts`를 `unstable_cache` + `products` 태그 + 일1회 revalidate로 → **전역 1회/일 계산**. 홈/카테고리/`/best` ISR 선언. **`mapToUIProduct` Map 인덱싱(O(N×L)→O(N+L))은 여기로 이관** — 출력 검증 테스트(픽스처)를 먼저 추가한 뒤 적용(현재 mapToUIProduct end-to-end 테스트 부재로 PR1에서 의도적으로 제외). 사이트맵의 force-dynamic + getProducts 풀매핑 낭비도 함께 해소.
- **PR4 (상세):** `/p/[slug]` `revalidate` + 크롤러 온디맨드 revalidate(`revalidateTag('products')`).
</content>
