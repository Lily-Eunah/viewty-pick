# Claude Code 작업 프롬프트 — 카테고리 2단계 재편 + 시트 name 동기화(키 기반 매칭, 드롭다운 미사용)

> 목적: ① 카테고리를 **대분류/소분류 2단계**로 재편. ② 시트를 **product_key 기준 매칭 + name 동기화**로 구성해
> 이름 변경 시 product_links/badges가 깨지지 않게(배지 skip 재발 방지). **드롭다운은 사용 안 함(복붙).**
> 베이스: 크롤러 가드 머지된 최신 `main`. 분기 `feature/category-2tier`.
> (시트 구조는 내가 구성 → 운영자가 소분류·product_key 데이터 입력.)

## A. 카테고리 구조 (확정)
```
선케어       → 선크림 · 선스틱 · 선쿠션
스킨케어     → 스킨/토너 · 로션 · 에센스/세럼/앰플 · 올인원 · 크림
클렌징       → 클렌징폼/젤 · 오일/밤 · 워터/밀크
마스크팩     → 시트팩 · 패드
바디케어     → 샤워/입욕 · 바디로션/크림
베이스 메이크업 → 쿠션
```
(베이스 메이크업/쿠션에 아르마니·클리오 킬커버·에스쁘아·VDL·파넬·선쿠션 외 메이크업 쿠션 귀속.)

## B. 스키마 (마이그레이션)
- `categories`에 **2단계** 도입: `parent_id`(self-ref, 대분류는 null / 소분류는 대분류 id) + `level`(major|minor) 또는 동등 구조. `slug`·`name`·`sort_order` 유지.
- 위 6 대분류 + 소분류를 **시드**. 기존 flat 카테고리(선크림/토너/…)는 재import로 소분류에 재매핑(아래 D).
- `products.category_id` → **소분류**를 가리킴(대분류는 parent로 도출).

## C. 시트 구성 (드롭다운 X, name 동기화) — 내가 구성(Sheets API)
- **products**: `category`(소분류명, **plain text 복붙**) 컬럼. 드롭다운 검증 제거. 유효 소분류 참조용 **`_categories` 시트(대분류/소분류 목록)** 추가(복붙 소스).
- **product_links / badges**: **product_key(안정 키)로 products와 연결**. `제품명` 컬럼 = **product_key 기준 lookup 수식**(예: `=IFERROR(VLOOKUP($product_key, products!key:name, …, FALSE),"")`) → products.name과 항상 동기화(수동 재입력 X). 드롭다운 제거.
- (기존 dropdown/브랜드 마이그레이션 산물이 있으면 정리.)

## D. import — product_key 매칭 + 소분류 매핑
- **products↔product_links↔badges 매칭을 전부 `product_key`로**(이름 매칭 폐기 → 이름 변경 시 배지 skip 사라짐).
- products의 `category`(소분류 텍스트)를 **소분류 카테고리에 매핑**(정규화: 공백/슬래시 허용). 알 수 없는 소분류 → **에러+리포트**(skip), 매칭 표기 흔들리지 않게.
- 대분류는 소분류의 parent로 자동 결정.
- dedup/reconcile·`sheet_import_runs` 기존대로.

## E. UI / 라우팅
- **홈/네비**: 대분류 단위 진입 → 소분류 필터(또는 칩). 기존 카테고리 칩을 2단계로.
- **라우팅**: `/c/[category]`가 **대분류·소분류 둘 다** 처리(대분류면 하위 소분류 제품 묶음, 소분류면 해당 제품). slug 충돌 회피.
- 카테고리별 섹션/정렬 기존 로직 재사용. SEO 메타·sitemap에 신규 카테고리 반영.

## F. 데이터(운영자) — 시트 구성 후
- 제품별 **소분류(category)** 입력(복붙), product_links/badges는 **product_key만** 입력(제품명은 수식 자동).
- 아르마니 #95 → 베이스 메이크업/쿠션. 단품가 원하면 네이버 URL을 단품으로 교체(세트면 113,050).

## 테스트 / 검증
- 스키마: 6 대분류/소분류 시드, products.category_id→소분류, parent 도출.
- import: product_key 매칭(이름 바꿔도 links/badges 안 깨짐 — 배지 skip 0), 소분류 텍스트→카테고리 매핑, 알 수 없는 소분류 에러.
- UI: 대분류 네비→소분류 필터, /c 대·소분류 라우팅, 신규 카테고리 노출. 기존 정렬/카드 회귀.
- `test:all`·typecheck·build·lint green.

## 브랜치 & 커밋 / 배포
- `feature/category-2tier`: `feat(db): 2-tier categories (parent_id) + seed`, `feat: sheet key-based name sync (no dropdowns) + _categories ref`, `fix: import match by product_key + 소분류→category mapping`, `feat: 2-tier category nav/routing/filter`, `test: category 2-tier + key-match import`, `docs: worklog`.
- 마이그레이션 원격 적용(게이트), 시트 구조 갱신 후 운영자 데이터 입력 → `sheets:import` → (필요 시) sync → cf:deploy. 영어 PR → CI → merge.
- `git diff --check`, 시크릿·`docs/prompts`·`tmp`·`UI_DESIGN.md` 비커밋.

## DoD
1. 2단계 카테고리(6 대분류 + 소분류) 스키마·시드·UI/라우팅 동작.
2. 시트: 드롭다운 없음, product_key 매칭, name 수식 동기화, `_categories` 참조.
3. import가 product_key로 매칭(이름 변경에도 배지/링크 안 깨짐), 소분류 텍스트 매핑.
4. test/build/CI green, worklog. 운영자 데이터 입력 절차 안내.

## 막히면
- Google Sheets 수식 컬럼을 import가 *평가값*으로 읽는지 확인(formula 아닌 value 렌더). 매칭은 어차피 product_key라 수식 실패해도 안전.
- 소분류명 표기 흔들림(슬래시/공백)은 정규화 + 미스 리포트, 추측 매핑 금지.
- 라우팅 대·소분류 slug 충돌 시 접두/구분으로 해결.
