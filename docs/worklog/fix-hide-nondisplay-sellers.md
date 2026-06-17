# fix/hide-nondisplay-sellers — 비노출 판매처(지그재그·에이블리) 화면 숨김

- **일자**: 2026-06-17
- **목표**: 추후 확장용으로 링크만 시드해둔 지그재그·에이블리(현재 크롤링 X → 가격 없음)가 web-layer의 tier-4 link-only 렌더로 화면에 새어나오는 문제를 차단. **데이터는 유지**(플래그만 켜면 재노출), **화면에서만 제외.**

## 원인
- `sellers`에 zigzag·ably 시드(`0003_seed_sellers.sql`), `is_price_comparison_enabled=true`.
- `mapToUIProduct`의 `prodListings` 필터가 `product_id`+`is_active`만 봐서 seller 노출 게이트가 없음 → 가격 없는 두 판매처가 link-only "보기" 행으로 렌더됨.
- 추가로 리스트/홈 카드의 "○○ · ○○ 비교" 라벨이 `stores` 전체를 나열 → 가격 없는 판매처(네이버 link-only 포함)까지 "비교"로 표시.

## 결정: 플래그 재사용 (`is_price_comparison_enabled`)
- 크롤러/매처가 이 플래그에 의존하는지 grep 확인 → **수집 로직 어디에서도 읽지 않음**(타입 정의·시드·mock·docs에만 등장). 충돌 없음 → 전용 컬럼 신설 대신 **기존 플래그를 노출 게이트로 재사용**(의미상 "가격비교 노출"과 일치). 마이그레이션은 스키마 변경 없는 데이터 UPDATE만.

## 주요 변경 파일
- `lib/queries/index.ts`
  - `isSellerDisplayed(seller)` 헬퍼 추가(export) — `is_price_comparison_enabled === true`인 seller만 통과, seller 못 찾은 listing(orphan)도 제외.
  - `prodListings` 필터에 **단일 게이트**로 적용 → priced/link-only/최저가/공식몰대비 계산 경로를 한 곳에서 전부 커버.
  - `dbSellers` 타입(`DbSeller`)에 `is_price_comparison_enabled` 추가, Supabase seller select 2곳(`select('id, slug, name, is_price_comparison_enabled')`)에 컬럼 포함.
- `lib/format.ts`: `pricedStoreNames(product, max=3)` 헬퍼 — `hasPrice`인 판매처 이름만 join, 없으면 `''`(호출부가 라벨 숨김).
- `components/product/ProductListCard.tsx`: 라벨을 `pricedStoreNames`로 교체, priced 0개면 "비교" 라벨 자체 숨김.
- `components/home/TodayDealSection.tsx`: 동일 헬퍼로 통일(기존 `hasPrice !== false` 인라인 필터 → `pricedStoreNames`), priced 0개면 라벨 숨김.
- `supabase/migrations/0013_hide_nondisplay_sellers.sql`: idempotent UPDATE로 zigzag·ably `is_price_comparison_enabled=false`. **listing/링크 데이터는 그대로.**
- `lib/supabase/mockDb.ts`, `lib/data/db_mock.json`: 로컬 mock도 zigzag·ably `false`로 맞춰 게이트 동작 일치.
- `lib/queries/__tests__/webLayer.test.ts`: `isSellerDisplayed`(true/false/undefined/플래그 부재) + `pricedStoreNames`(priced-only / 0개 → '' / max cap) 테스트 추가.

## 테스트 결과
- `npm run typecheck` ✓
- `npm run test:all` ✓ (신규 케이스 6개 포함 전부 green)
- `npm run build` ✓
- `npx eslint <changed src>` ✓ (lint-clean; `.open-next/` 빌드 산출물 경고는 기존 이슈, gitignore됨)

## 배포 / 적용
- **마이그레이션 0013 원격 적용 필요**(게이트). 웹 노출 변경이라 merge 후 `cf:deploy` 필요.
- 참고: 직전 마이그레이션 0012(2-tier categories)가 다음 배포 전 선적용되어야 함 — 0013은 그 위에 적용.

## DoD 체크
1. ✓ 지그재그·에이블리가 화면(상세 표·카드·최저가)에서 제외, listing 데이터는 DB 유지.
2. ✓ 노출은 seller 플래그로 제어 — 확장 시 플래그만 true로 자동 재노출.
3. ✓ 리스트/홈 "비교" 라벨이 가격 있는 판매처만 나열, priced 0개면 라벨 숨김.
4. ✓ 네이버/쿠팡/올리브영 회귀 없음. test/build green.

## 남은 이슈 / TODO
- 향후 지그재그·에이블리 크롤러 도입 시: 플래그 true + 어댑터/매처 추가만 하면 자동 노출.
- (장기) `is_price_comparison_enabled`가 "노출 게이트"와 "가격비교 포함" 두 의미를 겸하게 됨. 브랜드 공식몰을 별도 seller로 분리(노출 X, 공식몰대비 baseline O)하는 시나리오가 생기면 전용 `is_display_enabled` 컬럼으로 분리 고려.
