# feature/hide-linkless-sink-priceless

## 구현 요약
목록(list) 표시 규칙 2가지를 `lib/queries/index.ts`에 추가했다.

1. **링크 없는 제품 숨김** — 노출 판매처(네이버/쿠팡/올영) 링크가 하나도 없는 제품
   (`stores.length === 0`)은 모든 목록에서 제외한다. `stores`는 `mapToUIProduct`에서
   이미 `isSellerDisplayed`로 display-enabled 판매처만 남기므로, 빈 배열 = 3사 링크 전무
   (zigzag/ably-only · link-less 제품). **가격은 없지만 링크는 있는 제품
   (`stores.length>0 && hasAnyPrice===false`)은 숨기지 않고** 변경 2로 맨 아래에 둔다.

2. **가격 없는 제품 맨 아래로** — 모든 정렬에 1차 키로 `hasAnyPrice`(가격 있는 것 먼저)를
   적용하고, 기존 기준(viewtyScore / 가격 / 할인률)을 2차로 둔다. 가격 있는 제품들은 각자
   기준대로 위에, 무가격 제품은 그들끼리 기존 기준으로 항상 맨 아래.

## 주요 변경 파일
- `lib/queries/index.ts`
  - 신규 export 헬퍼:
    - `hasDisplayedSellerLink(p)` = `p.stores.length > 0` (목록 가시성 게이트)
    - `byPriceThen(cmp)` = `(a,b) => a.hasAnyPrice!==b.hasAnyPrice ? (a.hasAnyPrice?-1:1) : cmp(a,b)`
  - `getProducts`: uiProducts 빌드 직후 **공통 필터** `.filter(hasDisplayedSellerLink)` 1곳
    적용 → 모든 목록 소비자(`getRecommendedProducts`, `getOfficialPickProducts`,
    `getHomePageData`, `getCategoryPageData`, `getPickPageData`, `getSkinPageData`)가 상속.
  - `getProducts`의 4개 sort 분기(recommend/popularity, price_asc, price_desc, discount)를
    모두 `byPriceThen(...)`으로 래핑.
  - `getRecommendedProducts`, `getOfficialPickProducts`, `getHomePageData`(recommended /
    officialPicks) 정렬에 `byPriceThen` 일괄 적용.
  - `getProductDetailPageData`의 `related`(Supabase·mock 양쪽): map 후
    `.filter(hasDisplayedSellerLink).sort(byPriceThen(viewtyScore desc))` 적용. mock 경로는
    매핑→필터→정렬→`slice(0,6)` 순으로 재배치(필터 후 6개 보장).
- `lib/queries/__tests__/webLayer.test.ts`: `hasDisplayedSellerLink` 3건, `byPriceThen` 3건 추가.

## 범위 밖(의도적으로 미변경)
- 상세 페이지(`/p/[slug]`) 자체와 `getProductBySlug`: 직접 URL 접근 동작 기존 유지(목록만 대상).
- price_asc는 `askPrice`가 무가격을 +∞로 보내 이미 뒤로 가지만, 일관성 위해 동일하게 래핑(무해).

## 테스트 결과
- `npm run test:weblayer` — ALL PASSED (신규 6건 포함)
- `npm run test:all` — ALL PASSED
- `npm run typecheck` — 0 errors
- `npm run lint` — 0 errors (사전 존재 warning 1건은 무관 파일)
- `npm run build` — 성공

## 남은 이슈 / TODO
- merge 후 `cf:deploy` → 라이브에서 (1) 링크 없는 제품 미표시, (2) 무가격 제품이 모든
  정렬에서 맨 아래인지 확인.
