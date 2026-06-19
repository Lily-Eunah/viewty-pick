# Claude Code 작업 프롬프트 — 링크 없는 제품 숨기기 + 가격 없는 제품 맨 아래로 정렬

> 요구: (1) **네이버·쿠팡·올리브영 링크가 하나도 없는 제품은 목록에 표시하지 않음.** (2) **가격 정보가 하나도 없는 제품은 어떤 정렬을 쓰든 항상 맨 아래로.**
> 데이터 근거(현재 `lib/queries/index.ts`): UIProduct에 **`stores`**(노출 판매처=네이버/쿠팡/올영 listing만; zigzag/ably는 `isSellerDisplayed`로 제외) 와 **`hasAnyPrice`** 가 이미 있음. → `stores.length === 0` = 3사 링크 전무, `hasAnyPrice === false` = 가격 전무.
> 베이스: 최신 `main`. 분기 `feature/hide-linkless-sink-priceless`. 대상: `lib/queries/index.ts`(리스트 반환·정렬 함수들).

## 변경 1 — 링크 없는 제품 숨김(목록에서 제외)
- 모든 **목록 반환 경로**에서 `stores.length === 0`인 UIProduct를 **제외**:
  - `getProducts`, `getRecommendedProducts`, `getOfficialPickProducts`, `getHomePageData`(recommended/officialPicks/카테고리별), `getCategoryPageData`, `getPickPageData`, `getSkinPageData`, 상세의 `related`.
  - 가능하면 **uiProducts 빌드 직후 1곳에서 공통 필터**(`stores.length > 0`)로 적용해 모든 소비자가 상속받게. (중복 누락 방지)
- 주의: **가격은 없지만 링크는 있는 제품(`stores.length>0 && hasAnyPrice===false`)은 숨기지 않음** — 변경 2로 맨 아래 표시.
- 상세 페이지(`/p/[slug]`) 자체는 이 변경 범위 아님(목록만). 직접 URL 접근 동작은 기존 유지.

## 변경 2 — 가격 없는 제품 맨 아래로(정렬 무관)
- 모든 정렬에 **1차 키로 `hasAnyPrice`(가격 있는 것 먼저)** 를 적용한 뒤, 기존 정렬 기준(viewtyScore / 가격 / 할인률 등)을 2차로:
  - 공통 비교자 헬퍼 예: `byPriceThen(cmp) = (a,b) => a.hasAnyPrice!==b.hasAnyPrice ? (a.hasAnyPrice?-1:1) : cmp(a,b)`.
  - `getProducts`의 모든 sort 분기(viewtyScore/price/lowest/discount), `getRecommendedProducts`·`getHomePageData`·`getOfficialPickProducts`·`getCategoryPageData`·`getPickPageData`·`getSkinPageData`·`related` 정렬에 일괄 적용.
- 결과: 가격 있는 제품들이 위(각자 기준대로), 가격 없는 제품들이 항상 맨 아래(그들끼리는 기존 기준).

## 테스트
- 링크 0개(또는 zigzag/ably만) 제품 → 모든 목록에서 **미표시**.
- 링크 있음+가격 없음 제품 → 표시되되 **목록 맨 아래**(viewtyScore/가격/할인 어떤 정렬에서도).
- 가격 있는 제품 → 기존 정렬 유지(회귀 0).
- 빈 카테고리/필터 안전(에러 0). `test:all`·typecheck·build·lint green.

## 적용
- `feature/hide-linkless-sink-priceless`: `feat(web): hide products with no displayed-seller link; sort price-less products to bottom`, `test`, `docs: worklog`. 영어 PR → CI → merge → `cf:deploy` → 라이브에서 링크 없는 제품 미표시 + 무가격 제품 맨 아래 확인.

## 막히면
- 공통 필터/정렬 헬퍼를 한 곳에 두기 어려우면 각 함수에 동일 패턴으로 적용하되 누락 없게(목록 반환 함수 전수 점검). 상세 related도 포함.
