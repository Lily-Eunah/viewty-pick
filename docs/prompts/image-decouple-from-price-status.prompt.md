# Claude Code 작업 프롬프트 — 이미지를 가격 status와 분리 (가격 warning이어도 이미지는 표시)

> 버그(라이브 QA): 쿠팡 가격이 ml(용량) mismatch 등으로 **warning → inspection**에 들어가 *숨겨지면*, 그 쿠팡 listing의 **이미지까지 같이 사라짐**. 원인: 표시 이미지 해석이 `isDisplayablePriceSnapshot`(status='ok') / ok-only 공개뷰에 묶여 있어, warning listing의 이미지를 못 가져옴.
> **원하는 동작: 가격은 ok일 때만 노출, 이미지는 가격 status와 무관하게 쿠팡 listing에서 가져와 표시.** (쿠팡 Partners 이미지는 노출 OK; 가격 신뢰성과 이미지는 별개.)
> 베이스: 최신 `main`. 분기 `fix/image-decouple-from-price-status`. 대상: `lib/queries/index.ts`의 `resolveDisplayImage`(및 이미지가 ok-only 뷰/스냅샷에 의존하는 부분), 필요 시 쿼리/뷰.

## 변경
- `resolveDisplayImage` 우선순위 유지: **operator image(=image_url 해석 결과) → 쿠팡 listing 이미지 → placeholder**. 단, **"쿠팡 listing 이미지"를 가격 status로 거르지 말 것**:
  - 쿠팡 listing의 `latest_image_url`(크롤 때 offer.imageUrl로 세팅, 가격과 별개로 listing 행에 저장됨)을 **status='ok'/'warning' 무관하게** 사용.
  - 즉 이미지 소스는 ok-only 공개뷰(`listing_prices_public`/`current_prices`)가 아니라 **listing 행의 latest_image_url**에서 직접.
- **가격 노출은 그대로**: warning/inspection 가격은 계속 숨김(status='ok'만 가격 노출). 이 변경은 **이미지에만** 적용 — 가격 표시 로직 변경 0.
- image_url(operator) 해석 이미지가 있으면 그게 우선(기존 precedence 유지).

## 테스트
- 쿠팡 가격 warning(inspection行) 제품: **가격은 숨김 + 이미지는 그 쿠팡 listing 이미지 표시**(placeholder 아님).
- 쿠팡 가격 ok 제품: 가격+이미지 그대로(회귀 0).
- image_url에 쿠팡 URL(이미지전용) 제품: operator 해석 이미지 우선(회귀 0).
- 쿠팡 listing·이미지 둘 다 없음: placeholder.
- `test:all`·typecheck·build·lint green.

## 적용
- `fix/image-decouple-from-price-status`: `fix(web): show coupang listing image even when price is warning (decouple image from price status)`, `test`, `docs: worklog`. 영어 PR → CI → merge → `cf:deploy` → 라이브에서 (a)warning 가격 제품에 이미지 뜨는지 (b)가격은 여전히 숨는지 확인.

## 막히면
- listing 행에 latest_image_url이 없고 이미지가 스냅샷/뷰에만 있으면, 뷰를 status 무관 이미지용으로 보강하거나 listing 테이블에서 직접 select. 가격 노출(ok-only)은 절대 건드리지 말 것.
