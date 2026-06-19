# Claude Code 작업 프롬프트 — image_url 쿠팡 해석 키워드: URL의 q=(운영자 검색어) 활용해 적중률↑

> 배경: `products.image_url`의 쿠팡 제품 URL을 이미지로 해석할 때, 현재 검색 키워드는 `buildSearchKeyword(brand, name)` = **브랜드+제품명**(ml/괄호 제거). 그 키워드 검색결과에 image_url의 productId가 없으면 미해석(placeholder).
> 발견: 운영자가 넣은 쿠팡 URL에는 보통 **`q=`(그 제품을 찾은 실제 검색어)** 가 들어있고, 이게 brand+name과 다름(예: 엑설런트는 q="몽디에스 선크림", 현재 키워드는 "몽디에스 엑설런트 선크림"). **q=로 검색하면 그 productId가 더 잘 뜸**(실측: 엑설런트 productId가 brand+name으론 미노출이나 q="몽디에스 선크림"으론 노출됨).
> 단, Partners API는 결과가 4~10건으로 제한적(광고성 셋) → q=로도 못 잡는 제품이 있음(구조적 한계, placeholder 유지).
> 베이스: 최신 `main`. 분기 `fix/coupang-image-keyword-q`. 대상: `crawler/adapters/coupang.ts`(`resolveCoupangImageFromUrl`/`buildSearchKeyword` 호출부).

## 변경
- `resolveCoupangImageFromUrl(url, brand, name)`에서 검색 키워드 결정:
  1. URL에서 **`q=` 파라미터 추출**(URL-decode, `+`→공백). 있으면 **1차 검색 키워드 = q**.
  2. q 검색결과에서 anchored productId 매칭 시도(기존 anchor → brand-gated identity 폴백 순).
  3. **q로 미해석이면 기존 `buildSearchKeyword(brand,name)`로 2차 검색** 후 동일 매칭(두 검색결과를 합쳐 anchor 찾아도 됨).
  4. 둘 다 실패 → `null`(placeholder). (Partners API 한계 — 정직하게.)
- rate limit 준수(검색 1~2회). identity 폴백의 **브랜드 강제(brandMatchesTitle)·composition 무시(이미지)** 등 기존 이미지 규칙 유지.

## 테스트
- image_url에 q= 있음 + 그 productId가 q 검색에 있음 → 해석(엑설런트 케이스: q="몽디에스 선크림" → productId 5529437152 해석).
- q 없음 → 기존 brand+name로(회귀).
- q·brand+name 둘 다 미노출 → null(placeholder), 에러 0.
- 일반 이미지 URL(.jpg) 패스스루 회귀.
- `test:all`·typecheck·build·lint green.

## 적용
- `fix/coupang-image-keyword-q`: `fix(image): use coupang URL q= as search keyword (operator's query) with brand+name fallback`, `test`, `docs: worklog`. 영어 PR → CI → merge → `crawler:sync` → 미해석 줄었는지(엑설런트 등) 확인.

## 참고 (한계 명시)
- 체스트넛바하/에이시카365/세라믹선쿠션 등은 q=로도 Partners API가 결과에 안 줘서 여전히 placeholder일 수 있음 → 그 경우 운영자가 **검색 상위에 잘 뜨는 다른 쿠팡 URL**로 교체하는 게 유일한 추가 방법.
