# Claude Code 작업 프롬프트 — 네이버 가격/링크 해석 최종 규칙 (3 케이스 + 공식몰=브랜드명 포함)

> PR #32(티어드 폴백) 위에 **운영자 확정 규칙**을 정밀 적용. 네이버 제품을 링크 상태별 3케이스로 처리.
> 베이스: 최신 `main`. 분기 `refactor/naver-price-link-rules`. 대상: `crawler/adapters/naver.ts`, run.ts(없는 링크 케이스), healthcheck/normalize(warning).

## 공통 — "공식몰" 정의 (엄격)
검색 API 결과 중 **개별 네이버 스토어**(smartstore/main, brand.naver, window-products 등 — 카탈로그/외부몰 제외)이고:
- **mallName에 제품 브랜드명을 반드시 포함**(필수 조건; 미포함 = 공식몰 아님 → 리셀러/타몰 배제),
- **+ identity**: gift-strip 후 sim ≥ 0.6 + 코어 토큰 present + form-conflict 없음 + **용량 일치**(다사이즈 시 products.volume_ml로 선택),
- 여러 후보면 가격 outlier 제외 후 채택.
- (정밀화 옵션: `retailer_allowlist`에 공식 mallName 있으면 우선.)

## 어필리에이트 판정
`isNaverAffiliate(url)` = **`naver.me/` 포함만 true**. 그 외 전부 비어필리에이트.

---

## 케이스 A — 운영자가 넣은 **어필리에이트(naver.me)** 링크
**구매 링크: 절대 교체 안 함(naver.me 유지).** 가격은:
1. resolve(naver.me)→channelProductNo. **API에 그 productId가 있으면 → 그 오퍼(링크)의 가격 사용**(앵커, warning 없음).
2. **API에 그 productId가 없으면 → API가 찾은 공식몰 가격 사용 + `warning`** — warning에 **그 어필리에이트 링크를 함께 기록**(추후 그 제품에 어필리에이트 적용 검토용). 링크는 naver.me 유지.
3. **공식몰도 API에 없으면 → 카탈로그 `lprice` 임시 적용 + `warning`**(→ 운영자 manual price 입력 예정). 링크 naver.me 유지.

## 케이스 B — 운영자가 넣은 **비어필리에이트**(brand.naver.com/smartstore 등) 링크
1. **API에 그 productId가 있으면 → 그 링크의 가격 사용**(앵커), 링크 유지.
2. **없으면 → API 공식몰 가격 사용 + 구매 링크를 그 공식몰 URL로 변경**(비어필리에이트라 교체 OK). (price·link 주체 동일 → mismatch warning 불필요.)
3. **공식몰도 없으면 → 카탈로그 `lprice` + `warning`**, 링크는 운영자가 넣은 비어필리에이트 그대로.

## 케이스 C — 운영자가 **네이버 링크를 안 넣은** 제품
1. **API에서 공식몰 가격 가져오기 + 그 공식몰 URL을 구매 링크로 등록**(brand+name 검색 → 공식몰 매칭). naver 리스팅이 없으면 **생성**.
2. **공식몰이 API에 없으면 → 네이버를 가격비교에서 제외**(네이버 행 자체를 안 보임).
- ⚠️ 구현 범위: 현재 크롤러는 *존재하는 listing*만 처리 → C는 "naver 셀이 빈 제품"에 대해 검색·공식몰 발견 시 listing/price를 만드는 *추가 동작*이 필요. (run.ts/import 연계.)

---

## warning 처리 (PR #32 `inspectionWarning` 활용)
- A2(공식가, 링크≠가격주체), A3·B3(카탈로그) → `warning` + `unit_price_reliable=false`(ml당 숨김, base 가격은 노출). A2 warning엔 어필리에이트 링크 첨부.
- A1·B1(앵커), B2(공식가+링크 동일주체), C(공식가+공식링크) → warning 없음(정합).
- 카탈로그 채택은 "임시(전판매처 최저가·공식 아님)"로 표기 → 운영자 manual price 우선.

## 테스트
- 공식몰 게이트: mallName에 **브랜드명 미포함이면 채택 안 함**(리셀러 배제), 포함+identity+용량 일치만 채택.
- A: naver.me + productId 있음→링크가격(무warning); 없음→공식가+warning(어필리에이트 링크 첨부)+링크 유지; 공식몰 없음→catalog+warning.
- B: productId 있음→링크가격; 없음→공식가+**링크 공식몰로 변경**; 공식몰 없음→catalog+warning+링크 유지.
- C: 링크 없음 + 공식몰 있음→공식가+공식링크 등록; 없음→네이버 제외.
- 앵커 성공(조선미녀) 회귀 0. `test:all`·typecheck·build·lint green.

## 브랜치 & 적용
- `refactor/naver-price-link-rules`: `feat: naver 3-case price/link rules (affiliate keep / non-affiliate update / no-link discover) + official-mall requires brand in mallName`, `test`, `docs: worklog`. 영어 PR → CI → merge.
- 머지 후 `crawler:sync`로 케이스별 검증 → `cf:deploy`. 기존 brand.naver.com 데이터 정리 불필요(B로 처리).

## 막히면
- 케이스 C(없는 링크 discover)가 크롤러 구조상 크면, A·B 먼저 적용하고 C는 후속 PR로 분리 보고.
- 공식몰 mallName 브랜드명 매칭이 표기 흔들림(공백/영문) 있으면 정규화 후 포함 검사, 애매하면 채택 말고 warning/제외.
