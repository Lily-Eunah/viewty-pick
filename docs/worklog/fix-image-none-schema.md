# fix/image-none-schema

`feature/image-none-sentinel`(PR #113) 후속 핫픽스. `none` 센티넬이 **import 스키마 검증**을 통과하도록 허용.

## 사고 / 원인
- PR #113 배포 후 `pekc8co`(토리든 밸런스풀 시카 오일 컨트롤 선스틱) 시트 image_url에 `none` 입력 → 크롤 실행.
- 결과: 해당 **제품이 비활성화(is_active=false)** 되어 사이트에서 사라짐. 로그: `[1] Product: image_url invalid_format url "Invalid URL"` + `Badge skipped: ... not found` + `deactivated 1 orphan products`.
- 근본: `crawler/sheets/validate.ts`의 `simpleProductRowSchema.image_url = z.string().url().or(z.literal('')).optional()` — **URL/빈값만 허용**. `none`이 URL이 아니라 행 전체 검증 실패 → 그 제품이 import 대상에서 빠짐 → DB 제품이 orphan으로 reconcile 비활성화. PR #113이 run.ts/display만 고치고 **import 스키마를 놓침**.

## 변경
- `crawler/sheets/validate.ts`: `image_url`을 refine으로 변경 — **빈값 / `none` 센티넬(isNoImageSentinel, 대소문자·공백 무시) / 유효 URL** 중 하나면 통과, 그 외(임의 문자열)는 여전히 거부.

## 테스트
- `crawler/sheets/__tests__/schema_v2.test.ts`(= `test:schemav2`, CI 포함)에 image_url 검증 5케이스 추가: URL/빈값/`none`/`NONE`·` none `/garbage. ALL PASSED. `tsc --noEmit` 클린.

## 배포 후
- 머지·배포 + 크롤 재실행 → pekc8co가 `none`으로 **재활성화**되고 이미지 대신 카테고리 플레이스홀더 표시.
