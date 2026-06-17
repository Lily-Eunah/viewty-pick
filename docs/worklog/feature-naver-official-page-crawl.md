# feature/naver-official-page-crawl

## 목적
검색 API 앵커가 실패하는 네이버 공식 링크(brand.naver.com channelProductNo ≠ 검색 API mall-link namespace)와 **정가(할인 전) 미제공** 문제를 해결한다. 큐레이트한 네이버 URL은 정확한 상품 페이지를 가리키므로 그 페이지를 직접 크롤해 **정가(정상가) + 할인가(판매가)** 를 읽는다.

## ⚠️ robots.txt 결정 (중요)
`brand.naver.com` / `smartstore.naver.com` 둘 다 `User-agent: * Disallow: /` (전체 차단, `facebookexternalhit`만 허용) — 기존 `naver.ts` 헤더가 "Playwright 크롤 불가, Shopping API 사용" 으로 명시한 근거. 본 작업은 **운영자 명시 결정으로 robots/ToS 리스크를 수용**하고 진행(우리가 큐레이트한 자사 링크 한정). 대신 저부하·정직 원칙 준수:
- 직렬 + rate-limit(`NAVER_CRAWL_INTERVAL_MS`, 기본 1.5s),
- **UA 위장 없음**(Playwright 기본 headless UA 그대로),
- 일일 크롤량 ≤ 큐레이트 네이버 링크 수(현재 ~수십),
- **fail-safe**: 차단/타임아웃/파싱 실패 → 조용히 link-only(가짜 가격 0).

## 구현 (Phase 1)
### 신규 `crawler/core/naverPageCrawl.ts`
- `parseNaverPagePrices(html)` — **순수 파서**(네트워크/Playwright 불필요, 단위 테스트 가능). `__PRELOADED_STATE__` 임베드 필드 파싱:
  - `salePrice` → 정가(regularPrice), `discountedSalePrice`(top-level 또는 `benefitsView` 내부) → 할인가(salePrice).
  - 정가만 → sale=정가, regular=null(가짜 할인 방지). 할인가 ≥ 정가 → regular drop.
  - `mobileDiscountedSalePrice` 오매칭 방지(대소문자 구분 regex).
  - DOM 폴백: Open-Graph `product:price:amount`(할인가만), `og:title`(용량/단품 normalize용).
- `detectSoldOut(html)` — `saleStatus`(SUSPENSION/OUTOFSTOCK/…), `outOfStock`, `stockQuantity:0` → 품절(추측 금지, 보수적).
- `isNaverStorefrontUrl(url)` — brand/smartstore/m.smartstore/naver.me 만 크롤 대상(카탈로그·쿠팡·올영 제외).
- `crawlNaverPagePrice(url)` — Playwright(`import('playwright')` 지연 로드: 웹 빌드/mock 미로드) headless로 페이지 로드 → 최종 host가 네이버인지 확인 → HTML → 순수 파서. 모든 실패 시 `null`(link-only).

### `crawler/adapters/naver.ts`
- `matchNaverOffer`(API 앵커) **miss 시에만** 페이지 크롤 폴백 실행(Phase 1). 조건: `!isMock && !needsInspection && isNaverStorefrontUrl(listing.url)`.
  - 크롤 성공(가격 있음·품절 아님) → `regularPrice`=정가, `salePrice`=할인가, `outcome='ok'`, 용량은 `extractPackageFromTitle(title)` 로 `parsedVolumeRaw`.
  - 크롤 실패/품절/미검출 → 기존 link-only(`no_offer`, matchExcluded) 경로로 폴백.
- **API 앵커 성공 제품은 크롤 안 함**(기존 API 가격 유지 — 회귀 없음). 알려진 set(`needsInspection`)도 크롤 안 함(set 가격 방지).
- 검색 API 앵커 경로는 1차 시도로 유지(제거하지 않음).

## 주요 변경 파일
- `crawler/core/naverPageCrawl.ts` (신규)
- `crawler/core/__tests__/naverPageCrawl.test.ts` (신규, 14 케이스)
- `crawler/adapters/naver.ts` (앵커-miss 폴백 추가)
- `package.json` (`test:navercrawl` 추가, `test:all` 에 편입)

## 테스트 결과
- `test:navercrawl` 14/14 PASS — 정가+할인가/정가만/할인가≥정가/benefitsView nested/mobile 오매칭 방지/품절(SUSPENSION·stock0·outOfStock)/og:title/og price 폴백/no-price→found=false/storefront URL 판별.
- `test:all` 전부 green(회귀 없음), `typecheck` green, `next build` green, 변경 파일 `eslint` clean(`git diff --check` 의 trailing-whitespace 는 본 작업과 무관한 기존 `docs/uiux/UI_DESIGN.md`).
- 네트워크 크롤은 **미실행**(Playwright 브라우저 바이너리 필요 + robots 결정). 라이브 검증은 운영자 환경(GitHub Actions/로컬, `npx playwright install chromium`)에서 다음 `crawler:sync` 시 수행.

## 남은 이슈 / TODO
- **라이브 검증(운영자)**: 앵커-miss 제품(에뛰드 순정·이니스프리·코스알엑스·동화후시다인 등)이 페이지 크롤로 정가+할인가 수집되는지 샘플 확인. 회귀 확인: 조선미녀 등 API-앵커 성공 제품은 크롤 안 됨.
- **Playwright 브라우저 설치**: 크롤 환경에 `npx playwright install chromium`(+ Actions `--with-deps`) 필요. 미설치 시 `crawlNaverPagePrice`는 link-only 폴백.
- **Phase 2 (확장, 잘 되면)**: 모든 네이버 링크 크롤 — API가 정가를 안 주므로 이미 앵커되는 제품도 정가 baseline 을 얻으려면 페이지 크롤 필요. "공식몰 대비 픽" 정가 baseline 완성.
- 임베드 구조는 깨지기 쉬움 → 셀렉터/필드 변경 시 fail-safe(link-only) 로 떨어지므로 가짜 가격은 안 나지만, daily summary 의 no_offer/disappeared 증가로 모니터링.
