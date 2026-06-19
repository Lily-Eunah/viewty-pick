# Claude Code 작업 프롬프트 — 쿠팡 이미지 identity 게이트 교정 (브랜드 강제 + composition 무시) + 제품별 해석

> 라이브 사고: VDL/아이소이에 **"대라(DAERA) 스킨케어링 쿠션"**(제3 브랜드) 이미지가 들어감. 원인 3가지:
> **(1) identity가 브랜드를 안 봄** — `passesImageIdentity`가 제품 **name만**(예: "스킨케어 비건 쿠션", 브랜드 제외)으로 비교 → DAERA가 일반토큰(스킨케어·쿠션) 겹침 + distinctive substring(스킨케어⊂스킨케어링)으로 통과.
> **(2) composition 필터가 이미지엔 독** — 진짜 아이소이(rank0 "…비건 쿠션 21호 **본품+리필**")가 `classifyOfferComposition!=='single'`로 거부 → 정답 탈락 → DAERA 단품 채택. 이미지엔 세트/번들 거부 불필요(같은 제품 사진).
> **(3) URL 캐시 충돌** — `resolveProductImages`가 image_url 문자열로 dedup → 같은 URL을 가진 두 제품(운영자 오입력)을 먼저 행의 brand+name으로 한 번만 해석해 둘 다에 적용.
> 베이스: 최신 `main`. 분기 `fix/coupang-image-identity-fix`. 대상: `crawler/adapters/coupang.ts`(`passesImageIdentity`/`pickCoupangImage`/`resolveCoupangImageFromUrl`), `crawler/sheets/import.ts`(`resolveProductImages`).

## 변경 1 — identity 게이트에 브랜드 강제
- `passesImageIdentity`(및 `pickCoupangImage`)에 **brand 인자 추가**. 후보 `productName`에 **제품 브랜드가 포함돼야 통과**.
  - 브랜드 매칭은 공식몰과 동일한 **단어경계/정규화**(trim·연속공백1·영문 대소문자 무시·한글은 `(^|\s)…(\s|$)` 또는 토큰 포함). 한글 브랜드 별칭이 있으면(예: VDL=브이디엘, 대라=DAERA) 그 처리는 기존 normalize 재사용; 없으면 표기 그대로 비교.
  - 브랜드가 비어있으면(없으면) 폴백 통과 불가(안전쪽 = 미해석).
- 기존 `productIdentityScore ≥ IMAGE_IDENTITY_SIMILARITY` + `distinctiveTokens` + `hasFormConflict` 유지.

## 변경 2 — 이미지 경로에선 composition(세트/번들) 거부 제거
- `passesImageIdentity`에서 `classifyOfferComposition(t).kind !== 'single'` 거부 **삭제**(이미지엔 본품+리필/기획세트도 같은 제품 사진이라 허용).
- **단 `hasFormConflict`(토너↔패드 등 형태 충돌)는 유지** — 형태가 다르면 사진도 다르니 거부.
- anchored productId 직접 매칭(1순위)은 그대로.

## 변경 3 — URL이 아닌 "제품별" 해석 (캐시 충돌 제거)
- `resolveProductImages` dedup 키를 **raw URL → (raw + brand + name)** 또는 제품 행 단위로. 한 제품의 해석 결과가 다른 제품에 새지 않게. 같은 URL이라도 각 제품의 brand+name으로 각각 해석.
- (선택) 서로 다른 product_key가 동일 image_url → import 경고 로그.

## 테스트
- "아이소이"(brand) + "스킨케어 비건 쿠션" 폴백 → **DAERA(대라) 거부**(브랜드 불일치), 진짜 아이소이 "본품+리필"은 **통과**(composition 무시) → 아이소이 이미지.
- VDL: anchor productId 9216167170 검색에 있음 → 그 이미지(폴백 안 탐).
- anchor 없음 + 같은 브랜드 동일제품 결과 없음 → `null`→placeholder.
- `hasFormConflict`(토너 vs 패드) 케이스는 여전히 거부.
- 같은 image_url을 가진 서로 다른 두 제품 → 각자 brand+name으로 해석(누수 0).
- 가격 매칭 경로 회귀 0. `test:all`·typecheck·build·lint green.

## 적용
- `fix/coupang-image-identity-fix`: `fix(image): enforce brand in coupang image identity, ignore composition for images, resolve per-product`, `test`, `docs: worklog`. 영어 PR → CI → merge → `crawler:sync` → VDL/아이소이/그 외 이미지 정확성 + placeholder 확인 → `cf:deploy`.

## 참고 / 대안
- 가격 매칭의 identity/composition은 **건드리지 않음**(이미지 전용 수정).
- 더 보수적으로 가려면 "anchor 전용(폴백 제거)"도 가능하나, 운영자가 같은 브랜드 다른 리스팅 이미지까지 살리려면 위 교정안이 커버리지·안전 균형이 나음.
