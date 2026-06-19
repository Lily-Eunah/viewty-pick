# Claude Code 작업 프롬프트 — 쿠팡 어댑터 활성화 (제품 URL + productId 매칭 + deeplink 자동생성)

> 목적: 3-플랫폼 비교(올영/네이버/**쿠팡**)를 완성한다. 쿠팡 가격은 **파트너스 검색 API**로,
> 정확 매칭은 **제품 상세 URL의 productId**로, 구매링크는 **deeplink API 자동생성+캐시**로.
> 시트엔 제품 상세 URL만 넣고, 공유 short-link 의존을 제거한다(listing 60 이슈 해결).
>
> 베이스: 최신 `main`. 신규 분기 `feature/coupang-adapter`.

---

## 0. 배경 / 확정 결정

- 쿠팡 자사몰 직접 크롤 차단 → **파트너스 Open API**(HMAC 인증, 기존 `coupang.ts`에 구현됨) 사용.
- **데이터 모델(확정):**
  - 시트: **제품 상세 URL만**(`https://www.coupang.com/vp/products/{productId}...`) → `listings.url`.
  - 구매링크: `affiliate_url` 비면 **deeplink API로 생성 → 캐시**.
  - 가격: 검색 API(제품명 키워드) → URL의 **productId로 정확 매칭** → productPrice.
- **short-link 문제**: `link.coupang.com/a/...`는 productId가 없음 → 이건 **fetch 실패가 아니라 데이터 문제**다. (현재 fetch 실패로 처리돼 listing 60이 비활성됐음 — 이번에 교정.)

---

## 1. 구현

### 1.1 productId 추출 & 데이터 게이트
- `listings.url`에서 `/vp/products/{productId}` 추출.
- **short-link(`link.coupang.com/a/...`)·productId 없음** → fetch 시도 안 함. **`fail_count` 증가 금지**(PR #14의 `failed` 아님). **"제품 URL 필요" 데이터 오류**로 분류해 일일 요약/검수에 노출(운영자가 시트 수정). listing은 active 유지(link-only 가능 시).

### 1.2 가격: 검색 API + productId 앵커
- 파트너스 검색 API(키워드=제품명) 호출(HMAC). 응답에서 **productId == URL의 productId** 인 항목 채택 → `productPrice`, `isRocket`, `isFreeShipping`, `productUrl`(딥링크).
- productId가 결과에 없으면 → **`no_offer`**(정당한 미매칭, PR #14 규칙대로 fail_count 0 리셋·link-only). API 오류/타임아웃 → **`failed`**(단계 처리).
- **productId 네임스페이스 확인**: URL의 `/vp/products/{id}`가 검색 API가 반환하는 productId와 동일한지 구현 시 검증(다르면 매칭 로직 조정). **파트너스에 productId 직접 가격 조회 엔드포인트가 있으면 그걸 우선**(rate limit 절감) — 문서 확인.
- **레이트리밋**: 검색 API **시간당 10회** → 호출 간 **360s 간격** 엄수(기존 `MIN_CALL_INTERVAL_MS`). 제품당 1콜이라 풀셋이면 수 시간 → §3 스케줄 메모 참조.

### 1.3 deeplink 자동생성 + 캐시
- `affiliate_url` 비어 있으면 파트너스 **deeplink API**로 제품 URL → 제휴링크 생성 → **`affiliate_url`(또는 캐시 컬럼)에 저장.**
- **매 런/매 요청마다 재생성 금지** — 없거나 만료 시에만. (deeplink는 검색보다 한도 여유 있으나 캐시로 호출 최소화.)
- 리다이렉트(`/go/[listingId]`)는 기존 우선순위(`affiliate_url` → `latest_matched_url`)대로 동작.

### 1.4 정규화 / 표시
- 가격 → `normalize`(base/effective/unit_price). 용량은 `products.volume_ml`(§1b), 쿠팡 프로모션은 best-effort(검색 API 정보 한정).
- `isRocket` → 라벨, `isFreeShipping`/배송 → `shipping_note`.
- 공개 뷰(`listing_prices_public`)는 `status='ok'`만 노출하므로 쿠팡 가격은 **기록되면 자동 렌더** — 뷰 변경 불필요.

### 1.5 컴플라이언스 (필수)
- **쿠팡 파트너스 고지 문구**(DESIGN §12) — 쿠팡 링크가 있는 페이지에 노출. 누락 금지.

---

## 2. 운영자 선결 (시트)
- 쿠팡 listing의 `url`을 현재 **공유 short-link → 제품 상세 URL**(`/vp/products/{id}`)로 교체.
- `affiliate_url`은 **비워둬도 됨**(시스템이 deeplink 생성). 기존 short-link를 affiliate_url로 옮겨도 무방.
- 이 교체 전에는 해당 listing이 §1.1 "제품 URL 필요" 데이터 오류로 표시됨(정상).

---

## 3. 레이트리밋 & 스케줄 메모
- 검색 10회/시 → 제품당 1콜, ~39개면 **풀 쿠팡 sync ≈ 4시간**(360s 간격). 다른 판매처 sync를 막지 않게 **쿠팡은 분리/비동기**로.
- 권장: deeplink는 1회 캐시(반복 비용 0), **가격은 느린 cadence/배치**(매일 전체 대신 분산 또는 격일 등) — 스케줄 자체는 별도 결정. 이번엔 **어댑터가 360s를 지키고, 풀 쿠팡 런이 길다는 점만 명시.**

---

## 4. 테스트 (fixture 단위)
- productId 추출: 정상 제품 URL / short-link(→데이터오류, fail_count 미증가) / 잘못된 URL.
- 검색 매칭: productId 일치 항목 채택, 불일치/부재 → `no_offer`(fail_count 0), API 오류 → `failed`(단계).
- deeplink: affiliate_url 비면 생성·캐시, 있으면 재생성 안 함.
- 고지 문구 렌더, isRocket/shipping 라벨.
- 기존 normalize/healthcheck/네이버/공개뷰 테스트 회귀 통과.
- 각 커밋 전 `lint && typecheck && test:all && build`.

---

## 5. 라이브 검증 (제한적, push 전)
- 제품 URL이 제대로 든 쿠팡 listing **2~3개**로(360s 간격) subset sync:
  - productId 매칭 → 가격 기록, isRocket/shipping 라벨, **공개 뷰에 렌더**.
  - deeplink 생성·캐시 확인.
  - short-link listing은 **데이터 오류로만 표시(fail_count 미증가·비활성 안 됨)**.
  - no_offer/failed 분류가 PR #14 규칙대로.
- 실 키 필요(`COUPANG_ACCESS_KEY/SECRET_KEY`). 시크릿 비노출.

---

## 6. 브랜치 & 커밋 (CLAUDE.md)
- 분기 `feature/coupang-adapter`(최신 main). main 직접 커밋·force push 금지.
- 커밋 단위:
  - `feat: extract coupang productId from product url; flag short-link as data error`
  - `feat: coupang partners search price match by productId`
  - `feat: generate and cache coupang deeplink when affiliate_url missing`
  - `feat: coupang outcome classification + 360s rate-limit spacing`
  - `feat: coupang partners disclosure notice`
  - `test: coupang adapter (productId match, no_offer, short-link, deeplink cache)`
  - `docs: worklog for coupang-adapter`
- 각 커밋 전후 `git diff --stat`/`git diff --check`/`git show --stat HEAD`. `docs/prompts/`·`tmp/`·시크릿 비커밋.
- 영어 PR(요약·이유·테스트결과 + 레이트리밋/스케줄 노트 + 운영자 선결) → CI green → `gh pr merge --merge --delete-branch`.
- worklog `docs/worklog/feature-coupang-adapter.md`.

---

## 7. Definition of Done
1. 쿠팡 가격이 **제품 URL의 productId로 정확 매칭**돼 기록되고, 공개 뷰/3사 비교에 렌더.
2. `affiliate_url` 없으면 **deeplink 자동생성+캐시**, 구매 버튼 정상.
3. short-link/ productId 부재는 **데이터 오류로 분류(fail_count 미증가·비활성 안 됨)**, 일일 요약 노출.
4. no_offer/failed가 PR #14 3-state 규칙 준수, 360s 간격 엄수.
5. 쿠팡 파트너스 고지 문구 노출. 테스트·빌드·CI 통과, worklog 작성, 시크릿 비노출.

---

## 8. 막히면
- productId 네임스페이스(URL vs 검색 API)가 안 맞거나 직접 조회 엔드포인트 유무가 불명확 → 파트너스 문서 확인 후 보고(추측 금지).
- 레이트리밋으로 풀 검증이 오래 걸리면 → 건수 줄이고 그 사실 명시.
- deeplink API 한도/실패·고지 문구 위치가 모호 → 옵션 보고 후 결정.
- 시트에 제품 URL이 아직 없으면(short-link만) → 운영자에게 URL 교체 요청, 그 전엔 데이터 오류 표시로 진행.
