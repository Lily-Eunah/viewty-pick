# Claude Code 작업 프롬프트 — 카테고리 소스 통합 (_categories 단일화, 옛 categories 탭 제거)

> 목적: 카테고리 소스를 **`_categories` 시트 한 곳**으로 통합. import가 `_categories`(2단계)에서 대분류/소분류를
> 빌드하고, **옛 flat `categories` 탭 의존을 제거**한다(그 탭은 stale 이름이라 두면 import가 0012 rename을 revert함).
> 베이스: 최신 `main`. 분기 `refactor/category-source-unify`.

## 배경 (확인됨)
- 시트 `_categories` 탭이 이미 **import 소스 포맷**으로 구성돼 있음(내가 셋업):
  `대분류 | 대분류_slug | 소분류 | 소분류_slug | sort_order` (6 대분류 / 16 소분류, slug·sort는 0012와 일치).
- 옛 `categories` 탭(slug/name/sort_order, 8행)은 stale 이름(토너/앰플/클렌징) → `import.ts:152` slug-upsert가 0012의 새 이름(스킨/토너 등)을 **되돌림**. 제거 대상.
- `products.category`는 표준 소분류 **이름**(스킨/토너·에센스/세럼/앰플·클렌징폼/젤 …)으로 이미 정렬됨.

## 변경
1. **import: `_categories`에서 2단계 빌드** (Supabase·mock 양 경로):
   - `_categories` fetch(`_categories!A:Z`). 행별: major(대분류_slug,대분류,level='major',parent=null) upsert → minor(소분류_slug,소분류,sort_order,level='minor',parent=major id) upsert. onConflict slug.
   - **옛 `categories` 탭 fetch·upsert 제거**(rawCategories 경로 삭제). `validate.ts`의 categoryRowSchema → `_categories` 스키마로 교체.
2. **products.category 매핑**: upsert된 카테고리 중 **소분류**에서 `name === category || slug === category`로 category_id(=minor) 결정(현 로직 유지, 소스만 _categories). 못 찾으면 null + 리포트.
3. **0012**: parent_id/level 컬럼(ALTER)은 유지. seed는 이제 시트 주도라 0012 seed와 중복돼도 무해(idempotent). 코드에서 0012를 되돌리지 말 것.
4. 홈/`/c/[category]` 대·소분류 동작은 #27 그대로(데이터 소스만 바뀜).

## 테스트
- import가 `_categories`로 6 대분류/16 소분류를 빌드(parent/level/sort 정확), 옛 `categories` 탭 없이 동작.
- products.category(스킨/토너 등)가 올바른 minor에 매핑, 미스 리포트.
- 옛 categories 탭이 없거나 비어도 import 성공(fetch 제거 확인).
- mock 경로도 동일. `test:all`·typecheck·build·lint green.

## 시퀀싱 ⚠️ (중요)
- **이 PR 머지 전에는 `sheets:import` 돌리지 말 것** — 현 코드+stale `categories` 탭이 0012 rename을 revert하고 정렬된 products.category를 null로 만듦.
- 순서: PR 머지 → (0012 미적용이면) 0012 적용 → `sheets:import`(이제 _categories 기반) → 검증 → `cf:deploy`.
- 머지·검증 후 **옛 `categories` 탭 삭제 가능**(운영자/Cowork). 코드가 더는 안 읽음.

## 브랜치 & 커밋 / DoD
- `refactor/category-source-unify`: `refactor: source categories from _categories (2-tier) + drop flat categories tab`, `test: _categories import`, `docs: worklog`.
- 영어 PR → CI green → merge. `git diff --check`, 시크릿·`docs/prompts`·`tmp` 비커밋.
- **DoD**: import가 `_categories` 단일 소스로 2단계 빌드, 옛 탭 의존 제거, products.category 정상 매핑, revert 없음, test/CI green.

## 막히면
- `_categories` 헤더/포맷이 다르면 라이브 기준으로 맞추고 보고.
- mock fixture(mock_sheets_data)에도 _categories 추가 필요 시 반영.
