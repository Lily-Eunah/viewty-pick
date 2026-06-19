# Claude Code 작업 프롬프트 — 비노출 판매처(지그재그·에이블리) 화면 숨김 (데이터는 유지)

> 증상: 지그재그·에이블리는 **추후 확장용으로 링크만 시트/DB에 띄워둔 상태**(현재 크롤링 X → 가격 없음)인데,
> web-layer PR의 **tier-4 link-only 렌더**가 가격 없는 판매처를 "보기" 링크 행으로 노출하면서 **화면에 새어나옴.**
> → **데이터는 유지**(나중에 플래그만 켜면 확장), **지금은 화면에서만 제외.**
> 베이스: 최신 `main`. 분기 `fix/hide-nondisplay-sellers`. **웹+데이터 소규모, 신규 크롤러 변경 없음.**

## 원인 (확인됨)
- `sellers`에 zigzag·ably 시드(`0003_seed_sellers.sql`), `is_price_comparison_enabled=true`.
- `lib/queries/index.ts:121` `prodListings` = `product_id`+`is_active`만 필터 → seller 노출 게이트 없음.
- seller 조회(`:261`,`:459` 등 `sellers.select('id, slug, name')`)가 노출 플래그를 안 읽음.
- 둘은 크롤링 안 해 스냅샷 없음 → `:135` link-only 행으로 렌더.

## 수정 (seller 노출 플래그로 데이터 주도)
1. **노출 플래그**: 가급적 **기존 `is_price_comparison_enabled` 재사용**(의미상 "가격비교 노출"과 일치).
   - **단, 크롤러/매처가 이 플래그에 의존하는지 먼저 확인**(grep `is_price_comparison_enabled`). 수집 대상 판정 등에 쓰여 충돌하면 → **전용 `is_display_enabled` 컬럼 신설**(마이그레이션)로 분리하고 그걸 게이트로.
2. **데이터**: zigzag·ably의 노출 플래그 **false**로 설정(마이그레이션 또는 idempotent UPDATE). 나머지(네이버·쿠팡·올리브영) true 유지. **listing/링크 데이터는 그대로**(비활성화·삭제 금지 — 확장 시 플래그만 true).
3. **쿼리**: seller 조회에 노출 플래그 컬럼 포함(`select('id, slug, name, is_..._enabled')`), `dbSellers` 타입에 추가.
4. **렌더 게이트**: `mapToUIProduct`의 `prodListings` 필터에 **노출 플래그 true인 seller만** 통과(priced·link-only·최저가/공식몰대비 계산 *전부* 제외 — 한 곳에서 걸어 모든 경로 커버).
   - seller 못 찾은 listing(`seller=undefined`)도 보수적으로 제외(현재 '기타'로 노출되던 것 방지).

## 5. "비교 플랫폼" 라벨 = 가격 있는 판매처만 (같은 PR)
- 증상: 리스트 카드의 "○○ · ○○ 비교" 라벨(`components/product/ProductListCard.tsx:15` `storeNames = product.stores.map(s=>s.name)...`, `:92` `{storeNames} 비교`)이 **stores 전부**를 나열 → 가격 없는 판매처(지그재그/에이블리, 네이버 link-only 등)까지 "비교"로 표시됨.
- **수정**: 라벨을 **`hasPrice === true`인 판매처 이름만**으로 구성(`product.stores.filter(s => s.hasPrice).map(...)`). 가격 산정에 실제 쓰인 플랫폼만 노출.
  - 가격 있는 판매처 0개면 "비교" 라벨 숨기고 기존 무가격 분기("판매처에서 보기", `:81`)로 graceful.
- **다른 카드도 점검**: 홈/기타에서 같은 "stores 전체 나열" 패턴 있으면 동일하게 priced-only로(예: `TodayDealSection`). 한 군데 헬퍼로 통일 권장.
- (참고: seller 노출 게이트(위)로 지그재그/에이블리는 이미 stores에서 빠지지만, 이 `hasPrice` 필터는 *그것과 별개* — 네이버 link-only처럼 *노출 대상이지만 가격 없는* 판매처도 "비교"에서 빼는 보완책.)

## 테스트
- zigzag/ably listing이 있는 제품 → **stores·link-only·최저가 후보에서 제외**(화면 미노출), 데이터는 DB에 잔존.
- 네이버/쿠팡/올리브영은 그대로 노출(회귀 없음).
- 노출 플래그 false seller가 공식몰대비/최저가 계산에 안 섞이는지.
- **"비교" 라벨이 `hasPrice` 판매처만 나열**(가격 없는 link-only 미포함), priced 0개면 라벨 숨김.
- `test:all`·typecheck·build·lint green.

## 브랜치 & 커밋 / 배포
- `fix/hide-nondisplay-sellers`:
  - (재사용이면) `fix: gate seller display by is_price_comparison_enabled; disable zigzag/ably`
  - (신설이면) `feat(db): sellers.is_display_enabled flag + migration`, `fix: hide non-display sellers (zigzag/ably) from UI`
  - `fix: 비교 라벨 = priced sellers only (exclude no-price/link-only)`
  - `test: non-display seller gating + priced-only compare label`, `docs: worklog`.
- 마이그레이션/UPDATE면 원격 적용(게이트). 영어 PR → CI green → merge → **`cf:deploy`(웹 노출 변경이라 배포 필요)**.
- `git diff --check`, 시크릿·`docs/prompts`·`tmp`·`UI_DESIGN.md` 비커밋.

## DoD
1. 지그재그·에이블리가 **화면(상세 표·카드·최저가)에서 사라짐**, listing 데이터는 DB 유지.
2. 노출은 **seller 플래그로 제어**(확장 시 플래그만 true → 자동 노출).
3. **리스트(및 기타) "비교" 라벨이 가격 있는 판매처만 나열**, priced 0개면 라벨 숨김.
4. 네이버/쿠팡/올리브영 회귀 없음. test/build/CI green, 배포·확인.

## 막히면
- `is_price_comparison_enabled`가 크롤러 수집 판정에 쓰이면 재사용 말고 `is_display_enabled` 신설로 분리(수집은 계속, 노출만 차단).
- 게이트를 한 곳(`prodListings` 필터)에만 둬 priced/link-only/계산 경로가 동시에 커버되는지 확인.
