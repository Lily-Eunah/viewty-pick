# Claude Code 작업 프롬프트 — 네이버 anchor-miss 폴백(공식몰 mallName 매칭 → catalog-lprice) + 죽은 페이지 크롤 OFF

> 배경:
> - 페이지 크롤(Phase 1)은 **하드 anti-bot 차단**으로 회수 0건 확정(brand.naver.com 콜드 429, naver.me→brandconnect). 진단: `scripts/live-check/diagnose-naver-crawl.ts`.
> - **접미어("네이버 브랜드/스토어/공식/공식몰" 등 10종) 실험 전부 실패** — 큐레이트 channelProductNo는 어떤 검색어로도 결과에 안 뜸(brand.naver.com번호 ≠ smartstore번호 namespace).
> - **그러나 공식 브랜드 스토어는 결과에 mallName으로 존재**(에뛰드 본사직영샵·코스알엑스·토리든·동화약품 후시다인 등) → 번호 대신 **공식몰+제품일치 매칭**으로 *실제 공식가* 회수 가능.
> 목표: ① 죽은 페이지 크롤 OFF, ② anchor-miss를 **Tier-2 공식몰 mallName 매칭(공식가) → Tier-3 catalog-lprice(없을 때, +warning) → Tier-4 link-only**로 복구. robots-clean(오픈 API), 크롤·수동입력 없음.
> 베이스: 최신 `main`. 분기 `feature/naver-anchor-miss-fallback`. 대상: `crawler/adapters/naver.ts`(+ run.ts env).

## 변경 1 — 페이지 크롤 OFF (휴면)
- `crawlNaverPagePrice` 폴백 호출을 **env 플래그 뒤로**(`NAVER_PAGE_CRAWL=on`일 때만, 기본 OFF). 기본 동작에서 호출 안 됨 → anchor-miss마다 20~40s Playwright 타임아웃 낭비 제거.
- 파서·테스트 코드(`naverPageCrawl.ts`)는 **삭제하지 말고 보존**(네이버가 정책 바꾸면 재활용). 단 기본 경로에서 비활성.

## 변경 2 — anchor-miss 폴백 (링크 유형별: 공식몰 mallName 매칭 / catalog-lprice)
> 실측: brand.naver.com channelProductNo ≠ 검색 API의 smartstore productId(같은 제품 다른 번호 namespace)라 번호 앵커가 실패. **그러나 공식 브랜드 스토어는 검색결과에 mallName으로 존재**(에뛰드 본사직영샵 24,200/18,900, 코스알엑스 21,390, 토리든 19,700, 동화약품 후시다인 20,900). 번호 대신 **공식몰 + 제품일치**로 매칭하면 *실제 공식가* 회수.

### ⚠️ 가격 & 링크 규칙 (운영자 결정)
- **가격(링크 유형 무관, 동일)**: **Tier-2 공식몰 mallName 매칭(공식가)을 먼저** → 없으면 **Tier-3 catalog-lprice** → 없으면 **Tier-4 link-only**. **이 폴백 가격은 항상 `warning`(검수용)** — 비앵커 매칭이므로(공식가든 카탈로그든 운영자가 검토).
- **구매 링크(유형별로만 다름)**:
  - `naver.me/*`(우리 어필리에이트) → **절대 변경 금지**(수익화). 가격이 공식몰가여도 **링크는 어필리에이트 유지** + warning에 "가격주체 불일치 가능" 표기.
  - 비어필리에이트(`brand.naver.com`/`smartstore`) → 매칭된 **공식몰 URL로 업데이트 가능**.

anchor-miss(productNo 검색결과에 없음) 시, 링크 유형과 무관하게 Tier-2부터:

**Tier-2 — 공식 스토어 mallName 매칭 (1순위, 공식가):**
1. 검색결과(buildAnchorQueries, display=100) 중 **개별 네이버 스토어**(`smartstore.naver.com/main/products` 또는 `brand.naver.com`) 항목만.
2. 그중 **공식 브랜드 스토어**로 판정되는 것:
   - `retailer_allowlist`에 그 브랜드 공식 네이버 mallName이 있으면 그걸로(정확), 없으면 **mallName이 브랜드명 포함 + (`본사직영`/`공식`/브랜드명 단독)** 휴리스틱.
3. **엄격 identity** — `productIdentityScore`/`distinctiveTokens`/`hasFormConflict`(gift-strip 후), sim≥0.6 + 코어토큰 + form-conflict 없음 **+ 용량 일치**(products.volume_ml; 에뛰드 500 vs 350 같은 다사이즈는 큐레이트 용량으로 선택).
4. 통과 시 그 **공식몰 오퍼의 lprice를 공식가로 채택**(`base_unit_price`, 용량 신뢰 시 ml당) — **링크 유형 무관(naver.me도 이 공식가 사용)**, **항상 warning(검수용)**. 구매 링크: naver.me면 유지, 비어필리에이트면 공식몰 URL로 업데이트 가능.

**Tier-3 — catalog-lprice (공식몰 없을 때, 예: 넘버즈인·이니스프리):**
1. 검색결과 중 `search.shopping.naver.com/catalog/`(가격비교) 항목을 위와 같은 엄격 identity로 매칭.
2. 통과 시 `lprice` 채택 + **warning**: `비앵커 · 가격비교 최저가(리셀러 가능 · 공식 스토어가 아님)`. `regular_price` 없음. 구매 링크는 우리 어필리에이트.

**Tier-4** — 위 다 실패면 link-only(억지 가격 금지).
- 여러 후보면 identity 최상 + 가격 sane(outlier 개념 재사용).

## 테스트
- **가격은 링크 유형 무관**: Tier-2 공식몰 매칭이 되면 공식가 채택(에뛰드 500ml→24,200·코스알엑스 21,390·동화 20,900·**토리든 19,700도 naver.me지만 공식가 사용**), **항상 warning**.
- **링크만 유형별**: 토리든 등 `naver.me`는 **구매 링크 그대로**(공식가 + warning "가격주체 불일치 가능"). 에뛰드/코스알엑스/동화 등 비어필리에이트는 공식몰 URL로 업데이트 가능.
- **Tier-3 catalog**: 오픈 API에 네이버 공식스토어 없는 제품(이니스프리·넘버즈인)은 카탈로그 lprice+warning, identity 미달이면 link-only.
- 리셀러 mallName(브랜드명 없음/타몰)·identity/용량 미달 → 공식 후보 제외(가짜가격 0).
- 앵커 성공 제품(조선미녀 등)은 폴백 안 탐(회귀 0). `NAVER_PAGE_CRAWL` 미설정 시 페이지 크롤 호출 0.
- `test:all`·typecheck·build·lint green.

## 브랜치 & 적용
- `feature/naver-catalog-lprice`: `feat(matcher): naver catalog-lprice fallback for anchor-miss (identity-matched, warning-flagged)`, `chore: gate dead naver page-crawl behind NAVER_PAGE_CRAWL env (default off)`, `test`, `docs: worklog`.
- 영어 PR → CI → merge → `crawler:sync`(게이트) → anchor-miss 제품 가격 채워지는지·warning 뜨는지 확인 → `cf:deploy`.

## 막히면
- 카탈로그 항목에 lprice가 비거나 0이면 skip → link-only.
- identity 임계는 보수적으로(틀린 제품 가격 채택 방지) — 애매하면 link-only + 보고.
- 카탈로그 mallName이 "네이버"로 와서 개별몰 판정과 안 섞이게(가격비교 ≠ 개별 판매처) 주의.
