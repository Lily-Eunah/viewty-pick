# feature/image-none-sentinel

시트 `products.image_url`에 **`none`** 을 적으면 해당 제품을 "이미지 없음(자동수집 금지)"으로 처리하는 센티넬 추가.

## 배경 / 문제
- 크롤 Step 6.5(`crawler/run.ts`)의 자동 이미지 수집(`resolveCoupangImageAuto`)은 **이미지가 비어 있는 모든 제품**을 brand+name으로 검색해 채운다.
- 일부 제품(예: 토리든 밸런스풀 시카 오일 컨트롤 선스틱)은 쿠팡 제휴검색에 **깔끔한 단독컷이 없고 지저분한 포맨 판촉세트만** 뜬다. 그래서 DB/시트를 비워도 매 크롤이 그 세트컷을 다시 채워 넣어, **이미지를 "제거"할 방법이 없었다.**

## 변경
- **`lib/image.ts`** (신규): `NO_IMAGE_SENTINEL = 'none'` + `isNoImageSentinel(value)` (trim + case-insensitive). crawler·web 양쪽이 공유하는 순수 함수.
- **`crawler/run.ts`** Step 6.5: 루프 진입 직후 `isNoImageSentinel(currentImage)`이면 `image_url='none'`을 그대로 유지하고 `continue` — **liveness 체크·auto-resolve 모두 건너뜀** → 크롤이 다시 채우지 않음.
- **`lib/queries/index.ts`** `resolveDisplayImage`: 값이 센티넬이면 `''` 반환 → **쿠팡 fallback도 타지 않음**. 화면은 `ProductImageWithFallback`이 값이 http가 아니라 자동으로 **깔끔한 카테고리 플레이스홀더**를 렌더.
- import(`crawler/sheets/import.ts`)는 변경 불필요 — `'none'`은 쿠팡 제품페이지 URL이 아니므로 기존 pass-through로 그대로 DB에 저장됨.

## 동작 요약
| 레이어 | `none` 처리 |
|---|---|
| import | 그대로 저장 (기존 pass-through) |
| crawler Step 6.5 | 유지 + 자동수집 skip (핵심) |
| display | `''` 반환 → 카테고리 플레이스홀더 |

→ 앞으로 이미지 빼고 싶은 제품은 시트 image_url에 `none`만 넣으면 됨. 재사용 가능.

## 테스트
- `lib/queries/__tests__/webLayer.test.ts`에 추가(= `test:weblayer`, CI `test:all` 포함):
  - `isNoImageSentinel`: none/NONE/공백패딩 → true; ''/null/undefined/http URL/'nonexistent' → false.
  - `resolveDisplayImage`: 오퍼레이터 `none` → 쿠팡 리스팅 이미지가 있어도 `''`; 직접 URL → 그대로(회귀); 빈값+쿠팡 이미지 → 쿠팡 fallback(회귀); `none`+리스팅 없음 → `''`.
- `test:weblayer` ALL PASSED / `tsc --noEmit` 클린 / `npm run build` ✓ Compiled successfully.

## 배포 후 할 일
- 머지·배포 후 `pekc8co`(토리든 선스틱) 시트 image_url에 `none` 입력 → 다음 크롤부터 포맨 세트컷이 영구히 안 들어오고 플레이스홀더 표시.
