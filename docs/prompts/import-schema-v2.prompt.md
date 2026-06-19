# Claude Code 작업 프롬프트 — 통합 import 개편 (categories=_categories · wide badges · slug · product_key freeze)

> 목적: 시트 구조 v2에 맞춰 import를 한 번에 개편한다.
> ① 카테고리 소스를 `_categories`로 통합(옛 `categories` 탭 제거) ② 뱃지를 **위치기반 wide-per-source**로 읽기
> ③ **slug(optional URL)** 지원 ④ **product_key 자동 생성 + 시트에 freeze**(이름 변경에도 키 불변) ⑤ links/badges는 **동기화된 product_name으로 join**.
> 베이스: 최신 `main`. 분기 `feature/import-schema-v2`.
> ⚠️ 이 PR은 **다음 `sheets:import` 전 반드시 머지** — 현 import는 옛 구조라 v2 시트에서 깨지고, 옛 `categories` 탭이 0012 rename을 revert함.
> (이 프롬프트는 `category-unify-into-_categories.prompt.md`를 대체·포함한다.)

## 시트 v2 현황 (이미 적용됨 — Cowork가 셋업)
- **products**: `product_key, name, brand, category, volume_ml, skin_types, features, hwahae_url, image_url, is_disabled, slug`
  - product_key: 기존 45개는 고정값 채워짐(djb2 해시). 신규는 비어서 들어옴.
  - category: 소분류 **이름**(스킨/토너·에센스/세럼/앰플 등, 0012/_categories와 일치).
  - **slug**: 영문 URL용, **optional**(빈 칸 가능).
- **_categories**: `대분류, 대분류_slug, 소분류, 소분류_slug, sort_order` (6 대분류 / 16 소분류).
- **product_links**: `product_name(수식), brand(수식), oliveyoung, coupang, naver, zigzag, ably` — **product_key 컬럼 없음**(위치기반). product_name은 `=ARRAYFORMULA(products!B…)`로 동기화.
- **badges**: `product_name(수식), brand(수식), directorpi_detail, directorpi_source, directorpi_ref_url, directorpi_date` — **위치기반 wide-per-source**, product_key 컬럼 없음.
- **manual_overrides**: `product_name, seller, override_type, value, reason, expires_at, product_key`(키 또는 이름으로 참조).

## 변경 1 — 카테고리: `_categories` 단일 소스
- `_categories` fetch. **majors**(대분류_slug, 대분류, level='major', parent=null) upsert → **minors**(소분류_slug, 소분류, sort_order, level='minor', parent=해당 major id) upsert. onConflict slug.
- **옛 `categories` 탭 fetch·upsert 제거**(rawCategories 경로 삭제). validate의 categoryRowSchema → `_categories` 스키마로 교체.
- products.category(소분류 이름) → 전체 DB categories 중 **minor에서 `name===category || slug===category`** 로 category_id 결정. 못 찾으면 null + 리포트.
- 0012의 parent_id/level 컬럼(ALTER)은 전제(유지). seed는 이제 시트 주도라 중복 무해.

## 변경 2 — 뱃지: 위치기반 wide-per-source (소스 자동 인식)
- badges는 **제품당 1행**(products와 위치 정렬). 제품 식별 = **동기화된 product_name → nameToKey → product_key**(아래 join 규칙).
- **뱃지 소스를 헤더 접두사로 동적 발견**: 헤더에서 `<source>_detail` 패턴을 스캔 → 각 `<source>`에 대해 `<source>_source`, `<source>_ref_url`, `<source>_date` 컬럼을 읽음.
  - 행마다, `<source>_detail`(또는 그 그룹에 데이터)이 비어있지 않으면 → **product_badge 1건 emit**(badge_type=`<source>`, detail/source_title/ref_url/source_date = 그룹 값).
  - 한 제품이 여러 소스 채우면 여러 뱃지(예: directorpi + hwahae). **새 소스 추가 = `<newsrc>_detail/...` 컬럼만 추가하면 코드 변경 없이 자동 인식.**
- badges master(slug→표시명) upsert는 기존대로, 신규 소스 slug는 표시명 폴백(BADGE_NAMES[src] ?? src).
- 옛 long-badge 리더(product_name/badge_type 단일행) 제거.

## 변경 3 — links/badges join = 동기화된 product_name
- product_links·badges에 product_key 컬럼이 없으므로, **resolveProductKey의 name 폴백**(product_name → nameToKey)으로 join. (nameToKey는 products의 명시 product_key(freeze된 값) 사용.)
- product_name이 동일한 제품이 2개 이상이면(이론상) 충돌 → 리포트(추측 금지).

## 변경 4 — slug (optional URL)
- products.slug 읽어서 **DB slug = sheet.slug?.trim() || product_key** 로 set(빈 칸이면 product_key로 폴백). 페이지 라우팅(`/p/[slug]`)은 DB slug 사용.
- slug 중복 검사 → 충돌 시 리포트(빈 칸은 폴백되므로 product_key가 고유하면 안전).

## 변경 5 — product_key 자동 + freeze (이름 변경에도 불변)
- products 행의 product_key가 **비어있으면**: `makeProductKey(brand,name)` 생성 → **그 값을 시트 products.product_key 셀에 다시 써서 freeze**(write-back).
  - 이미 값이 있으면 **절대 덮어쓰지 않음**(고정 유지). → 이후 name을 바꿔도 명시 키가 남아 **제품 id 재생성 안 됨.**
  - write-back은 빈 셀만, 읽은 행 인덱스 기준 batch 업데이트, 멱등. **실패해도 import 자체는 죽지 않게**(warn 로그) — DB upsert는 생성된 키로 진행.
  - 서비스계정 쓰기 권한 필요(기존 보유). 시크릿 비노출.
- (대안: write-back이 부담이면 freeze를 별도 배치 스크립트로 분리 가능 — 단 그 경우 첫 import~배치 사이 rename은 불안정. 기본은 import write-back 권장.)

## mock 경로
- mockDb / mock_sheets_data 픽스처도 v2로 갱신(_categories, wide badges, slug, product_key 일부 빈칸). mock 경로에서도 freeze write-back은 로컬 mock 시트가 없으면 skip(분기).

## 테스트
- 카테고리: `_categories`로 6 대분류/16 소분류 빌드(parent/level/sort), 옛 categories 탭 없이 동작, products.category 매핑·미스 리포트.
- 뱃지: directorpi 그룹 → product_badge emit; **가짜 2번째 소스 컬럼**(예: hwahae_*) 추가 시 코드 변경 없이 인식; 빈 그룹은 emit 안 함; 한 제품 다중 소스 → 다중 뱃지.
- join: product_name(동기화)로 link/badge가 올바른 product에 연결; 이름 변경 시뮬레이션 시 freeze된 키로 동일 product 유지(재생성 X).
- slug: 있으면 그 값, 없으면 product_key 폴백.
- freeze: 빈 product_key → 생성+write-back, 기존 키 불변, write 실패 시 import 계속.
- `test:all`·typecheck·build·lint green.

## 시퀀싱 / 배포 ⚠️
- **이 PR 머지 전 `sheets:import` 금지.**
- 순서: 이 PR 머지 → (미적용 시) **0012 적용**(+seller-hide의 0013) → `sheets:import`(v2, freeze write-back 1회 발생) → 검증(카테고리/뱃지/slug/키 freeze) → `cf:deploy`.
- 머지·검증 후 **옛 `categories` 탭 삭제 가능**(코드가 더는 안 읽음).

## 브랜치 & 커밋 / DoD
- `feature/import-schema-v2`: `refactor: categories from _categories + drop flat tab`, `feat: wide per-source badge import (prefix-discovered)`, `feat: optional slug URL + product_key freeze-on-import`, `fix: link/badge join by synced product_name`, `test: import schema v2`, `docs: worklog`.
- 영어 PR → CI green → merge. `git diff --check`, 시크릿·`docs/prompts`·`tmp`·`UI_DESIGN.md` 비커밋.
- **DoD**: _categories 단일 소스·옛 탭 제거, wide badge(소스 자동인식·다중), slug optional 폴백, **product_key freeze(rename에도 불변)**, name-join, test/CI green, 시퀀싱 문서화.

## 막히면
- 서비스계정 쓰기 권한/write-back이 막히면 freeze를 별도 스크립트로 빼고 보고(추측 금지).
- `_categories`/badges 헤더가 예상과 다르면 라이브 기준으로 맞추고 보고.
- product_name 충돌(동명 제품)·slug 충돌은 리포트, 추측 매핑 금지.
