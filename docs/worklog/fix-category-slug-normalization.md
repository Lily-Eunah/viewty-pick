# fix/category-slug-normalization

## 문제
위생용품(Feminine Hygiene) 카테고리 페이지가 깨져 보였다:
- 헤더/히어로에 카테고리명 대신 `뷰티 제품`(null fallback) 출력
- 태그라인이 접두어 없이 `카테고리의 최저가 비교 리스트입니다.`만 출력
- "필터 조건에 부합하는 제품이 없음" (제품 0개)

## 근본 원인
1. **URL-비안전 slug**: 위생용품 대분류 slug가 다른 카테고리와 달리 `Feminine Hygiene`(공백+대문자)로
   하드코딩됨. `/c/Feminine%20Hygiene`의 `%20`이 DB 조회 시점까지 디코딩되지 않아
   `getCategoryBySlug('Feminine%20Hygiene')`가 null → 페이지 fallback.
2. **중복 카테고리 트리**: import가 `onConflict: 'slug'`로 upsert하고 옛 행을 지우지 않아,
   과거 slug 변경 이력으로 clean/dirty 두 트리가 공존했다:
   - major 위생용품: `feminine-hygiene`(1475) + `Feminine Hygiene`(1781)
   - minor Y존케어: `intimate-care`(1499, 제품1) + `Intimate Care`(1805, 제품0)
   실제 제품(천연 여성 청결제)은 clean 트리(1499)에 있는데 앱은 dirty 트리를 링크했다.
3. 그 외 소분류 8종 slug가 규칙(`^[a-z0-9-]+$`) 위반: `tanning/after-sun`, `lip&eye makeup remover`,
   `shampoo/scaler`, `scalp tonic`, `BB/CC`, `Concealer`, `Sun powder`, `Intimate Care`.

## 조치 (code → DB → sheet 순, DB를 sheet보다 먼저 해 재-중복 방지)

### 1. 코드 (이 브랜치)
- `app/c/page.tsx`: 카테고리 탐색 그리드 링크 `/c/Feminine%20Hygiene` → `/c/feminine-hygiene`
- `lib/data/categories.ts`: mock seed 8개 dirty slug → clean
- `crawler/sheets/mock_sheets_data.ts`: mock `_categories` slug → clean
- `components/common/ProductImageWithFallback.tsx`: 소분류→대분류 이미지 맵 키 clean화
- 제품→카테고리 매칭은 한글 이름 기준(`c.name === category`)이라 slug 변경이 제품 행에 영향 없음.

### 2. 프로덕션 DB (service-role, 백업 후 적용)
- 백업: categories 37행 + product category_map 155행 → JSON 저장
- 소분류 7개 **slug in-place rename** (id 유지 → 제품 연결 보존):
  1291 tanning-after-sun, 1292 lip-eye-makeup-remover, 1293 shampoo-scaler,
  1498 scalp-tonic, 1500 bb-cc, 1501 concealer, 1808 sun-powder
- dirty 중복 삭제: 1805(Intimate Care, 제품0) → 1781(Feminine Hygiene, 자식만 1805)
- 검증: 남은 BAD slug 0, 중복 이름 그룹 0, 총 37→35행

### 3. `_categories` 시트 (service-account, 이름쌍 매칭 후 적용)
- 9개 셀 clean slug로 batchUpdate (대분류 1 + 소분류 8)
- 이후 import는 clean slug row에 idempotent upsert → 재-중복 방지

## 테스트 / 검증
- `tsc --noEmit` 통과
- 로컬 next dev(실제 prod DB 연결) 렌더 검증:
  - `/c` 그리드 → `/c/feminine-hygiene` 링크(clean), dirty 링크 없음
  - `/c/feminine-hygiene` → 헤더/히어로 "위생용품", 태그라인 정상, 제품 "천연 여성 청결제" 노출
  - `/c/haircare`, `/c/base-makeup` → rename된 소분류 제품 + 카테고리 placeholder 이미지 정상 매칭

## 남은 이슈 / TODO
- ⚠️ **배포 필요**: DB/시트는 이미 prod 반영됨. 배포 전까지 prod의 **구버전 코드**는
  (a) 그리드가 삭제된 dirty URL을 링크(위생용품 여전히 깨짐 — 기존과 동일), (b) 이미지 fallback 맵이
  dirty 키라 rename된 소분류의 이미지 없는 제품이 일반 placeholder로 표시(경미/미관). **PR merge + cf:deploy로 수렴.**
- (선택) `getCategoryPageData`에서 category=null이면 `notFound()` 처리 → 죽은 카테고리 URL이 빈 200 대신 404.
- 백업 JSON 위치는 세션 scratchpad. 롤백 필요 시 categories 테이블 복원에 사용.
