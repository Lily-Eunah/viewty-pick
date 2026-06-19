# feature/regular-price-discount

## 요약
products 시트에 추가된 `regular_price`(정가/MSRP) 컬럼을 import→DB→화면으로 흘려
**정가 대비 할인률**을 계산·표시한다. 정가는 DB 대표 용량(`volume_ml`) 기준이고,
판매처별 용량이 다를 수 있으므로 할인률은 **ml당 기준으로 정규화**한다
(per-retailer-volume / migration 0014와 일관).

할인률 = `round((정가ml당 − listing.unit_price) / 정가ml당 × 100)`
- 정가ml당 = `regular_price / volume_ml`
- listing.unit_price = 그 판매처의 ml당 가격 (view에서 reliable일 때만 노출)

## 주요 변경 파일
- `supabase/migrations/0015_product_regular_price.sql` — `products.regular_price numeric null`
  단일 additive 컬럼. products는 `select *`로 읽으므로 뷰/grant 변경 불필요.
- `crawler/sheets/validate.ts` — `simpleProductRowSchema.regular_price`
  (빈칸/0/음수/비숫자 → null, 양수만 number).
- `crawler/sheets/import.ts` — Supabase·mock 두 경로 모두 `regular_price` 저장.
- `crawler/sheets/setup_headers.ts` — products 헤더에 `regular_price` append (시트 col L).
- `crawler/sheets/mock_sheets_data.ts` — 첫 제품에 정가 샘플값; 배열 타입 명시.
- `lib/types.ts` — `Product.regular_price`, `UIProduct.{regularPrice,discountVsRegular}`,
  `UIStorePrice.discountVsRegular`.
- `lib/queries/index.ts` — 순수 함수 `discountVsRegular()`, 판매처별 할인률 계산,
  헤드라인(최저가 판매처) 할인률 노출, `discount` 정렬은 정가 기준 우선(없으면 공식몰 폴백).
- `app/p/[slug]/page.tsx` — 가격 영역에 "정가 ₩ / N% 할인" 배지. 정가가 있으면 정가 기준
  우선, 없으면 기존 "공식몰 대비 X% 저렴" 폴백 (둘 중 하나만).
- `components/product/ProductCard.tsx` — 카드 최저가 아래 정가 대비(폴백 공식몰) 할인 라벨.

## 오표시 방지 규칙 (할인률 = null → 미표시)
- `regular_price` 없음/0/음수
- `volume_ml`(DB 대표 용량) 없음/0
- 판매처 ml당(`unit_price`)이 없음/unreliable
- 판매가 ≥ 정가(낡은 정가) → 음수 대신 **0%로 clamp** (미표시되거나 0% 노출)

## 테스트 결과
- `test:weblayer` — `discountVsRegular` 6 케이스 추가(같은 용량 20%, 다른 용량 ml당 정규화,
  정가 빈칸/0 → null, 용량 0/null → null, ml당 null/0 → null, 판매가≥정가 → 0). ALL PASSED.
- `test:schemav2` — `regular_price` 파싱 4 케이스(숫자/빈칸/누락/0·음수·비숫자) 추가. ALL PASSED.
- `npm run test:all` ALL PASSED · `typecheck` 0 error · `lint` 0 error(기존 warning 1) · `build` green.

## 남은 이슈 / 운영 TODO
- merge 후: migration 0015 적용 → `sheets:headers`(헤더 동기화) → `sheets:import` →
  `crawler:sync` → 정가/할인률 노출 확인 → `cf:deploy`.
- 정가는 DB 대표 용량 기준 단일값. 판매처 용량이 DB와 크게 다른 경우 ml당 정규화로
  보정되지만, 정가 자체가 낡으면 0%로 떨어지므로 운영자가 시트에서 갱신 필요.
- 상세 혜택 분석표(PriceTable)에는 판매처별 할인률을 아직 노출하지 않음(헤드라인·카드만).
  필요 시 `UIStorePrice.discountVsRegular`로 후속 추가 가능.
