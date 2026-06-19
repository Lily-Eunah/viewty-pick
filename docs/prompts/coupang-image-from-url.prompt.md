# Claude Code 작업 프롬프트 — image_url의 쿠팡 제품 URL → 쿠팡 API로 이미지 받아 표시

> 목적: 쿠팡이 공식 판매처가 아니어서 이미지가 없는 제품을 위해, 운영자가 `products.image_url`에 **이미지가 좋은 쿠팡 제품 URL**을 넣어두면, sync 때 **쿠팡 API로 그 productImage를 받아 표시 이미지로** 쓴다. (현재는 image_url을 *그대로* <img>로 써서 쿠팡 제품페이지 URL은 깨짐 → placeholder.)
> 베이스: 최신 `main`. 분기 `feature/coupang-image-from-url`. 대상: `crawler/sheets/import.ts`(또는 run.ts) 제품 이미지 처리 + 쿠팡 어댑터 재사용.

## 동작
1. **감지**: 제품의 `image_url`(시트값)이 **쿠팡 제품 URL**(`coupang.com/.../products/{id}` 또는 `/vp/products/{id}`)이면 → "이미지 소스"로 간주. (일반 이미지 URL(.jpg/.png/`ads-partners.coupang.com/image…`)이면 그대로 사용.)
2. **이미지 해석**: 쿠팡 **Partners 검색 API**(기존 어댑터 재사용)로 제품의 productImage 확보:
   - URL에서 productId 추출 → 검색(키워드=brand+name)에서 그 productId가 있으면 그 항목의 `productImage`,
   - 없으면(검색 미노출) **identity 일치하는 최상위 쿠팡 결과의 productImage**(같은 제품이면 이미지 동일 — 이미지엔 관대해도 됨)로 폴백, 그것도 없으면 이미지 미해석.
3. **저장**: 해석된 productImage를 **DB `products.image_url`(표시용)** 에 저장. **시트의 쿠팡 URL은 그대로 둠**(매 sync마다 재해석 = 신선한 이미지; 쿠팡 이미지 URL은 회전될 수 있어 시트 write-back보다 안전). resolveDisplayImage 우선순위(operator image → 쿠팡 listing → placeholder)에서 이 해석된 이미지가 operator image 자리로 들어감.
4. **실패**: 해석 실패 시 DB image_url은 비워(placeholder 폴백). 쿠팡 제품페이지 URL을 그대로 <img>에 넣지 말 것(깨짐).

## 제약 (정직하게)
- 쿠팡 Partners API는 **검색 전용**(productId 직접 조회 없음) → 그 제품이 검색 top-10에 안 뜨면 이미지 못 받음 → placeholder. 가격 매칭과 같은 한계.
- 쿠팡 rate limit(50/min·2s 간격) 준수 — 기존 어댑터 흐름 재사용.

## 테스트
- image_url=쿠팡 제품 URL + 검색에 그 제품 있음 → productImage가 DB image_url에 저장(쿠팡 제품페이지 URL이 그대로 안 들어감).
- image_url=일반 이미지 URL(.jpg) → 그대로 사용(회귀).
- image_url=쿠팡 URL인데 검색 미스 → DB image_url 비움(placeholder).
- 시트의 쿠팡 URL은 변경 안 됨(재해석용 유지).
- `test:all`·typecheck·build·lint green.

## 브랜치 & 적용
- `feature/coupang-image-from-url`: `feat: resolve coupang product URL in image_url to productImage via API`, `test`, `docs: worklog`. 영어 PR → CI → merge → `crawler:sync` → 쿠팡 비공식 제품들(라하토너·레스트업·온그리디언츠 등)에 이미지 표시 확인 → `cf:deploy`.
- 시트엔 이미 34개 제품에 쿠팡 제품 URL이 image_url로 들어가 있음(복구 완료) → 이 기능 머지 후 sync면 이미지 붙음.

## 막히면
- "이미지 소스" 판별을 image_url 도메인으로(coupang.com/products) 하되, 일반 이미지 URL과 확실히 구분. 애매하면 그대로 이미지로 두고 보고.
- productId 검색 미스가 잦으면, 검색 키워드를 brand+name로(가격 매칭과 동일) + identity 가드로 최상위 이미지 채택.
