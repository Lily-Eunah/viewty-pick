# feature/regular-price-discount-only

## 요약
할인율 표시를 **시트 입력 정가(`regular_price`) 기준으로 일원화**한다.
기존에는 정가가 있으면 "정가 대비", 없으면 "공식몰 대비"로 폴백하면서 라벨은 동일하게
"정가 대비"로 표기 → 실제 숫자는 공식몰 기준인 오표시가 있었다. 공식몰 폴백을 **완전 제거**하여
모든 할인 표시·랭킹을 정가 대비 한 가지 기준으로 통일했다.

정가 미입력 제품은 할인 배지가 표시되지 않고 "정가 대비 최저가 픽" 랭킹에서도 제외된다
(오표시 방지). 운영자가 시트에 정가를 채워야 노출된다.

## 주요 변경 파일
- `lib/queries/index.ts`
  - `discountVsOfficial` / `officialPrice` 계산 블록 및 반환 필드 제거.
  - `discount` 정렬, `getOfficialPickProducts`, `getHomePageData`의 랭킹 키를
    `discountVsRegular ?? discountVsOfficial ?? 0` → `discountVsRegular ?? 0`로 변경.
- `lib/types.ts` — `UIProduct.officialPrice` / `discountVsOfficial` 필드 제거.
- `components/home/TodayDealSection.tsx` — 공식몰 폴백 배지·정가 폴백 라벨 제거, 주석 정정.
- `components/product/ProductCard.tsx` — 공식몰 폴백 배지 제거.
- `components/product/ProductListCard.tsx` — 공식몰 폴백 배지(`%↓`) 제거.
- `app/p/[slug]/page.tsx` — 공식몰 line-through 폴백 블록 제거(정가 분기만 유지).
- `components/product/CategoryProductList.tsx` — `discount` 정렬 폴백 제거.
- `components/home/HomeInteractiveSection.tsx` — 최근 본 상품 매핑에서 제거된 필드 정리,
  점수 설명 문구 "공식몰 대비 할인폭" → "정가 대비 할인폭".

## 문구 (대중적 표현으로 통일)
- 홈 헤드라인: `🏆 정가 대비 최저가 픽` / 부제 `정가 대비 할인폭이 큰 제품`
- 카드/홈 배지: `정가 대비 N% 할인`
- 리스트 카드(컴팩트): `정가 대비 N%↓`
- 상세: `정가 ₩XX,XXX`(취소선) + `N% 할인`

## 오표시 방지 규칙 (할인 = null → 미표시)
- 정가(`regular_price`) 없음/0/음수 → 할인 배지·랭킹 제외
- `discountVsRegular()` 자체 규칙 유지: DB 대표 용량 없음/0, 판매처 ml당 unreliable → null,
  판매가 ≥ 정가(낡은 정가) → 0%로 clamp(음수 금지)

## 테스트 결과
- `npm run typecheck` — 0 error.
- `npm run lint` — 0 error.
- `npm run test:all` — 전 스위트 ALL PASSED (weblayer의 `discountVsRegular` 케이스 포함, 변경된
  공식몰 필드 제거로 인한 회귀 없음).
- `npm run build` — Compiled successfully, static pages 11/11 생성.

## 남은 이슈 / 운영 TODO
- 코드 외 필수: 시트 `regular_price` 컬럼에 실제 정가 값이 채워져 있어야 할인이 노출됨.
  → `sheets:import` + `crawler:sync` 후 정가/할인 노출 확인 → `cf:deploy`.
- 정가는 DB 대표 용량 기준 단일값. 판매처 용량이 크게 다르면 ml당 정규화로 보정되나,
  정가 자체가 낡으면 0%로 떨어지므로 운영자가 시트에서 갱신 필요.
- 상세 혜택 분석표(PriceTable)에는 판매처별 할인률 미노출(헤드라인·카드만) — 기존과 동일.
