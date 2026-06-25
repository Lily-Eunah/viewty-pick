# feature/volume-unit-and-price-display

## 요약
제품 용량 단위(ml/g/매)를 제품별로 관리하고, 정가·최저가·단위당가 표시를 단위에 맞게
정리한다. 패드(매)·그램(g) 제품이 "ml"로 잘못 보이던 문제를 해소하고, 정가 대비 할인
표시의 혼동을 줄인다. **할인율 계산 로직은 변경하지 않는다**(단위는 표시·라벨에만 영향).

배경: 정가 26,000원/70매 제품에 185매 14,250원 팩이 최저가로 잡히면 매당 정규화로 79%가
나오는데, 화면의 "정가 26,000 → 최저가 14,250"만 보면 79%가 어긋나 보였다. → 카드에서
정가 금액을 빼고, 상세에서 정가를 용량/규격 옆으로 옮기고 최저가 옆에 판매처 용량을 표기.

## 주요 변경 (커밋 단위)
1. `feat(db)`: 마이그레이션 `0017_product_volume_unit.sql` — `products.volume_unit text not null default 'ml'` (additive, products는 `select *`라 뷰/grant 변경 불필요).
2. `feat(sheets)`: products 시트에 `volume_unit` 헤더/스키마 추가(ml/g/매; 빈칸·미상→ml; 장/시트/p/매입→매), import 양쪽 경로 저장, `Product.volume_unit` 타입, 검증 테스트.
3. `feat(types)`: `mapToUIProduct`가 제품 단위를 store·product에 전달, `volume` 문자열을 `${volume_ml}${unit}`로, 숫자형 `volumeMl` 노출. `UIProduct.{volumeMl,volumeUnit}`, `UIStorePrice.volumeUnit`.
4. `feat(format)`: `perMl` → `perUnit(unitPrice, unit)` 일반화(ml당/매당/g당). `perMl`은 deprecated 별칭으로 유지.
5. `refactor(store-cards)`: `StorePriceCard`·`PriceTable`의 용량·단가 라벨 단위화.
6. `refactor(home)`: "정가 대비 최저가 픽" 카드 — 정가 금액 제거, 단위당가를 할인가 우측으로 이동(단위 반영). 할인 배지 유지.
7. `refactor(product-detail)`: 정가를 `용량/규격` 옆에 표기, 최저가 옆 취소선 정가 제거(% 배지만 유지), 최저가 판매처 용량이 기본 용량과 다르면 `14,250원 (185매)` 표기, 안내문구 단위화.

## 표시 규칙 (결과)
- ml 제품: 기존과 100% 동일("50ml", "ml당 …").
- 매/g 제품: "70매"/"15g", "매당/g당 …".
- 홈 픽 카드: `[정가 대비 N% 할인]` / `최저가 매당 …` / `판매처 비교` (정가 금액 미표시).
- 상세: `용량/규격: 70매 · 정가 26,000원`, 최저가 `14,250원 (185매)` + `정가 대비 79% 할인`.

## 테스트 결과
- `test:schemav2` — `volume_unit` 정규화(빈칸/미상→ml, g/ML, 매/장/시트/p/매입→매) 케이스 추가. PASS.
- `npm run test:all` — 전 스위트 ALL PASSED.
- `typecheck` 0 error · `lint` 0 error(기존 warning 8) · `build` Compiled successfully(static 11/11).

## 남은 이슈 / 운영 TODO
- merge 후: 마이그레이션 `0017` 적용 → `sheets:headers` → **운영자가 패드=매 / g제품=g 로 `volume_unit` 입력**(ml 제품은 비워도 됨) → `crawler:sync` → `cf:deploy`.
- 정가 미입력 제품은 할인 배지·정가·픽 미노출(의도된 동작).
- 제품 제목의 용량 파싱(매 일관화 / 동일제품 additive 합산 / 다른제품 증정 구분)은 **별도 branch**(`fix/title-volume-parsing`)에서 진행 예정.
