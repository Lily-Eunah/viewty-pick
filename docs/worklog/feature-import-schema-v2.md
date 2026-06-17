# feature/import-schema-v2 — 통합 import 개편 (sheet schema v2)

- **일자**: 2026-06-17
- **목표**: 운영자 시트 구조 v2(Cowork 셋업 완료)에 맞춰 import를 한 번에 개편. ⚠️ **다음 `sheets:import` 전 머지 필수** — 현 import는 옛 구조라 v2 시트에서 깨지고, 옛 `categories` 탭이 0012 rename을 revert함.

## 변경 요약 (5)
1. **카테고리 = `_categories` 단일 소스**: 옛 flat `categories` 탭 fetch/upsert 제거. `_categories`(대분류·대분류_slug·소분류·소분류_slug·sort_order)에서 majors→minors(parent_id/level) upsert. `parseCategoriesRef()`가 majors dedup + minors의 parent major slug 연결.
2. **뱃지 = 위치기반 wide-per-source**: 제품당 1행, `<source>_detail/_source/_ref_url/_date` 그룹. 소스를 `_detail` 헤더 접두사로 **자동 발견**(`discoverBadgeSources`) → 새 소스(`hwahae_*` 등) 추가 시 코드 변경 0. 한 제품 다중 소스 → 다중 뱃지. 빈 그룹은 emit 안 함. 잘못된 ref_url/date는 null로 떨어뜨려 한 셀이 전체를 막지 않음(`expandBadges`).
3. **slug (optional URL)**: products.slug 읽어 DB slug = `sheet.slug?.trim() || product_key`(`resolveDisplaySlug`). 라우팅은 DB slug. 빈 칸이면 product_key 폴백.
4. **product_key 자동 + freeze**: 빈 product_key는 `makeProductKey`로 생성 후 **시트 셀에 write-back**(`freezeProductKeys`, Google 경로만). 기존 값은 절대 덮어쓰지 않음 → 이후 rename에도 제품 id 불변. 헤더에서 product_key 컬럼 탐지, batch update, **실패해도 import 계속**(warn). 계획 로직은 순수 함수 `planKeyFreeze`로 분리해 테스트.
5. **links/badges join = 동기화된 product_name**: v2 product_links/badges에 product_key 컬럼 없음 → `resolveProductKey`의 name 폴백으로 join(nameToKey는 freeze된 명시 키 사용). product_name 동일 제품 2개↑면 **dedup fail-fast로 리포트**(name-join 모호 방지).

## 주요 변경 파일
- `crawler/sheets/validate.ts`: `categoriesRefRowSchema`+`parseCategoriesRef`, products `slug`+`resolveDisplaySlug`, wide badge `discoverBadgeSources`/`expandBadges`/`FlatBadge`, `planKeyFreeze`, dedup에 `duplicateProductNames`/`duplicateSlugs` 추가(+`hasDuplicates`/`formatDuplicateReport`). (옛 `categoryRowSchema`·`simpleBadgeRowSchema` 제거)
- `crawler/sheets/import.ts`: `_categories` fetch, majors/minors upsert(Supabase+mock), slug, wide badge emit, `freezeProductKeys` write-back, BADGE_NAMES에 hwahae 추가.
- `crawler/sheets/mock_sheets_data.ts`: `mockCategoriesRefSheet`, `mockBadgesWideSheet`, products `slug` 컬럼.
- `crawler/sheets/setup_headers.ts`·`reseed_sheets.ts`: HEADERS/seed v2(=`_categories`·products slug·wide badges·overrides product_key) — 옛 구조로 되돌리는 footgun 제거.
- `crawler/sheets/__tests__/schema_v2.test.ts`(신규) + `package.json`(`test:schemav2`, `test:all`에 연결).

## 테스트 결과
- `npm run test:all` ✓ (신규 `schema_v2` 15케이스 포함 전부 green): _categories majors/minors, 소스 자동발견·다중·빈그룹·잘못된 url/date null·rename-proof key-join·skip 리포트, slug 폴백, freeze plan(생성/멱등), product_name·slug dup 탐지.
- 기존 `dedup`·`keymatch` 회귀 없음.
- `npm run typecheck` ✓ · `npm run build` ✓ · eslint(changed) clean.
- ⚠️ **로컬에서 `sheets:import` 미실행** — 실 `.env`로 돌리면 운영 Supabase에 쓰고 live 시트에 freeze write-back이 발생함(crawler-writes-prod 규칙). 순수 로직은 유닛테스트로 커버.

## 시퀀싱 / 배포 ⚠️
- **이 PR 머지 전 `sheets:import` 금지.**
- 순서: 이 PR 머지 → (0012/0013은 이미 prod 적용됨) → `sheets:import`(v2, freeze write-back 1회) → 검증(카테고리·뱃지·slug·키 freeze, dedup 0) → revalidate 또는 `cf:deploy`.
- 머지·검증 후 옛 `categories` 탭 삭제 가능(코드가 더는 안 읽음).

## 남은 이슈 / TODO
- 운영자 입력: 신규 소분류(선스틱/로션 등)는 products.category에 소분류명 입력 시 자동 귀속. 새 뱃지 소스는 `<src>_detail/...` 컬럼만 추가.
- freeze write-back은 서비스계정 쓰기 권한 사용(기존 보유). 권한 이슈 시 warn 후 import는 계속되므로 다음 실행에서 재시도됨.
