# feature/global-product-cache-isr

부하 개선 계획([docs/load-improvement-plan.md](../load-improvement-plan.md))의 **PR3 — 전역 1회 계산 + 페이지 ISR**.
PR2(R2+KV 캐시 인프라)를 실제로 활용해, 전 상품 매핑을 전역에서 하루 1번만 계산하고 리스트 페이지를 ISR로 캐시한다.

## 구현 요약

1. **전역 1회 계산** ([lib/queries/index.ts](../../lib/queries/index.ts))
   - 무거운 매핑(`fetchAllData` + 전 상품 `mapToUIProduct` + display-seller 게이트)을 순수 함수 `buildAllUIProducts(raw)`로 분리(테스트 가능).
   - `getAllUIProducts = unstable_cache(() => buildAllUIProducts(await fetchAllData()), ['all-ui-products'], { tags: ['products'], revalidate: 86400 })` — 전 페이지(홈/카테고리/스킨/best/검색)가 공유하는 **전역 1회/일** 계산. R2 인크리멘털 캐시에 저장.
   - `getProducts(filters)`는 이제 캐시된 전역 리스트를 받아 **필터+정렬만**(복사본 정렬로 캐시 배열 비변경). 시그니처·동작 동일.
2. **리스트 페이지 ISR** — `export const revalidate = 86400` 추가: [app/page.tsx](../../app/page.tsx)(홈), [app/c/[category]/page.tsx](../../app/c/%5Bcategory%5D/page.tsx), [app/skin/[type]/[category]/page.tsx](../../app/skin/%5Btype%5D/%5Bcategory%5D/page.tsx). (`/best`·`/best/[slug]`는 기존 revalidate 유지; `/c`는 client/정적, `/pick/*`는 redirect, `/search`는 searchParams 동적이나 캐시된 getProducts로 자동 수혜.)
3. **픽스처 테스트** — [lib/queries/__tests__/buildAllUIProducts.test.ts](../../lib/queries/__tests__/buildAllUIProducts.test.ts): 최저가 선택·정가대비 할인율(ml당)·display-seller 게이트(zigzag 제외)·link-only 행을 결정적으로 검증. `test:buildall` 등록 + `test:all`에 추가. (향후 Map 인덱싱 리팩터의 안전망.)

## 검증

- `npm run typecheck` — exit 0
- `npx eslint <changed>` — exit 0
- `npm run test:buildall` / `test:weblayer` / `test:publicprices` / `test:seomatch` — ALL PASSED
- `npm run cf:build` — green (ISR 페이지 + unstable_cache 번들 확인)

## 활성화 / 효과

- **다음 `cf:deploy` 시 효과 발생.** 홈·카테고리·스킨이 ISR로 캐시되어 매 요청 풀-DB 렌더가 사라짐. 전 상품 매핑은 페이지마다가 아니라 **전역 1회/일**.
- 가격 신선도: 시간기반 일 1회 revalidate(일간 크롤과 동일 주기).

## 보류 / 후속 (의도적)

- **온디맨드 revalidate(크롤러 → `revalidateTag('products')`) 보류.** Next 16.2.9에서 `revalidateTag`가 `(tag, profile: string | CacheLifeConfig)` 2-인자로 변경되어 시맨틱이 불확실(유효 profile 확인 불가) → 프로덕션 캐시 무효화를 불확실 API에 걸지 않음. unstable_cache의 `tags:['products']`는 유지(라벨만; 무해)해 후속에서 올바른 API(`'use cache'`+`cacheTag` 또는 확인된 `revalidateTag`)로 배선. 시간기반 일1회가 일간 크롤과 동일 신선도를 보장하므로 기능상 공백 없음. ([app/api/revalidate/route.ts](../../app/api/revalidate/route.ts)와 [crawler/run.ts](../../crawler/run.ts) 트리거는 이번엔 손대지 않음 — 원복.)
- **`mapToUIProduct` Map 인덱싱(O(N×L)→O(N+L))**: 안전망 테스트가 생겼으니 다음 차례. 전역 1회/일이라 우선순위는 낮아짐.
- **클라이언트 페이로드 경량화**(홈 `allProducts` 전량 직렬화 축소): 별도 후속.
</content>
