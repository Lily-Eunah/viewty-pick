# fix/coupang-image-keyword-q

`products.image_url`의 쿠팡 제품 URL을 productImage로 해석할 때, 검색 키워드에 **운영자가 그 제품을 찾은 실제 검색어(`q=`)** 를 1차로 사용해 적중률을 높임.

## 배경 / 문제
- 기존: image 해석 키워드 = `buildSearchKeyword(brand, name)` = 브랜드+제품명(ml/괄호 제거).
- Partners SEARCH API는 결과가 4~10건(광고성 셋)으로 제한적 → 그 키워드 검색결과에 image_url의 productId가 없으면 미해석(placeholder).
- 발견: 운영자가 넣은 쿠팡 URL의 `q=`(그 제품을 찾은 실제 검색어)가 brand+name과 다르고, **q=로 검색하면 그 productId가 더 잘 뜸**.
  - 실측: 몽디에스 엑설런트 선크림(productId 5529437152) — brand+name "몽디에스 엑설런트 선크림"으론 미노출, q="몽디에스 선크림"으론 노출.

## 변경
- `crawler/adapters/coupang.ts`
  - **`extractCoupangQuery(url)` 추가**: URL의 `q=` 추출 → URL-decode(`+`→공백, `%2B`→리터럴 `+`). 없거나 빈 값/디코드 실패면 `null`.
  - **`resolveCoupangImageFromUrl`**: 검색 키워드 순서를
    1. `q=`(운영자 검색어) → 2. `buildSearchKeyword(brand,name)` 폴백.
    - 두 키워드를 de-dupe(동일하면 1회만 검색) → 최대 2회 검색(rate limit 준수).
    - 검색결과를 **누적(merge)** 해 `pickCoupangImage`(anchored productId → brand-gated strict-identity 폴백)로 매칭. 1차에서 해석되면 2차 검색 skip.
    - 둘 다 실패 → `null`(placeholder). identity 폴백의 브랜드 강제·composition 무시 등 기존 이미지 규칙 그대로 유지.

## 테스트 (`crawler/adapters/__tests__/coupang.test.ts` Fixture 13)
- `extractCoupangQuery`: q= 추출+디코드(`몽디에스 선크림`), `+`→공백, `%2B`→`+`, q 없음/빈 값/빈 URL → null.
- 기존 `pickCoupangImage`/`buildSearchKeyword` identity·회귀 픽스처 전부 유지.
- `npm run test:coupang` / `test:all` / `typecheck` / `build` green (lint: 무관 파일 기존 warning 1건뿐).

## 한계 (정직하게)
- 체스트넛바하/에이시카365/세라믹선쿠션 등은 q=로도 Partners API가 결과에 안 줘서 여전히 placeholder일 수 있음(구조적 한계).
  - 그 경우 운영자가 **검색 상위에 잘 뜨는 다른 쿠팡 URL**로 image_url 교체가 유일한 추가 방법.

## TODO (merge 후)
- `crawler:sync` 실행 → 엑설런트 등 미해석이 줄었는지 확인.
