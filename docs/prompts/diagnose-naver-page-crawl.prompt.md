# Claude Code 진단 프롬프트 — 네이버 페이지 크롤 실패 원인 규명 (고칠 수 있나 vs 하드 차단)

> 목적: Phase-1 페이지 크롤이 회수 0건(naver.me 타임아웃 / brand.naver.com "no price")인 원인을 규명한다.
> **버그(잘못된 URL 로드/파서 미스 → 고침 가능)** 인지 **하드 anti-bot 차단** 인지 판정.
> **읽기 전용 진단 — DB 쓰기 없음, 코드 변경 없음.** 일회성 스크립트(`scripts/live-check/diagnose-naver-crawl.ts` 정도).
> 전제: `package.json` 복구됨 + `npx playwright install chromium` 됨.

## 대상
anchor-miss 네이버 제품 5개의 큐레이트 URL(시트/DB):
- naver.me 계열: 다이브인(토리든), 녹두 라하(비플레인), NAD(바이오힐보)
- brand.naver.com 계열: 에뛰드 순정(`brand.naver.com/etude/products/10516809109`), 이니스프리(`/innisfree/products/13155811785`)

## 각 URL에 대해 로깅
1. **redirect resolve**: naver.me면 `fetch(url,{redirect:'follow'}).url`로 **최종 URL**을 구해 로그(naver.me가 brand/smartstore 어디로 가는지).
2. **최종 URL을 Playwright로 load**(naver.me가 아니라 *resolve된 최종 URL*을 `page.goto`), timeout **40s**, `waitUntil:'networkidle'`(또는 domcontentloaded 후 2s).
3. 로드 후 로그:
   - HTTP status / 최종 페이지 URL(또 리다이렉트됐는지),
   - `page.title()`,
   - **`__PRELOADED_STATE__` 존재 여부** + 있으면 그 안에 `salePrice`/`discountedSalePrice`/`benefitsView` 키가 있는지,
   - 가격으로 보이는 텍스트(예: `/[\d,]+원/` 첫 매치),
   - **봇 차단 신호**(captcha/"비정상적인"/"접근이 제한"/로그인 리다이렉트/빈 body) 여부,
   - body 앞부분 500자 스니펫.

## 판정 기준 (보고에 명시)
- **resolve된 최종 URL을 load했을 때 `__PRELOADED_STATE__`+가격이 보이면** → 기존 크롤이 *naver.me short link을 직접 열어서* 실패한 **버그** → 수정안: 크롤에 **resolve된 최종 URL 전달** + 파서 키 확인.
- **페이지는 뜨는데 가격/state가 없고 captcha·로그인·빈 body면** → **하드 anti-bot 차단** → 페이지 크롤 포기, 아래 대안.
- naver.me가 40s에도 타임아웃이면 → resolve 단계(fetch)는 되는지 분리 확인(fetch redirect는 되는데 Playwright load만 막히는지).

## 대안 (하드 차단으로 판명 시 — 별도 PR로)
- **네이버 가격비교 카탈로그 fuzzy 매칭**: 오픈 API가 anchor-miss 제품에 `search.shopping.naver.com/catalog/{id}`(가격비교) 항목을 **lprice와 함께** 줌. 제품명/identity로 그 카탈로그 항목을 매칭해 **lprice를 가격으로 채택(+warning: 비앵커·전판매처 최저가)**. 크롤·수동입력 없이 anchor-miss 제품에 가격을 붙이는 길. (공식 스토어가가 아니라 카탈로그 최저가인 점은 warning으로 표기.)

## 산출물
5개 URL의 위 로그 + **버그 vs 하드차단 판정** + (버그면) 수정 포인트 / (차단이면) 카탈로그 대안 권고. 코드/ DB 변경 없음.
