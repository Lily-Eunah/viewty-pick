# feature/category-2tier — 2-tier categories + key-based sheet matching

- **일자**: 2026-06-17
- **요약**: 카테고리 대분류/소분류 2단계 재편 + 시트 매칭을 **product_key 기준**으로 전환(이름 변경 시 배지/링크 안 깨짐, 배지 skip 재발 방지).

## 변경 (코드)
### product_key 기반 매칭 (배지 skip 근본 해결)
- `crawler/sheets/validate.ts`: product_links / badges / overrides 스키마에 **`product_key`(선택) 추가**, `product_name`은 fallback. `resolveProductKey(row, nameToKey)` = key 우선 → name 폴백. `expandListings`도 key 우선.
- `crawler/sheets/import.ts`: 링크/배지/오버라이드 매칭을 `resolveProductKey`로. → 시트에서 제품명을 바꿔도 product_key만 같으면 배지/링크 유지(이전: 이름 매칭이라 rename 시 배지 skip).
- **하위호환**: product_key 컬럼이 없으면 기존 name 매칭으로 동작(무회귀). 시트에 key 컬럼 추가 시 자동 활성.

### 2-tier 카테고리
- `supabase/migrations/0012_two_tier_categories.sql`: `categories`에 `parent_id`(self-ref)·`level`(major|minor) 추가. **6 대분류**(선케어/스킨케어/클렌징/마스크팩/바디케어/베이스 메이크업) + 소분류 시드. **기존 flat slug(sunscreen/toner/serum/cream/cleansing/cushion)를 소분류로 재부모+개명** → 기존 products.category_id 유효 유지.
- `lib/types.ts`: `Category.parent_id/level`, `UIProduct.majorCategory`.
- `lib/data/categories.ts`: 2-tier 시드(mock 패리티).
- `lib/queries/index.ts`: `mapToUIProduct`가 majorCategory(부모) 도출 / `getProducts` 필터가 소분류 **또는** 대분류 매칭 / `getCategoryPageData`가 대분류면 minors 반환.
- UI: `/c/[category]`가 대·소분류 모두 처리(대분류면 소분류 sub-filter 칩), `CategoryProductList` minor 필터, 홈 카테고리 그리드 = 6 대분류 진입.

## 테스트
- `test:keymatch`(test:all 편입): key 우선·name 폴백·rename시 name-only 미스(구버그 재현)·expandListings key 매칭. typecheck·lint·build·test:all green.

## ⚠️ 게이트/후속 (프로덕션)
1. **마이그레이션 0012 원격 적용**(Supabase CLI `supabase db push` 또는 대시보드 SQL) — **선행 필수**. 적용 전엔 prod에 대분류 카테고리가 없어 홈 카테고리(대분류) 페이지가 비어 보임 → **적용 후 cf:deploy**.
   - 안전: slug 재사용으로 기존 products는 적용 즉시 소분류에 정상 귀속(운영자 데이터 입력 없이도 기존 6 소분류 동작).
2. **운영자 시트 구성**(권장): product_links/badges/overrides에 `product_key` 컬럼 추가(= products와 안정 조인, 이름 수식 동기화), `_categories` 참조 시트, products.category에 소분류명 입력. → 신규 소분류(선스틱·로션 등) 분류 + 배지 skip 완전 차단.
3. 적용 순서: 0012 적용 → (시트 key/소분류 입력) → `sheets:import` → cf:deploy → 검증.
