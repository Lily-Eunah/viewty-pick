# Claude Code 작업 프롬프트 — 웹 레이어 UI PR (mock 제거 · 공식몰 대비 픽 · 개당가/다중팩 · tier-4 link-only · placeholder · 공정위)

> 목적: "정확한 값"(매처 PR) 위에 **보이는 가짜값 제거 + 표시/정렬/신뢰 장치**를 입혀 사이트를 깨끗하게 만든다.
> **웹 레이어 전용** — 크롤러·DB 쓰기·신규 마이그레이션 없음. `next/image`는 **별도 PR**(이 PR 제외).
> 베이스: **매처 PR이 머지된 최신 `main`**. 분기 `feature/web-layer-ui`. (매처 미머지면 그 브랜치 위에서.)

---

## A. 가짜 데이터 제거
- **별점·리뷰수** (`components/home/TodayDealSection.tsx`의 `rating=viewtyScore/20`, `reviews=...`) → **제거**(MVP 리뷰 없음).
- **previousPrice/취소선/"어제보다 OO원"** (`lib/queries/index.ts`의 `previousPrice=lowestPrice*1.25` 및 파생 `priceDropAmount/Rate`) → **제거**. `UIProduct`에서 해당 필드 제거 또는 사용처 정리.
- **"20% 인하" 뱃지**, **"OO원 하락" 뱃지** → 제거(위 mock 파생).
- ⚠️ 진짜 "가격 하락/역대 최저"는 가격 히스토리 자산이 쌓인 뒤 별도 — 지금은 넣지 않음.

## B. 메인 "🏆 공식몰 대비 최저가 픽" (오늘 가격 좋은 제품 대체)
- **기준 메트릭**: 제품의 **공식 스토어 listing**(`is_official_store=true` = 네이버 공식 브랜드스토어)의 **개당 기준 공식가** 대비, **다른 검증 판매처 최저 개당가**의 **할인율 %**.
  - **공식가 baseline = 공식 listing의 정가(`regular_price`) 개당가, 없으면 현재가(`sale_price`) 폴백.**
  - **비교는 개당(effective_unit_price) 기준** — 공식 단품가 vs 쿠팡 6개 *팩총액* 직접비교 금지(개당으로 환산).
  - `discount% = (공식가개당 − 최저개당)/공식가개당 × 100`. **양(+)일 때만**(공식이 최저면 제외), **공식 baseline 없으면 제외**.
- **정렬**: 할인율 % 내림차순(→ 고가 무조건 상위 버그 해소).
- **카드 레이아웃**:
  ```
  [이미지] 브랜드명 / 제품명 / ml당 단가(신뢰 시만)
  [공식몰 대비 35% 저렴]
  최종가 19,500원  (공식가 30,000원)
  ```
  - **ml당 단가는 `unit_price_reliable`일 때만** 표시(용량 미검증이면 숨김).
- 섹션명 "🏆 공식몰 대비 최저가 픽" + 서브 "공식 브랜드 스토어 가격 대비 할인폭이 큰 제품".
- **커버리지 폴백**: 자격 제품이 너무 적으면(예: <N) Viewty Score 가격경쟁력 상위로 보충하거나 섹션 축소. 분포 보고.

## C. 정렬 & 개당가/다중팩 표시 (리스트/카드 공통)
- **최저가순에서 무가격(0/null) → 맨 뒤**(현재 0이 최소라 맨 앞). `getProducts` price_asc 보정.
- **다중팩 헤드라인**: 팩총액(base) 단독 표시 금지 → **"N개 / 개당 X원"**. 카드 최저가도 개당가 우선.
- **정렬 기준**: 다중팩 비교는 **개당가(effective_unit_price)** 기준(라하 쿠팡 6개가 위로).
- **개당가 표시**: 1+1·N팩·리필 → "개당 X원 · N개".
- **증정형**: 본품가 + "○○ 증정" 라벨(가격·수량 미반영, 매처/normalize에서 이미 그렇게 들어옴).

## D. tier-4 link-only 렌더 (매처 변경으로 중요)
- `mapToUIProduct`가 **스냅샷 없는(가격 없는) listing을 drop** → link-only(OY held·네이버 앵커미스 등)가 사라짐. → **"○○에서 보기" 링크 버튼(가격 없음) 행으로 렌더**.
- **전 판매처 무가격 제품 카드**: 가격 없이 graceful("가격 확인 필요" + 링크), 리스트에선 맨 뒤(B와 연결).

## E. 상세 PriceTable 구조
```
[공정위 disclosure 블록]  ← 가격표 위, 배경대비 있게(F-1)

요약 최저가 2종:
  🏷 1개 기준 최저  네이버 16,800원
  💰 개당 최저      쿠팡 11,300원/개 (6개 기준)   ← 다중팩/1+1 있을 때만; 같으면 1개만

판매처별 표 (priced 먼저, link-only 뒤):
| 판매처 | 가격 | 개당가 | 구성 | |
|---|---|---|---|---|
| 쿠팡 | 67,800 (6개) | 11,300/개 | 1+1·로켓 | [구매] |
| 네이버 | 16,800 | – | – | [구매] |
| 올리브영 | 14,400 | – | 증정 | [구매] |
| 올리브영 | — | — | 가격 확인 | [올영에서 보기] |
```
- **컬럼 = 판매처 · 가격 · 개당가 · 구성 · 구매.** **배송 컬럼 없음**(미수집 — 빈칸/가짜 금지).
- **구성 = 긁어온 것만**: `promo_type/promo_text`(1+1·N개·증정) + `isRocket`(로켓, 쿠팡에서 수집) 라벨. 그 외 배송 정보 표시 안 함.
- 최저(기본가/개당가) 행 하이라이트. 구매=`/go/[listingId]`(affiliate). link-only 행은 가격 없이 링크.

## F. 신뢰 장치 / 공정위 / 문구
1. **공정위 disclosure (판매처별, 가격표 *위*에 눈에 띄게)** — 그 페이지에 *실제로 있는 판매처*의 문구만:
   - 네이버: "이 포스팅은 네이버 쇼핑 커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공 받습니다"
   - 쿠팡: "이 포스팅은 쿠팡 파트너스 활동의 일환으로 이에 따른 일정액의 수수료를 제공받습니다."
   - 올리브영: "이 포스팅은 올리브영 쇼핑 큐레이터 활동의 일환으로, 구매 시 일정 금액의 수수료를 제공받습니다."
   - 배경대비 있는 블록으로 구매/가격 *근처 위쪽*에. (기존 일반 문구 푸터는 유지.)
2. **갱신 시각** 표기(상세) — "매일 오전 갱신 · 마지막 갱신 {crawled_at}". `listing_prices_public.crawled_at` 활용.
3. **"실제 결제가는 판매처에서 확인"** 안내(상세 가격 영역).
4. **"실시간" 문구 정리** — "실시간 랭킹/비교"는 매일 갱신이라 오인 → "디렉터파이 추천 TOP" 등으로 수정.

## G. 이미지 placeholder
- 사진 없는 카드: **단일 깔끔 1:1 placeholder + 카드 aspect-ratio 고정**(이미지 유무 무관 균일 높이). 현재 멀티아이콘(`CosmeticPlaceholderIcon`)·flat 이미지로 높이 깨지는 것 수정.
- 표시 우선순위(기존 유지): operator `products.image_url` → 쿠팡 productImage → placeholder.
- **next/image는 이 PR 제외**(별도 CWV PR).

## H. 찜 버튼 — 유지
- 현행 로컬 토글 유지(관심상품 영구저장은 Phase 5). 변경 없음.

---

## 주요 파일(예상)
`lib/queries/index.ts`(mapToUIProduct: mock 제거·개당가/다중팩·정렬·link-only 포함·공식몰대비 메트릭) · `lib/types.ts`(UIProduct 필드 정리: previousPrice/priceDrop 제거, officialPrice/discountVsOfficial 등 추가) · `components/home/TodayDealSection.tsx`(공식몰 대비 픽 카드) · `components/product/{ProductListCard,StorePriceCard,PriceTable}.tsx` · `app/p/[slug]/page.tsx`(상세 표·disclosure·갱신시각) · `app/page.tsx`·`CategoryProductList.tsx`(정렬) · `components/common/{CosmeticPlaceholderIcon,ProductImageWithFallback}.tsx`(placeholder) · 공정위 disclosure 컴포넌트 · `lib/format.ts`.

## 테스트
- mock 필드 제거 회귀(별점·previousPrice·20%·하락 미노출).
- 공식몰 대비 픽: 공식 baseline 있음+더 싼 판매처 → % 양수만, 개당 기준, 정렬 % 내림차순, baseline 없으면 제외; ml당은 reliable 시만.
- 정렬: 무가격 맨 뒤. 다중팩 개당가 표시·정렬.
- tier-4: 가격 없는 listing이 링크 버튼으로 렌더(drop 안 됨), 전 무가격 카드 graceful.
- 공정위: 페이지에 있는 판매처 문구만, 가격표 위.
- placeholder: 이미지 없어도 카드 높이 균일.
- `test:all`·typecheck·build·lint green. **DB 쓰기 없음.**

## 브랜치 & 커밋 (CLAUDE.md)
- `feature/web-layer-ui`. main 직접 커밋·force push 금지. 의미 단위 커밋:
  - `refactor: remove mock ratings/previousPrice/discount badges`
  - `feat: 공식몰 대비 최저가 픽 home section (official-vs-lowest discount %)`
  - `fix: per-unit display + multipack ranking + missing-price sort to back`
  - `feat: render tier-4 link-only seller rows + no-price product cards`
  - `feat: per-platform 공정위 disclosure above price table + 갱신시각/결제가 안내`
  - `fix: single 1:1 placeholder + uniform card aspect-ratio`
  - `chore: reword 실시간 labels`
  - `test: web-layer (mock removal, official-pick, per-unit, link-only, disclosure)`
- `git diff --check`, 시크릿·`docs/prompts`·`tmp`·`UI_DESIGN.md`(운영자) 비커밋.
- 영어 PR(요약·이유·테스트결과) → CI green → `gh pr merge --merge --delete-branch` → main 배포(`cf:deploy`)로 반영.

## DoD
1. 가짜값(별점/이전가/20%/하락) 전부 제거.
2. 메인 "공식몰 대비 최저가 픽"(개당·정가baseline·% 정렬, ml당 reliable시) 동작 + 커버리지 분포 보고.
3. 무가격 맨 뒤·다중팩 개당가 표시/정렬·증정 라벨.
4. tier-4 link-only 행/카드 렌더(가격 없는 판매처도 안 사라짐).
5. 공정위 판매처별 문구 가격표 위·눈에 띄게 + 갱신시각 + 결제가 안내 + "실시간" 정리.
6. 단일 placeholder + 카드 높이 균일. (next/image 제외.)
7. test/build/CI green, worklog.

## 막히면
- 공식 baseline(정가/현재가)·개당 환산이 애매한 제품은 보수적으로 *그 섹션에서 제외* + 보고(틀린 % 금지).
- link-only 렌더가 기존 카드 레이아웃과 충돌하면 구조 보고 후 결정.
- 공정위 문구 위치/스타일은 "구매 근처·명확" 원칙으로 제안 후 확인.

---
## 별개(이 PR 아님)
- **next/image(CWV)** 별도 PR. **운영자 시트**: 배지명(하이알루론/NAD)·넘버즈인 쿠팡 URL·아르마니 단품 URL.
