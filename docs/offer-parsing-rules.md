# 판매처 Offer 파싱·앵커·검증 규칙 (전체)

> 크롤러가 판매처(네이버 / 쿠팡 / 올리브영) offer를 **어떻게 찾고(앵커) → 같은 제품인지 판단하고 → 용량·개수를 읽고 → 정상 데이터인지 검증하는지**를 코드 기준으로 정리한 레퍼런스.
> 관련 코드: `crawler/adapters/{naver,coupang,oliveyoung}.ts`, `crawler/core/{packageExtractor,normalize,healthcheck,routeNoOffer}.ts`, `crawler/adapters/index.ts`.
> 작성 시점 기준이며, 코드 변경 시 갱신한다.

---

## 0. 파이프라인 한눈에 보기

```
listing(시트 URL) ─► adapter.fetchOffer() ─► PriceOffer
                          │  (앵커 + 식별 + 제목 파싱)
                          ▼
                    applyManualOverrides()        ← 운영자 수동가/플래그
                          ▼
                    normalizePrice()              ← 용량·개수→수량·ml당 단가 계산
                          ▼
                    runHealthCheck()              ← 정상 데이터 판정(ok/warning/failed)
                          ▼
           ┌──────────────┴───────────────┐
        outcome=ok                outcome=no_offer/data_error
        (가격 노출)               routeNoOffer() → inspection O/X | link_only 탭
```

핵심 원칙(공통):
- **앵커 = 같은 SKU 고정.** 가능하면 링크의 식별자(네이버 `/products/{N}`, 쿠팡 `productId`)로 큐레이션 제품과 정확히 일치시킨다.
- **가격과 구매링크는 같은 offer에서** 나온다(가격주체 ≠ 링크주체 방지).
- **신뢰 우선(trust-first):** 틀린 가격을 보여주느니 가격을 비우고 검수로 보낸다.
- **증정/사은품/샘플**은 본품 용량·수량에 포함하지 않는다. **본품 추가구성(리필/동일제품 +N)** 은 포함한다.
- **판매처별 용량이 다를 수 있다**(네이버 100ml / 올리브영 80ml). 용량 불일치는 더 이상 reject 게이트가 아니며, 그 판매처 용량으로 ml당을 계산한다.

---

## 1. PriceOffer 와 outcome (어댑터 공통 출력)

어댑터는 `PriceOffer`(`adapters/index.ts`)를 반환한다. 핵심 필드:

| 필드 | 의미 |
|------|------|
| `salePrice` / `regularPrice` | 판매가 / 정가(없으면 null) |
| `sourceText` | 매칭된 offer 제목 등 — **normalize가 용량·개수 재파싱에 사용** |
| `parsedVolumeRaw` | 제목에서 읽은 ml(있으면 normalize가 우선 사용) |
| `matchedUrl` / `matchedMallName` | 매칭 offer의 링크 / mallName |
| `matchExcluded` | 공식몰/앵커 매칭 실패 → 비교 제외 |
| `inspectionWarning` | 비앵커 폴백 등 식별 미검증 → healthcheck가 warning 강제 |
| `needsInspection` (+`inspectionEstimatedPrice`) | 세트/저신뢰 의심 → inspection O/X 탭으로 |
| `nJongVerify` | 가격은 노출하되 Discord에 "N종 옵션선택?" 확인 라인 |
| `outcome` | `ok` / `no_offer` / `data_error` / `failed` |

**outcome 의미 (fail_count 와 직결):**
- `ok` — 자격 있는 offer 매칭·가격 산출.
- `no_offer` — fetch는 성공했으나 자격 offer 없음(미판매/공식몰 없음/link-only). **실패 아님 → fail_count 리셋.**
- `data_error` — listing 데이터 자체가 불량(예: 쿠팡 공유 short-link, productId 없음). API 호출조차 안 함. **운영자가 시트 URL 수정** 대상.
- `failed` — HTTP 오류/타임아웃/차단/파싱 실패. **이것만** §4.4 staircase(fail_count) 누적.

---

## 2. 판매처별 Offer 처리 & 앵커링

### 2-1. 네이버 (`naver.ts` — `NaverAdapter.fetchOffer`)

**WHY API:** `brand.naver.com/robots.txt` 가 전면 Disallow + 직접 크롤은 429 차단 → 승인 경로인 **Shopping Search API**(`/v1/search/shop.json`, display=100)만 사용.

검색 쿼리는 `buildAnchorQueries`로 넓게→좁게 3종(브랜드+풀네임 / 브랜드+첫토큰 / 브랜드+form noun). 결과는 per-process 캐시(`naverSearchCache`).

**Tier 구조 (`matchNaverOffer`):**

| Tier | 방법 | 신뢰 | 처리 |
|------|------|------|------|
| **1 앵커** | 큐레이션 URL의 `/products/{N}` ↔ 결과 link의 N 일치 (`pickAnchoredOffer`) | 최상(정확 SKU) | 단품/동종번들=가격, 이종세트=검수 |
| **2 공식스토어 폴백** | 앵커 미스 시 mallName이 브랜드 whole-word 일치하는 네이버 호스팅 스토어 (`pickOfficialStoreFallback`) | 중(비앵커) | **항상 warning(검수)**, 비-어필리에이트면 구매링크를 공식몰로 교체 |
| **3 가격비교 catalog 폴백** | 공식스토어 없을 때 `/catalog/` lprice (`pickCatalogFallback`) | 하(리셀러 가능) | **항상 warning(임시)** |
| **4 link-only** | 위 모두 실패 | — | 가격 비움, link_only |

- **앵커 N 해석:** `resolveCuratedProductNo` — `brand.naver.com`/smartstore는 URL에 직접, `naver.me` 단축링크는 리다이렉트 1회(캐시, 전체 80회 상한 `MAX_REDIRECT_RESOLVES`).
- **앵커가 이종세트로 보일 때(`pickAnchoredOffer`, ext.heterogeneous):** 운영자가 직접 링크했으므로 link_only로 버리지 않고 →
  (a) **본품+소량 부스트**(`stripMinorAddOn`): 본품(DB 용량) 외 모든 용량이 더 작으면 본품 기준 자동가, Discord verify.
  (b) **본품+증정**(`priceGiftBundleOnMain`): 본품 식별되면 번들가 전액을 본품에 귀속, inspection 프리필.
  (c) 본품 식별 불가(진짜 다중-main) → inspection(앵커가격 힌트).
- **앵커지만 용량 없는 동종번들**(본품+리필/1+1, 단위 ml 없음, `homogeneousBundleQty`): lprice는 번들가이므로 inspection(`lprice/qty` 본품 추정).
- 폴백 가격/링크 규칙은 `fallbackPolicy` (A2 공식+어필리에이트=링크유지·warning / B2 공식+비어필리에이트=링크교체·no warn / catalog=링크유지·warning).

### 2-2. 쿠팡 (`coupang.ts` — `CoupangAdapter.fetchOffer`)

**WHY 검색 API:** 가격 단건 조회 엔드포인트 없음(404) → Partners **검색 API**(keyword=브랜드+제품명, limit=10, 50/min 제한·`MIN_CALL_INTERVAL_MS`=2000ms). HMAC-SHA256 서명(`yyMMdd'T'HHmmss'Z'`).

**앵커 = productId 정확 일치 (`pickCoupangMatch`):**
1. listing URL에서 `productId` 추출(`extractCoupangProductId`, `/vp/products/{id}`). 없으면 → `data_error`(공유 short-link 등, API 미호출).
2. 검색 결과 중 **같은 productId** 행만 필터. 한 제품 페이지가 1개/묶음/벌크 옵션을 여러 행으로 노출하므로 → **그중 최저가**(=기본 단품)를 선택.
3. productId가 결과에 없으면(미노출/품절) → `no_offer`(link-only). fail_count 누적 안 함.

- 가격: `productPrice`(없으면 legacy `price`), 정가 `basePrice`. **쿠폰가는 conditional → 비교 제외, 라벨만**(`promoType='coupon'`).
- 용량: `extractVolumeFromTitle`(ml 또는 L→ml). 로켓/무료배송은 `shippingNote` 라벨.
- **이미지 폴백**(`pickCoupangImage`): 앵커 productId 이미지 → 없으면 `passesImageIdentity`(브랜드 필수 + 유사도≥0.6 + core token + form 불일치 없음, **용량/세트구성은 무시**) 통과한 동일제품 이미지. 다른 브랜드/제품 사진 유입 차단.

### 2-3. 올리브영 (`oliveyoung.ts` — `OliveYoungAdapter.fetchOffer`)

**WHY 크롤 안 함:** `oliveyoung.co.kr` robots 전면 Disallow + WAF 403 + 공개 가격 API 없음 → 유일한 합법 경로는 **네이버 Shopping API에 올라온 올리브영 판매처 offer**(mallName='올리브영')를 읽는 것. oliveyoung.co.kr에 직접 요청하지 않는다.

**4-tier 노출 게이트 (`resolveOliveYoungTier`):**

| tier | 조건 | 결과 |
|------|------|------|
| 1 hidden | 큐레이터 affiliate_url 없음 | 행 미노출(올영 미판매로 간주) |
| 2 naver | affiliate_url + 네이버 올영 offer | 가격=네이버, 링크=큐레이터 |
| 3 manual | affiliate_url + offer 없음 + 수동가 | 가격=수동, 링크=큐레이터 |
| 4 link_only | affiliate_url + offer·수동가 없음 | 링크만 |

**매칭 (`matchOliveYoungOffer` → `pickOliveYoungOffer`) — ⚠️ 느슨함(앵커 없음):**
- oy.run 링크에는 앵커할 N이 없어 **제목 유사도로만** 선택. (네이버 Tier-1 같은 SKU 고정이 없음.)
- 검색 쿼리에 `+ 올리브영` 을 더해 올영 판매처 노출률을 높임(필터는 여전히 mallName).
- 후보 점수: **증정-스트립한 제목**(`stripPromoGifts`)으로 `productIdentityScore`. form 불일치(`hasFormConflict`) 제거.
- 밴드:
  - **자동가(Tier 2):** 유사도 ≥ `OY_AUTO_PRICE_SIMILARITY`(0.6) **AND distinctive core token 1개 이상** 존재 AND 이종세트 아님 → 채택. 복수면 **단품 라벨 우선 → 가격 outlier 제거 → 동일제품명 후보 중 최저가**.
  - **보류+검수(Tier 3 후보):** 유사도 ≥ `OY_MIN_SIMILARITY`(0.4)지만 밴드 미만/core token 없음/이종세트/모호 → `needsInspection`(가격 힌트 포함, 단 세트가는 blank).
  - **offer 없음(Tier 4):** 0.4 미만 → link_only.
- 용량 없는 동종번들(본품+리필 등) → inspection(`lprice/bundleQty` 추정). 가격주체 검증 위해 `containsBareNJong` → Discord verify.

> **⚠️ 알려진 약점(2-3):** 앵커가 없어 형제 변종(같은 라인 다른 호수/타입)이 채택될 수 있다. 8절 G4 참조.

---

## 3. 제목 용량/개수 파싱 (`packageExtractor.ts`)

normalize/어댑터가 제목에서 **용량(ml/g/매)·개수·구성**을 읽는 핵심 모듈. 위에서부터 **먼저 매칭되는 규칙**이 채택된다.

### 3-1. 증정/구성 분리 — `stripPromoGifts` (파싱 전처리)
- **제거(증정으로 간주):**
  - 괄호 `( … )` 안에 증정류(`증정/사은품/샘플/미니/트래블/여행용/파우치/키트/쇼핑백/덤/마스크` 또는 `+`)가 있으면 제거. **단 괄호 안에 `리필/본품`이 있으면 유지**(추가 구성).
  - `+` 로 시작하는 증정 꼬리(`+ … 증정/사은품/샘플/기프트`).
  - `+` 뒤 명명된 사은품(`+ 여행용/미니/트래블/파우치/키트/쇼핑백 …`).
- **유지(본품 구성):** `리필`, `본품+`, 동일용량 `A+A`.
- 이어서 `cleanTitleText` 가 `SPF\d+`, `PA++`, 연도(`20xx`), 6자리+ 숫자(바코드/ID)를 제거.

> **⚠️ 한계:** 정규식이 **소괄호 `()` 만** 처리한다. **대괄호 `[ … ]` 안의 증정/기획 문구는 제거되지 않는다.** 또 `+` 가 없는 `"퍼프 3매 추가 증정"` 같은 꼬리도 제거 못 한다 → 8절 G3.

### 3-2. 파싱 규칙 우선순위

| # | 패턴 | 예 | 결과 | heterogeneous |
|---|------|-----|------|:---:|
| 1 | `A+B`(ml/g) additive | `50ml+50ml` | 동일→번들×2 합산 / 배수+개수신호→동종멀티팩 / 그 외→**이종세트** | 그 외 시 ✔ |
| 1b | 리필·본품+ | `265ml 본품+리필` | 동일제품 ×2 (count=2, **고정**) | |
| 1c | `N+N`(단위없음 가능) | `1+1`, `2+1` | x+y개. ml 있으면 unitAmount 동반 | |
| 1d | 더블기획/팩/구성 | `더블기획` | ×2 (단 `대용량` 제외) | |
| 2 | 시트+용량 | `25ml, 10매입` | sheet, 매수=10, unitAmount=용량 | |
| 3 | 용량×N | `60ml x 2` | ×N | |
| 4 | 용량+개수 | `60ml 2개입` | ×N | |
| 5 | 시트(매)만 | `패드 70매` | sheet, 매수=N, **unitAmount=null** | |
| 5b | 이종세트 신호 | `토너100ml+세럼30ml`, 세트/패키지/콜렉션/기프트, 디바이스/기기 | 비교 제외+검수 | ✔ |
| 6 | 단일 용량 | `60ml` | 단일(count=1) | |

**개수/용량 유효범위:** 용량 1~1000(ml/g), 개수 1~20, 시트 1~300. 벗어나면 무시.

### 3-3. 세트 vs 단품 판정에 쓰는 보조 규칙
- **N종:** **단독 "N종"은 'N종 중 택1' 옵션선택(=단품)** 으로 본다. 세트로 보는 건 **명시적 세트 compound**(`SET_COMPOUND_RE` = 세트/패키지/콜렉션/컬렉션/기프트, 또는 `N종 세트/구성/기획/패키지…`)가 붙을 때뿐. `isBareNJong`/`containsBareNJong` → Discord verify.
- **동종 멀티팩(`homogeneousMultipackUnit`):** 서로 다른 용량이 **최소단위의 정수배 AND 개수/×N 신호** 동반 → 같은 제품의 큰 묶음(per-unit 계산). 비배수면 이종세트로.
- **form 충돌(`hasFormConflict`):** 큐레이션명의 form noun(쿠션/크림/세럼/토너 …)이 후보 제목에 없고 후보가 다른 form noun을 가지면 → 같은 라인 다른 제형 → 제외.
- **distinctive token(`distinctiveTokens`):** significant token에서 form noun + promo word(증정/기획/단독/본품/세트 …) 제거. **최소 1개**가 제목에 있어야 자동가(약점은 8절 G4).

---

## 4. 정규화 (`normalize.ts` — `normalizePrice`)

### 4-1. 수동 오버라이드 (`applyManualOverrides`)
활성 override(price/promo_type/promo_text/in_stock)를 offer에 선반영. **price override**는 `matchExcluded`·`inspectionWarning` 해제 + `outcome='ok'` 승격(검수 O 승인과 동일).

### 4-2. 개수→수량 (promo math)
- `buy_x_get_y` + promo_text: `x+y` → paid=x, free=y, total=x+y, effective=가격×x/(x+y). 1+1가 > 기본가면 `parse_confidence=low`.
- `quantity_discount`: `N개 … M%` → effective = 할인 적용 단가.
- `promo='none'` + promo_text 없음 + sourceText 있음: **`extractPackageFromTitle(sourceText)`로 수량 도출** — `confidence='high'`이고 count 1~20, amount(null 또는 1~1000)면 → `total_quantity=unitCount`, `effective_unit_price = 가격 / unitCount`.

> ⚠️ 여기서 sourceText 는 **매칭된 판매처 offer 제목**(예: `Naver-sourced OliveYoung offer: <제목>`)이다. 잘못 매칭된 제목/증정 문구가 그대로 수량에 반영된다 → 8절 G3/G4.

### 4-3. 용량 결정 순서 (판매처별 용량 허용)
1. `offer.parsedVolumeRaw`(어댑터가 제목에서 읽은 ml) → 사용.
2. 없고 promo가 bundle/none이면 `extractPackageFromTitle(sourceText)`의 `unitAmount`(있을 때).
3. 둘 다 없으면 **DB `product.volume_ml`**(없으면 50 기본).

- DB와 다른 용량이어도 **mismatch는 정보용 audit 문자열**일 뿐, 가격/단가를 막지 않는다.
- `total_ml = volume_ml × total_quantity`.

### 4-4. ml당 단가 & 신뢰도
- `unit_price = effective_unit_price / volume_ml`(소수 4자리).
- `unit_price_reliable=false` 인 경우(=ml당 null):
  - DB 용량이 **미검증**(`volume_verified===false`)이고 listing에서 용량을 못 읽은 경우.
  - **비앵커 폴백 매칭**(`offer.inspectionWarning` 존재) → SKU 식별 미검증.
  - 이때도 **가격 자체는 노출/비교 가능**(ml당만 보류).

---

## 5. 정상 데이터 판정 (`healthcheck.ts` — `runHealthCheck`)

위에서부터 먼저 걸리는 규칙으로 status 결정:

| 규칙 | 조건 | status / severity |
|------|------|-------------------|
| 1 | sale_price 없음 | **failed** / warning (Rule 1: 비교 제외) |
| 2 | sale_price < 1,000원 | **failed** / critical (파싱오류 의심) |
| 3 | 정가 < 판매가 | **failed** / warning |
| 4 | effective > base (예: 1+1가 > 기본가) | **failed** / warning |
| 4b | `inspectionWarning` 존재(비앵커 폴백) | **warning** / warning |
| (정보) | 용량 mismatch | 로그만, 게이트 아님 |
| 6 | `parse_confidence=low` | **warning** / info (비교 제외) |
| 7 | 네이버 allowlist 밖 storeName | **failed** / warning |
| 8 | 직전 스냅샷 대비 ±50% 변동 | **warning** / warning |
| — | 위 모두 통과 | **ok** |

**outcome → fail_count (`resolveListingOutcome`):** `failed`만 staircase(`handleConsecutiveFailures`): 1=이전가 사용, 2=알림+이전가, 3=비활성화+알림, 5+=알림. `ok/no_offer/data_error`는 streak 0 리셋·비활성화 없음.

---

## 6. 가격 없는 결과 라우팅 (`routeNoOffer.ts`)

`no_offer`/`data_error`로 가격이 없을 때 운영자 후속 탭으로 배분(상호 배타):
- `no_offer` + `needsInspection` → **inspection O/X 탭**. 단품이면 가격 확인 후 O → 다음 sync에 노출. 힌트가 blank면 운영자가 입력.
- 그 외(앵커미스+폴백없음, 쿠팡 검색 미스, data_error 등) → **link_only 탭**(`classifyLinkOnly`로 cause/action 분류, 운영자가 URL/단품 수정).

---

## 7. "같은 제품인가?" 판정 요약 (식별 게이트 비교)

| 판매처 | 1차 앵커 | 2차 식별 게이트 | 용량 | 세트/번들 |
|--------|----------|-----------------|------|-----------|
| 네이버 | **링크 `/products/{N}`** | (앵커 성공 시 식별 신뢰 1.0) / 폴백은 strict(유사도≥0.6 + core token + form OK + 세트 아님) | 비차단(판매처 용량 사용) | 단품·동종번들=가격, 이종=검수 |
| 쿠팡 | **링크 `productId`** | (앵커 일치면 동일 제품) | 비차단 | 같은 productId 중 최저가(단품) |
| 올리브영 | **없음(oy.run)** | 느슨: 유사도≥0.6 + core token 1개 + form OK + 세트 아님 | 비차단 | 단품=가격, 모호/세트=검수 |

---

## 8. 알려진 갭 / 주의 (개선 후보)

| # | 갭 | 현재 동작 | 기대 |
|---|----|-----------|------|
| G1 | 시트(매) 용량 일관성 | case 5는 `unitAmount=null` → normalize에서 용량 미적용(어댑터 parsedVolume 의존) | 매 제품도 제목 매수를 일관 사용 |
| G2 | 동일제품 비배수 additive 합산 | `75ml+35ml`(같은 제품) → 이종세트 제외 | 같은 제품이면 110ml 합산 |
| G3 | **증정 문구 누수(개수 오독)** | `stripPromoGifts`가 **대괄호 `[…증정…]`** 와 `+` 없는 `"퍼프 3매 추가 증정"` 를 못 떼어내 → case 5가 `3매`를 **개수 3**으로 오독(예: `[…퍼프 3매 추가 증정 기획] … 쿠션 15.8g` → 수량 3, ml당 1/3) | 대괄호·비-`+` 증정절도 strip하여 본품 개수에서 분리 |
| G4 | **올리브영 형제 변종 오매칭** | 앵커 없음 + core token **1개만** 요구 → `비 벨벳 커버 쿠션` 검색에 `비벨벳 세범컷 쿨링 쿠션`(토큰 3/4=0.75, `벨벳` 1개로 통과)이 채택됨 | (a) goodsNo 앵커(oy.run→goodsNo ↔ 네이버 offer 링크→goodsNo) (b) 변별 토큰(`커버`) 누락 시 충돌 처리 |

> **goodsNo 앵커 메모(G4 근본책):** oy.run 단축링크는 200 OK로 deeplink HTML을 주고 그 안에 `oliveyoung.co.kr/.../getGoodsDetail.do?goodsNo=A000000XXXXXX` 가 박혀 있어 **WAF 페이지 크롤 없이 goodsNo 추출 가능**(검증됨). 네이버 올영 offer 링크 → goodsNo 해석 가능 여부만 확인되면 네이버 Tier-1(`/products/{N}`)과 동일한 정확 SKU 앵커를 올리브영에도 적용할 수 있다.
