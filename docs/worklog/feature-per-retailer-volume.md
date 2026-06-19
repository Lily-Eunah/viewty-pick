# feature/per-retailer-volume

## 목표
화장품은 같은 제품을 판매처마다 다른 ml로 파는 경우가 많다(네이버 100ml / 올리브영 80ml /
쿠팡 120ml…). 기존 trust-first 가정은 용량이 DB와 다르면 (a) 매처에서 **거부**하거나
(b) normalize에서 `unit_price=null` + warning으로 **보류**시켜, 다른 용량 판매처가 비교에서
빠지거나 검수 대기로 갔다.

**운영자 결정**: identity(같은 제품)만 통과하면 용량이 달라도 처리한다. 용량이 읽히면 그
용량으로, 안 읽히면 DB 용량으로 가정해 **ml당을 계산하고 자동 노출**한다. inspection 보류 없음.
(파싱 오류로 ml당이 틀릴 위험은 수용.) 안전성은 **전적으로 identity 게이트**에 의존한다.

## 변경 요약

### 1. 매처 — 용량차로 거부하지 않음 (`crawler/adapters/naver.ts`)
- `passesStrictIdentity`에서 `volume ${parsedVol}ml ≠ DB ${volumeMl}ml` 거부를 **제거**.
  identity 게이트(sim ≥ 0.6 + distinctive 토큰 + form conflict 없음 + 이종세트 아님)는 유지.
- `parsedVol`은 그대로 반환 → normalize로 전달되어 판매처 용량으로 ml당 계산.
- `chooseFallback`의 "용량 정확일치 우선" 정렬은 **유지**(같은 용량 후보가 있으면 우선,
  다른 용량을 버리지는 않음). OY 경로/공식몰/카탈로그 폴백은 원래 용량으로 거부하지 않음(무변경).
- 관련 reason 문자열·주석을 "identity/volume" → "identity"로 정리.

### 2. normalize — 용량차 = 불신 아님, 그 용량으로 ml당 (`crawler/core/normalize.ts`)
- parsed 용량(또는 title ext)이 DB와 달라도 막지 않음:
  - 용량이 **읽히면** `volume_ml = 파싱값`으로 `unit_price` 계산 + `unit_price_reliable = true`.
  - 용량이 **안 읽히면** `volume_ml = product.volume_ml`(가정)으로 계산 + reliable.
- `unit_price_reliable`에서 `volume_mismatch` 의존 제거. 이제 false가 되는 경우는
  **(a) DB 용량 미검증(`volume_verified=false`)이며 판매처 용량도 못 읽음**,
  **(b) 비앵커 매칭(`inspectionWarning`)** 둘뿐. 판매처 용량을 읽으면 미검증 DB라도 reliable.
- `volume_mismatch_detail`은 정보성 문자열로 강등("판매처 용량 100ml (DB 50ml와 다름)…").
  `volume_mismatch`는 `detail !== null`에서 파생(감사/로그용, 게이트 아님).

### 3. healthcheck — 용량차 warning 게이트 제거 (`crawler/core/healthcheck.ts`)
- Rule 5(volume mismatch → status=warning) 삭제. 이제 용량차는 `console.log` 정보성 로그만 남기고
  **status=ok**로 노출(가격 + ml당 유지).

### 4. 표시·랭킹 — 판매처별 용량 + ml당 기준
- DB/뷰: `0014_public_view_total_ml.sql` — public view에 `total_ml` 컬럼 추가(끝에 append,
  0011 컬럼 순서·필터·grant 유지). `PublicListingPrice.total_ml`, `UIStorePrice.volumeMl` 추가.
- `lib/queries/index.ts`:
  - 판매처별 per-unit 용량 = `total_ml / quantity` 도출 → `volumeMl`.
  - **랭킹**: 판매처별 용량이 다르고(priced 후보의 volume이 2개 이상) 모두 ml당이 있으면
    `unit_price`(ml당)로 정렬. 용량이 동일하면 기존 개당가 정렬과 결과 동일(무회귀).
  - **헤드라인 최저가**: 선택된 best 판매처의 개당가(₩) — 교차 제품 비교 가능성 유지
    (용량 다를 때 best = ml당 최저, 동일할 때 = 개당 최저). 기존 `min(perUnit)`과 동치(uniform).
- UI: `PriceTable`/`StorePriceCard`에 판매처별 `{volumeMl}ml` + ml당 표기. 제품 페이지
  (`app/p/[slug]/page.tsx`)에 용량이 다를 때 "판매처마다 용량이 달라요 · 최저가는 ml당 기준" 안내.

## 주요 변경 파일
- `crawler/adapters/naver.ts` — 매처 용량 거부 제거
- `crawler/core/normalize.ts` — per-retailer 용량으로 ml당 계산, mismatch 정보성 강등
- `crawler/core/healthcheck.ts` — 용량차 warning 게이트 제거
- `supabase/migrations/0014_public_view_total_ml.sql` — view에 total_ml
- `lib/types.ts` — `PublicListingPrice.total_ml`, `UIStorePrice.volumeMl`
- `lib/queries/index.ts` — 판매처별 용량 도출 + ml당 랭킹
- `components/product/PriceTable.tsx`, `StorePriceCard.tsx`, `app/p/[slug]/page.tsx` — 표시
- tests: `normalize.test.ts`, `healthcheck.test.ts` 갱신

## 테스트 결과
- `npm run test:all` — ALL PASSED (normalize/healthcheck 포함 전 스위트)
- `npm run typecheck` — pass
- `npm run lint` — 0 errors (pre-existing 무관 warning 1건)
- `npm run build` — success

핵심 회귀 확인:
- 용량 동일 판매처들 → 랭킹/최저가 기존과 동일(무회귀).
- 용량 다른 판매처(identity 통과) → 둘 다 노출, 각자 용량으로 ml당 reliable, 랭킹 ml당.
- identity 실패·이종세트·form conflict → 여전히 제외.
- 비앵커 매칭(inspectionWarning) → ml당 여전히 unreliable(무회귀).

## 남은 이슈 / TODO
- merge 후 **`crawler:sync`** 로 용량 다른 판매처가 ml당으로 비교·노출되는지 확인 → **`cf:deploy`**.
- DB: `0014` 마이그레이션을 prod에 적용해야 view에 `total_ml`이 노출됨.
- 리스크(정직히): 안전성은 identity 게이트에 의존. 용량 파싱 오류 시 ml당이 틀릴 수 있음
  (운영자 수용). `volume_mismatch_detail` 로그로 사후 점검 가능.
- 공식몰 대비(`discountVsOfficial`)는 여전히 개당가 기준 — 용량차 ml당 반영은 후속 과제.
