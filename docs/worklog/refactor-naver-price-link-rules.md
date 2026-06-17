# refactor/naver-price-link-rules

PR #32(티어드 폴백) 위에 운영자 확정 가격/링크 규칙을 정밀 적용. 네이버 제품을 링크 상태별 3 케이스로 처리.

## 공식몰 정의 (엄격, 운영자 확정)
검색 API 결과 중 **개별 Naver 스토어**(smartstore/main, brand.naver, window-products — 카탈로그/외부몰 제외)이고:
- **mallName에 제품 브랜드명을 반드시 포함**(필수 조건; 미포함 = 공식몰 아님 → 리셀러/타몰 배제),
- + 엄격 identity(gift-strip sim≥0.6 + 코어토큰 + form-conflict 없음 + 용량 일치),
- 여러 후보면 outlier 제외 후 채택. `retailer_allowlist` mallName 있으면 우선.

변경: PR #32의 `isOfficialBrandStoreOffer`는 brand 포함 **+ (공식/직영/본사 또는 brand 단독)** 을 요구했으나, 운영자 규칙대로 **brand 포함(필수)** 만으로 완화(미포함이면 배제). recall↑, 오채택은 identity/용량/warning 으로 방어. `isNaverHostedStore` 는 m.smartstore + window-products 포함하도록 확장.

## 어필리에이트 판정
`isNaverAffiliate(url)` = **`naver.me/` 포함만 true**. listing.url 또는 affiliate_url 어느 쪽이든 naver.me면 affiliate.

## 3 케이스 (링크 유형별)
구현은 anchor(Tier-1) → `matchNaverOffer` Tier-2(공식몰)/Tier-3(catalog), 케이스 분기는 `fetchOffer` + 순수 `fallbackPolicy(tier, isAffiliate)`:

| 상황 | 가격 | 구매 링크 | warning |
|---|---|---|---|
| A1/B1 anchor (productId가 API에 있음) | 그 오퍼 가격 | 유지(affiliate면 latest_matched_url 미갱신) | 없음 |
| **A2** affiliate + 공식몰 (anchor miss) | 공식몰 가격 | naver.me 유지(`matchedUrl=null`) | **있음** + warning/source_text에 affiliate URL 기록 |
| **B2** 비어필리에이트 + 공식몰 (anchor miss) | 공식몰 가격 | **공식몰 URL로 변경**(`matchedUrl=item.link`) | **없음**(price·link 동일주체) |
| **A3/B3** catalog (공식몰도 없음) | catalog lprice(임시) | 운영자 링크 유지(`matchedUrl=null`) | **있음**(전판매처 최저가·공식 아님) |

- warning = `inspectionWarning`(PR #32) → healthcheck status=warning + normalize `unit_price_reliable=false`(ml당 숨김, base 가격은 비교 노출). B2 는 warning 없음 → status=ok(앵커와 동급 정합).
- affiliate 리스팅은 anchor 경로에서도 `matchedUrl=null`(naver.me 절대 교체 금지).

## Case C (네이버 링크 없는 제품) — **후속 PR로 분리**
운영자 노트대로: 현재 크롤러는 *존재하는 listing*만 처리하므로, "naver 셀이 빈 제품"에 대해 검색→공식몰 발견 시 listing/price 를 **생성**하는 추가 동작(run.ts/import 연계)은 구조 변경이 커 본 PR에서 제외. A·B 먼저 적용. C는 별도 PR(discover + listing 생성, 또는 미발견 시 네이버 행 제외)로 보고 예정.

## 주요 변경 파일
- `crawler/adapters/naver.ts` — 공식몰 게이트 완화/host 확장, `isNaverAffiliate`, `fallbackPolicy`, `fetchOffer` 3-케이스 가격/링크/warning.
- tests: `naver.test.ts` — 공식몰 게이트(brand 미포함 배제·allowlist 우선), isNaverAffiliate, fallbackPolicy(A2/B2/A3/B3) +7.

## 테스트 결과
- `test:naver` green(공식몰 게이트 brand-필수, allowlist 우선, isNaverAffiliate, fallbackPolicy 매트릭스, 기존 Tier-2/3 픽커·다사이즈·form-conflict 유지).
- `test:all`·typecheck·build·변경파일 eslint green. 앵커 성공(조선미녀 등)·OY·쿠팡 회귀 0.

## 남은 이슈 / TODO
- **라이브(운영자)**: `crawler:sync` 후 케이스별 검증 — A2(공식가+warning, naver.me 유지, affiliate URL 기록), B2(공식가+링크 공식몰로 변경, warning 없음), A3/B3(catalog 임시+warning). `cf:deploy`. 기존 brand.naver.com 데이터 정리 불필요(B로 처리).
- **Case C 후속 PR**(없는 링크 discover/생성).
- 완화된 공식몰 게이트로 brand 네임드롭 리셀러가 identity까지 통과해 B2(무warning)로 채택될 잔존 위험 → allowlist mallName 시딩으로 정밀화 권장.
