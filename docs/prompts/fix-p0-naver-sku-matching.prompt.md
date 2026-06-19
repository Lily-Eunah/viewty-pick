# Claude Code 작업 프롬프트 — P0: 네이버 SKU 매칭 정확성 (단품 앵커링 · 세트 제외)

> 목적: "가격을 못 믿겠다"의 **근본 원인** 수정. 네이버 매칭이 큐레이션한 **단품** 대신 검색 상위의
> **세트·기획·더블팩**을 가져오는 문제를 고친다. `crawler/adapters/naver.ts pickOfficialOffer`가
> listing.url의 productId를 버리고 brand+name으로 재검색하는 게 핵심 결함(쿠팡만 앵커링).
> 근거: `docs/worklog/price-integrity-audit.md`.
>
> 베이스: 최신 `main`. 신규 분기 `fix/naver-sku-matching`.

---

## 0. 확정된 근본 원인 (audit)
- 네이버 `pickOfficialOffer`가 **listing.url의 정확한 productId를 무시**하고 brand+name 재검색 → 상위의 세트/기획/더블을 채택.
- 라이브 교차검증 증거: 유세린 단품 30ml **60,900**(pid 88900077622)이 검색에 있는데 "2종세트"(105,600)를 집음 / 랑콤 큐레이션 SKU 대신 "50ml 선물세트"(170,000) / 토리든 포맨 OY 단품 대신 "단독기획 더블"(38,000).
- `retailer_allowlist` **0건** → 올영 via 네이버 매칭 실패.
- `packageExtractor`가 세트 구성 오해석(샘플 "7ml*2"·"1매"를 수량으로, 더블/1+1/리필/증정 미인식).

## 1. 수정 (P0)

### 1a. productId 앵커링 (네이버)
- `listing.url`(`brand.naver.com/{store}/products/{N}` 또는 catalog/channelProductNo)에서 **productId 추출**.
- 검색 결과에서 **그 productId와 일치하는 항목을 최우선 채택**(쿠팡 어댑터의 앵커링과 동일 패턴).
- ⚠️ **네임스페이스 확인**: 브랜드스토어 URL productId가 검색 API의 `productId`와 일치하는지 라이브로 검증(audit가 단품 pid를 확인했으니 가능성 높음). 일치하면 그걸로 앵커. **일치하지 않으면** 1b의 단품 분류로 폴백.

### 1b. 단품 vs 세트/기획/더블/샘플 분류 → 세트 비교 제외
- 제목/구성에서 **세트성 토큰** 감지: `선물세트`,`기획세트`,`기획`,`더블`,`2종`,`3종`,`세트`,`1+1`,`+증정`,`증정`,`샘플`,`리필`,`패키지`,`구성`, 이종 용량 `100ml+21ml` 등.
- **이종 구성 세트(토너+세럼 등)** → 개당가 산정 불가 → **비교에서 제외**(base/effective 미산정, no_offer 또는 별도 플래그). 단품이 따로 있으면 그 단품을 채택.
- **단품 우선 선택**: 후보 중 큐레이션 `products.volume_ml`과 용량 일치하는 **단품**을 우선. 세트/더블/기획은 단품이 없을 때만, 그것도 "세트가" 명시로만(헤드라인 단품가로 오인 금지).

### 1c. retailer_allowlist 채우기
- 브랜드별 **공식 mallName**을 `retailer_allowlist`에 입력(네이버 공식스토어 + **올리브영**). 0건이라 올영이 전부 실패 중.
- mallName은 라이브 매칭에서 관측된 정확 표기로(운영자 확인 권장). 올영 via 네이버(tier-2)가 이걸로 살아남.

### 1d. packageExtractor 보강
- **수량 오해석 차단**: 샘플 동봉 `7ml*2`·증정 `1매`를 단품 수량으로 세지 않기(증정/샘플은 수량 미반영, base에 영향 없음).
- **더블/1+1/리필/증정** 토큰 인식 → bundle/buy_x_get_y/none로 올바르게 분류(현재 'set'을 normalize가 수량2로 흡수하는 문제 포함 — normalize와 함께 점검).

## 2. 재수집 + 검증 (audit ground-truth 대조)
- 어댑터 단위 테스트 통과 후 **제한 sync**(대표 제품: 유세린·랑콤·토리든·라하·더마)로 재수집.
- **검증 기준(실값)**: 유세린 단품 **60,900**, 랑콤 세트 → **비교 제외**(또는 단품 채택), 토리든 OY 단품(더블 아님), 라하 토너 쿠팡 6개 67,800(개당 11,300)·네이버 16,800.
- 이상 없으면 전체 재수집. **crawl_runs/crawl_errors 기록·last_crawled_at 갱신**도 이참에 켜기(현재 0건/NULL이라 신선도 확인 불가).

## 3. 테스트
- `pickOfficialOffer`: productId 앵커 채택, 세트/기획/더블 후보 **제외**, 단품 우선, allowlist mallName 매칭.
- packageExtractor: 샘플/증정 수량 미반영, 더블/1+1/리필 인식, 이종세트 비교제외.
- 기존 normalize/coupang/oliveyoung/publicprices 회귀 통과.
- 각 커밋 전 `lint && typecheck && test:all && build`.

## 4. 브랜치 & 커밋 (CLAUDE.md)
- 분기 `fix/naver-sku-matching`. main 직접 커밋·force push 금지.
- 커밋 단위:
  - `fix: anchor naver match to curated productId from listing.url`
  - `fix: classify single vs set/bundle and exclude sets from price match`
  - `feat: seed retailer_allowlist official mallNames`
  - `fix: packageExtractor sample/gift/double/refill handling`
  - `test: naver sku matching (anchor, set-exclusion, packageExtractor)`
  - `docs: worklog for naver-sku-matching`
- 각 커밋 전후 `git diff --stat`/`git diff --check`/`git show --stat HEAD`. `docs/prompts`·`tmp`·`UI_DESIGN.md`·시크릿 비커밋.
- 재수집(원격 쓰기)은 게이트: 제한 검증 → 보고 → 전체. 시크릿 비노출.
- 영어 PR(요약·이유·검증결과: ground-truth 대조표) → CI green → merge.

## 5. Definition of Done
1. 네이버가 **단품(productId 앵커)**을 채택, 세트/기획/더블은 비교 제외(또는 세트가 명시).
2. allowlist 채워져 올영 via 네이버 매칭 동작.
3. 재수집 후 ground-truth 일치(유세린 60,900 등) 검증표 제출.
4. packageExtractor가 샘플/증정/더블/리필을 오해석하지 않음(테스트).
5. crawl_runs/last_crawled_at 기록 켜짐. 테스트·빌드·CI 통과, worklog.

## 6. 막히면
- URL productId ↔ 검색 API productId 네임스페이스 불일치면 → 단품 분류(1b)로 폴백하고 그 사실 보고(추측 앵커 금지).
- allowlist 공식 mallName이 불명확한 브랜드 → 운영자에게 확인 요청, 그 전엔 해당 올영 비교 제외.
- 단품이 검색에 아예 없고 세트만 있으면 → 비교 제외 + manual_override 후보로 보고(세트를 단품가로 표기 금지).

---

## 참고: 이 PR과 별개(웹 레이어, 병렬 진행)
A(mock 제거: 별점·previousPrice×1.25·20%·하락) + B/C(다중팩 개당가 표시·개당 정렬·세트 표시·0원 뒤로) + 구조(current_prices 死코드 정리)는 **별도 웹 수정 프롬프트**로. 이 P0(수집 정확성)와 독립.
