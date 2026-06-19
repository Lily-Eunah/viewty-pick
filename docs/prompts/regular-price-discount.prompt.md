# Claude Code 작업 프롬프트 — products 정가(regular_price) → 정가 대비 할인률 계산·표시

> 목적: products 시트에 **`regular_price`(정가/MSRP)** 컬럼 추가됨(이미 시트에 헤더 존재, col L). 이걸 import→DB→화면으로 흘려 **정가 대비 할인률**을 계산·표시.
> 전제: `regular_price`는 **DB 대표 용량(`volume_ml`) 기준 정가**. 판매처별 용량이 다를 수 있으므로 할인률은 **ml당 기준으로 정규화**(per-retailer-volume와 일관).
> 베이스: 최신 `main`. 분기 `feature/regular-price-discount`. 대상: `crawler/sheets/import.ts`·`validate.ts`(스키마), DB migration(products.regular_price), `lib/queries`·제품 페이지(할인률 표시).

## 변경
1. **시트 스키마/Import**: `simpleProductRowSchema`에 `regular_price`(빈칸 허용, 양수 number 또는 ''→null) 추가. products 동기화 시 `regular_price` 저장.
2. **DB migration**(다음 번호, 예 0015): `products.regular_price numeric null` 추가(맨 뒤 append, 기존 order/grants 유지). 공개 뷰/쿼리에서 읽을 수 있게 노출.
3. **할인률 계산**(`lib/queries`):
   - 정가 ml당 = `regular_price / volume_ml`(정가·용량 있을 때만).
   - 각 listing 할인률 = `round((정가ml당 − listing.unit_price) / 정가ml당 × 100)` (unit_price = 그 listing의 ml당). 같은 용량이면 총가 기준과 동일.
   - 헤드라인: 최저가 판매처의 할인률을 "정가 X원 · N% 할인" 식으로.
   - 정가 없거나 0/음수, 또는 unit_price 신뢰불가면 할인률 **표시 안 함**(null) — 오표시 금지.
   - 판매가 > 정가면 할인률 음수 대신 **0% 또는 미표시**(정가가 낡았을 수 있음).
4. **표시**: 제품 페이지·카드에 "정가 ₩ / N% 할인" 노출. 기존 "공식몰 대비 X%"가 있으면, **정가가 있으면 정가 기준 우선**, 없으면 기존 로직 폴백(둘 중 하나만 깔끔히).

## 테스트
- regular_price=30000, volume_ml=100, 최저가 listing 24000(100ml) → 20% 할인 표시.
- 다른 용량 listing(80ml)도 ml당 기준 할인률 정확.
- regular_price 빈칸 → 할인률 미표시(회귀 0, 에러 0).
- 판매가>정가 → 0%/미표시.
- `test:all`·typecheck·build·lint green.

## 적용
- `feature/regular-price-discount`: `feat: regular_price (정가) import + discount vs MSRP (ml당-normalized) display`, `test`, `docs: worklog`. 영어 PR → CI → merge → migration 0015 적용 → `sheets:import`+`crawler:sync` → 할인률 노출 확인 → `cf:deploy`.

## 막히면
- 할인률 정규화가 복잡하면 1차로 **같은 용량 가정(총가 기준)** 으로 단순 계산하고, 다른 용량은 ml당으로 후속. 단 정가 없을 때 미표시는 반드시.
