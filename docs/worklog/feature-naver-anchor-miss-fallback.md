# feature/naver-anchor-miss-fallback

## 배경
- Phase-1 페이지 크롤은 **하드 anti-bot 차단**으로 회수 0건 확정(brand.naver.com 콜드 HTTP 429, naver.me→brandconnect 어필리에이트). 진단: `scripts/live-check/diagnose-naver-crawl.ts`.
- brand.naver.com channelProductNo ≠ 검색 API smartstore productId namespace → 번호 앵커가 anchor-miss. **그러나 공식 브랜드 스토어는 검색결과에 mallName으로 존재**(에뛰드 본사직영샵·코스알엑스·토리든·동화약품 후시다인 등) → 번호 대신 **공식몰+제품일치**로 실제 공식가 회수.

## 목표
① 죽은 페이지 크롤 OFF(휴면), ② anchor-miss를 **Tier-2 공식몰 mallName 매칭 → Tier-3 catalog-lprice → Tier-4 link-only**로 복구. robots-clean(오픈 API), 크롤·수동입력 없음.

## 변경 1 — 페이지 크롤 OFF (휴면)
- `NaverAdapter.fetchOffer`의 `crawlNaverPagePrice` 폴백을 **`NAVER_PAGE_CRAWL=on`일 때만** 호출(기본 OFF). anchor-miss마다 Playwright 타임아웃 낭비 제거.
- `naverPageCrawl.ts`(파서·테스트)는 **보존**(네이버 정책 변경 시 재활용). 기본 경로에서 비활성.

## 변경 2 — anchor-miss 폴백 (`crawler/adapters/naver.ts`)
`matchNaverOffer`를 anchor-only → **anchor → Tier-2 → Tier-3** 로 확장. 모든 폴백 가격은 **비앵커**(퍼지 제목 매칭) → **항상 warning(검수용)**.

### Tier-2 — 공식 Naver 스토어 mallName 매칭 (공식가)
- 신규 `isNaverHostedStore`(smartstore/brand `/products/` 링크만), `isOfficialBrandStoreOffer`(allowlist 우선 → 없으면 mallName이 브랜드 포함 + 공식/직영/본사 또는 브랜드 단독; 브랜드 네임드롭 리셀러 제외), `pickOfficialStoreFallback`.
- **엄격 identity**(`passesStrictIdentity`): gift-strip 후 sim≥0.6 + distinctive 코어토큰 + form-conflict 없음 + **용량 일치**(다사이즈는 큐레이트 volume_ml로 선택). 여러 후보면 outlier(중앙값 밴드) 제거 후 volume-exact > sim > 최저가.

### Tier-3 — 가격비교 catalog lprice (공식몰 없을 때)
- `pickCatalogFallback`: `search.shopping.naver.com/catalog/` 항목(lprice>0)을 같은 엄격 identity로 매칭. catalog와 개별몰(Tier-2)은 disjoint.

### 가격 & 링크 규칙 (`fetchOffer`)
- **가격(링크 유형 무관)**: Tier-2 공식가 → Tier-3 catalog lprice. `regular_price` 없음. `inspectionWarning` 세팅 → healthcheck `status='warning'` + normalize `unit_price_reliable=false`(비앵커 identity → ml당 비활성, base 가격은 비교에 노출).
- **구매 링크(유형별)** — `/go` 우선순위(affiliate_url → latest_matched_url → url) 그대로 활용:
  - `naver.me` 또는 `affiliate_url` 있음 → `matchedUrl=null`(어필리에이트 절대 변경 금지; 공식가 매칭 시 warning에 "가격주체 불일치 가능" 표기).
  - 비어필리에이트(brand/smartstore) → `matchedUrl=공식몰 오퍼 link`(buy 링크 업데이트 가능).
  - catalog는 buy 링크 아님 → `matchedUrl=null`(어필리에이트/url 유지).

### 공통 인프라(소규모)
- `PriceOffer.inspectionWarning?: string|null` 신규(`crawler/adapters/index.ts`).
- `healthcheck.ts` Rule 4b: `inspectionWarning` → warning(하드 failed 규칙 다음, 가짜가격 0). `normalize.ts`: `inspectionWarning` → `unit_price_reliable=false`.

## 주요 변경 파일
- `crawler/adapters/naver.ts` (Tier-2/3 픽커 + matchNaverOffer 확장 + fetchOffer 폴백/크롤 게이트)
- `crawler/adapters/index.ts` (PriceOffer.inspectionWarning)
- `crawler/core/healthcheck.ts` (Rule 4b), `crawler/core/normalize.ts` (match_unverified)
- tests: `naver.test.ts`(+11 케이스), `healthcheck.test.ts`(+2), `normalize.test.ts`(+1)

## 테스트 결과
- `test:naver` 신규: isNaverHostedStore / isOfficialBrandStoreOffer(공식 vs 리셀러 vs 외부몰) / Tier-2 매칭·다사이즈 용량선택·리셀러·form-conflict 제외 / Tier-3 catalog 매칭·lprice0 skip·low-identity 제외.
- `test:healthcheck`: inspectionWarning→warning, sub-1000은 여전히 failed(하드 규칙 우선). `test:normalize`: inspectionWarning→unit_price 비활성, base 가격 유지.
- `test:all`·typecheck·build·변경파일 eslint green. 회귀 없음(앵커 성공 경로/OY/쿠팡 무영향; OliveYoung은 별도 matchOliveYoungOffer 경로).

## 남은 이슈 / TODO
- **라이브(운영자)**: `crawler:sync`(게이트) 후 anchor-miss 제품 가격 채워지고 **warning** 뜨는지 확인(에뛰드 500ml→24,200 등 다사이즈 용량/공식가, 토리든 naver.me는 공식가+링크 유지, 이니스프리/넘버즈인은 catalog). 틀린 제품가 채택 0 확인.
- `cf:deploy`로 반영. warning 가격의 web 표시 정책(노출/검수 큐)은 web-layer 후속.
- 페이지 크롤은 `NAVER_PAGE_CRAWL` 미설정 시 호출 0(확인).
