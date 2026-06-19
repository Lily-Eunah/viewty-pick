# Claude Code 작업 프롬프트 — 네이버 공식몰 상품페이지 직접 크롤 (정가 + 할인가)

> 목적: 검색 API 앵커가 실패하는 네이버 공식 링크(brand.naver.com channelProductNo ≠ 검색 smartstore productId namespace 문제)와 **정가(할인 전) 미제공** 문제를 동시에 해결한다.
> 큐레이트한 네이버 URL은 *정확한 상품 페이지*를 가리키므로, **그 페이지를 직접 크롤해 정가+할인가를 읽는다.**
> 운영자 결정: "그냥 하자"(brand.naver.com을 smartstore로 못 바꿈, 규모 있는 브랜드 공식 등록 상품이 brand로 뜸).
> 베이스: 최신 `main`. 분기 `feature/naver-official-page-crawl`. 대상: `crawler/adapters/naver.ts`(+ 필요 시 Playwright 유틸).

## 동작
1. **URL resolve** — 기존 `resolveCuratedProductNo`처럼 naver.me면 redirect 1회로 최종 상품 URL 확보(brand.naver.com/{store}/products/{N} 또는 smartstore).
2. **상품페이지 크롤(Playwright)** — 그 URL을 헤드리스로 로드해 **정가(정상가)와 할인가(판매가)** 추출:
   - 우선 페이지 임베드 데이터(`__PRELOADED_STATE__`/JSON)의 `salePrice`(정가)·`discountedSalePrice`(할인가)·`benefitsView`를 파싱, 실패 시 DOM 셀렉터 폴백.
   - 품절/판매중지/가격 미검출 → `failed`(파싱 실패) 또는 link-only, 추측 금지.
3. **저장** — `regular_price=정가`, `sale_price=할인가`(정가만 있으면 sale=정가). 단품/용량은 기존 normalize(packageExtractor)로. 이 값이 **공식몰 baseline(공식가)** 이 됨 → "공식몰 대비 픽"이 할인가가 아닌 **정가 대비**로 동작.
4. **적용 범위 — 단계 적용 (운영자 결정)**
   - **Phase 1 (이번 PR): API 앵커가 실패한 제품만 크롤.** 즉 `matchNaverOffer`가 가격을 못 얻으면(앵커 miss/link-only) **그때 페이지 크롤을 폴백**으로 실행. → 크롤량·anti-bot 노출 최소(현재 ~12건), 누락 회수 검증.
   - **대상 = 시트에 넣은 네이버 링크면 무조건**(`is_official_store` 플래그로 게이트하지 말 것 — 우리가 큐레이트한 네이버 링크가 곧 대상).
   - **Phase 2 (잘 되면 확장): 모든 네이버 링크 크롤** — API는 정가를 안 주므로, 이미 앵커되는 제품(조선미녀 등)도 **정가(할인 전)** 를 얻으려면 페이지 크롤이 필요. 공식몰 대비 픽의 정가 baseline 완성.
   - 검색 API 앵커는 제거하지 말 것(Phase 1에선 1차 시도, 비공식 판매처 recall에도 사용).

## 안전/매너 (중요)
- **robots.txt 준수**(scripts/live-check/check-robots 참고), UA 위장 금지, **요청 간 지연·동시성 제한**(예: 1~2s 간격, 직렬), 일일 1회 크롤 규모(≤네이버 공식 링크 수, 현재 ~수십개)라 과부하 아님.
- 셀렉터/임베드 구조는 깨지기 쉬움 → 실패 시 **조용히 link-only/failed**로 폴백하고 알람, 잘못된 가격을 만들지 말 것.
- Playwright는 크롤 환경(GitHub Actions/로컬)에서 동작 확인. mock 모드에선 네트워크 크롤 skip.

## 테스트
- **Phase 1 트리거**: API 앵커 성공 제품(조선미녀 등)은 **크롤 안 함**(기존 API 가격 유지, 회귀 없음). 앵커 miss 제품(에뛰드 순정·이니스프리·코스알엑스·동화후시다인 등)만 페이지 크롤 폴백 실행.
- 앵커-miss 제품이 상품페이지 크롤로 **정가+할인가 수집**되는지(샘플 일부 라이브 확인).
- 정가>할인가면 둘 다 저장, 정가만이면 sale=정가.
- 품절/미검출/차단 → link-only/failed(가짜가격 0).
- 기존 검색-앵커 경로·쿠팡·OY 무영향(회귀). `test:all`·typecheck·build green.

## 브랜치 & 적용
- `feature/naver-official-page-crawl`: `feat(crawler): naver official-store page crawl for 정가+할인가`, `test`, `docs: worklog`.
- 영어 PR → CI → merge → 다음 `crawler:sync`에서 정가/앵커-miss 회수 반영 → `cf:deploy`.
- `git diff --check`, 시크릿·`docs/prompts`·`tmp` 비커밋.

## 막히면
- 네이버가 헤드리스를 차단하면(캡차/봇감지) 보고 → 지연/스텔스 옵션 조정, 그래도 막히면 해당 건 link-only 유지(추측 금지).
- 임베드 JSON 구조가 brand vs smartstore에서 다르면 둘 다 핸들링, 못 찾으면 failed.
