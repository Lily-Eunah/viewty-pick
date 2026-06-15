# Claude Code 작업 프롬프트 — 네이버 어댑터 API 복귀 + 데이터 모델 확정 (옵션 1, 최종)

> 목적: robots.txt로 막힌 네이버 **크롤 경로를 폐기**하고, 승인된 **쇼핑 검색 API**
> 기반 어댑터로 되돌린다. 동시에 공식몰 매칭·가격/링크 정합성·매칭 link 영속화를
> 포함한 **데이터 모델을 확정**한다. 이 프롬프트가 네이버 가격 수집의 최종 스펙이다.
>
> 베이스 브랜치: `feature/crawler-consolidation` (= pipeline-mvp 위에 절충안 통합본).

---

## 0. 배경 (확정된 사실 — 재논의·재조사 불필요)

- `brand.naver.com/robots.txt`는 `facebookexternalhit`만 허용, **`*` 및 AI 봇은 `Disallow: /`**. → Playwright 크롤은 정책상 불가(스푸핑은 평판·ToS·원칙상 배제). 어댑터의 크롤 거부는 정상 동작.
- 따라서 네이버 가격은 **승인된 쇼핑 검색 API**(`openapi.naver.com/v1/search/shop.json`)로 수집한다. storefront robots는 API에 적용되지 않는다.
- 현재 `feature/crawler-consolidation`의 `crawler/adapters/naver.ts`는 **Playwright 크롤러**다 → 이걸 **API 어댑터로 되돌린다**. (참고: `git show main:crawler/adapters/naver.ts`에 과거 검색 API 어댑터 구조 — `cleanQuery`/`extractNaverProductId`/`resolveNaverUrl` — 가 있으니 출발점으로 삼되, 아래 §2 매칭 모델로 강화한다.)
- 쿠팡 어댑터(HMAC Partners API + 360s)는 **그대로 유지**.

---

## 1. 확정된 결정 요약 (그대로 구현)

1. **네이버 = 쇼핑 검색 API.** 크롤 안 함.
2. **공식몰 식별 = mallName.** API 응답의 `mallName`을 `retailer_allowlist.allowed_store_name`(브랜드당 1회 수동 confirm)과 비교. mallName은 정규화 후 비교 + 브랜드명 포함 검사로 표기 변동에 견딤.
3. **개별 몰 상품만 채택.** 가격비교 묶음 대표상품(catalog)의 `lprice`는 전체 판매자 최저가(비공식 가능)라 **쓰지 않는다.** 공식 mallName에 매칭되는 개별 몰 상품 오퍼만 사용.
4. **가격·링크는 같은 오퍼에서.** 매칭한 공식몰 오퍼가 가격(`lprice`)과 `link`를 함께 제공 → 보이는 가격과 가는 곳이 일치.
5. **제품 동일성은 URL이 아니라 mallName+제목+용량으로 검증.** 검색 API productId와 브랜드스토어 URL productId는 네임스페이스가 달라 직접 대조 불가. URL 문자열 일치를 강제하지 않는다. (리다이렉트 풀어 productId 대조하는 하드닝은 MVP 범위 밖.)
6. **링크 우선순위(리다이렉트):** `affiliate_url`(쇼핑커넥트, 수동, 있으면) → 없으면 **API 매칭 link**.
7. **매칭 실패 시 비교 제외 + 검수 알림.** 공식 mallName 후보가 없거나 제목/용량 유사도 미달이면 가격을 노출하지 않는다. **리셀러로 폴백 금지.**
8. **데이터 입력 모델:**
   - 수동: 브랜드당 공식 mallName(`retailer_allowlist.allowed_store_name`) + 제품별 `affiliate_url`(쇼핑커넥트, 있으면).
   - 자동 저장: API 매칭 `link`·`mallName`을 스냅샷마다 기록 + listings에 최신 매칭 link 캐시.
   - 공식 브랜드스토어 URL의 **제품별 필수 입력은 폐지**(원하면 사람 확인용 참고 필드로만).
9. **용량 = §4 절충안 + §1b 감사.** API에 용량 없음 → 제목 파싱 best-effort + 운영자 검증.
10. **프로모션** = API에 구조 데이터 없음 → 제목 토큰(`packageExtractor`) best-effort, 중요 품목은 `manual_overrides`로 주입.

---

## 2. 네이버 어댑터 구현 (`crawler/adapters/naver.ts`)

크롤 코드(`chromium`·셀렉터·robots 크롤 로직) 제거하고 API 어댑터로 재작성. 순수 매칭 함수를 분리해 테스트 가능하게 한다(예: `pickOfficialOffer(results, {brand, name, volumeMl, allowedStoreName})`).

**매칭 알고리즘:**
1. 쿼리: `cleanQuery(brand, name)` (브랜드 + 정규화 제품명).
2. `GET /v1/search/shop.json?query=...&display=40` (헤더에 `X-Naver-Client-Id/Secret`).
3. 후보 필터:
   - (a) **개별 몰 상품만** — 가격비교 묶음 대표상품 제외. `productType` 코드의 정확한 의미는 **구현 시점 네이버 공식 문서로 확인**하고 주석에 근거를 남긴다.
   - (b) **공식몰**: `normalize(result.mallName)` 이 `allowed_store_name`과 일치, 또는 (allowlist 미등록 시) 브랜드명을 포함. 정규화 = 공백 제거·소문자·`공식/공식몰/스토어` 접미사 정리.
   - (c) **같은 제품**: 제목 + 용량 토큰 유사도 임계 통과(`packageExtractor` 활용).
4. 채택: 조건 모두 만족 후보 중 **상위 랭크 1개**. 그 오퍼에서 `lprice`(가격), `link`, `mallName`, `productId`(검색 네임스페이스) 추출.
5. 실패(후보 0개·유사도 미달): `PriceOffer`를 **비교 제외 + 검수 플래그**로 반환(가격 노출 안 함).

**PriceOffer → normalize 연결:** 가격은 `normalize.ts`로(base/effective/unit_price). 프로모션은 제목 토큰 best-effort, 불확실 시 절충안 처리. 용량은 §1b 게이트.

**robots/예의:** 검색 API에는 storefront robots 미적용이나, 호출 빈도는 일 1회 배치 + 적정 간격 유지. 쿼리당 1콜, 일 25,000콜 한도 내.

---

## 3. 데이터 모델 / 스키마 변경 (마이그레이션 `0006_naver_api_matching.sql`)

- `retailer_allowlist.allowed_store_name` — **공식 mallName 앵커. 이미 존재** → 그대로 사용(스키마 변경 없음). 시드/시트에 브랜드당 공식 mallName을 채우는 절차만 추가.
- `price_snapshots` — **추가**: `matched_url text null`, `matched_mall_name text null`. 스냅샷마다 어떤 오퍼를 매칭했는지 기록(감사·변경 감지용).
- `listings` — **추가**: `latest_matched_url text null`. 최신 매칭 link 캐시. `/go/[listingId]` 리다이렉트가 `affiliate_url → latest_matched_url` 순으로 참조.
- 기존 `listings.url`(과거 크롤 대상 브랜드스토어 URL): **의미 재정의** — 이제 "사람 확인용 참고/매칭 힌트(선택)". 필수 아님. 시트의 제품별 URL 입력 칸은 선택으로 강등.
- `unit_price_reliable`(절충안용)·`products.volume_verified`(§1b용)는 이미 마이그레이션 0005에 존재한다고 보고됨 → 재사용. (없으면 0006에 포함.)

**리다이렉트 로직(`app/go/[listingId]/route.ts`)**: `affiliate_url` 있으면 그걸로 302, 없으면 `latest_matched_url`, 둘 다 없으면 버튼 비노출(클릭 집계는 기존대로 `affiliate_clicks`).

---

## 4. 용량 불일치 정책 — 절충안 (이미 통합됨, 유지·검증)

`feature/crawler-consolidation`에 통합된 절충안을 유지한다:
- 용량 불일치/미검증 시 **가격(base/effective)은 노출·비교**, `unit_price=null` + `unit_price_reliable=false`로 **ml당 정렬·Viewty Score ml항목·랭킹에서만 제외**. 가격의 `parse_confidence`는 `high` 유지. `volume_mismatch` 플래그 + 검수 큐 기록.

### §1b 용량 감사 (선결 과제)
라이브 Supabase의 `products.volume_ml`이 LLM 시드로 다수 50ml 고정(신뢰 불가). API엔 용량이 없으니, **제목 파싱으로 용량 감사 리포트**를 만든다: `product | brand | DB volume_ml | 제목 추출 용량 | 출처 | 제안 정정값 | 신뢰도`. 제목에 용량 없으면 "수동 확인 필요". **DB·시트 직접 수정 금지** → 운영자 승인 후 시트 반영 → `sheets:import`. 검증된 용량은 `volume_verified=true`로 표식, 미검증은 §4에 따라 ml 비교 자동 제외.

---

## 5. 다른 판매처 robots.txt 점검 (중요 — 크롤 전제 재검증)

올리브영(`oy.run` → oliveyoung 도메인)·지그재그·에이블리는 **Playwright 크롤**이다. 네이버처럼 막혔을 수 있으니 **실제 크롤 대상 호스트의 robots.txt를 점검**한다(원문 + `*` 규칙 + 대상 경로 매칭 여부를 출력).
- 특히 **올리브영은 #1 판매처** — `*` Disallow면 크롤 대신 대안 필요(공개 가격 API 부재 → `manual_overrides` 또는 정보 링크 강등 등). **단독 결정 금지, 점검 결과를 운영자에게 보고**하고 옵션 제시.
- 점검만 하고 정책 변경은 승인 후. 네이버에서 배운 교훈: robots는 user-agent별로 다르니 원문을 보고 판단.

---

## 6. 라이브 검증

- **네이버(이제 가능)**: API 경로라 robots 블록 없음. `scripts/live-check/live-check-naver.ts`를 **API 매칭 검증**으로 갱신 — listings의 네이버 제품별로 §2 매칭 실행 → 매칭된 `mallName`/가격/`link`, 공식몰 일치 여부, 비교 제외 케이스를 표로. 검색-API productId 미스매칭이 사라졌음을 명시.
- **쿠팡**: `live-check:coupang` (실 키 필요, 360s 간격, ≤3건).
- 라이브 검증은 CI 단위 테스트와 분리(네트워크·실키 의존). 시크릿·개인정보 비커밋.

---

## 7. 테스트 (fixture 단위)

- `pickOfficialOffer` 매칭: mallName 정규화/브랜드 포함, **개별몰 vs 묶음 대표상품 필터**, 공식몰 후보 없음→비교 제외, 가격·link 동일 오퍼에서 추출, 제목/용량 유사도 게이트.
- 링크 우선순위: affiliate_url > latest_matched_url > 비노출.
- normalize 절충안: 용량 불일치 시 base 유지·unit_price null·parse_confidence high.
- 기존 coupang/normalize/healthcheck 테스트 회귀 통과.
- 각 커밋 전 `npm run lint && npm run typecheck && npm run build` + `test:all` 통과.

---

## 8. 작업 규칙 (CLAUDE.md)

- 베이스 `feature/crawler-consolidation`에서 이어가거나 `feature/naver-api-adapter` 분기. `main` 직접 커밋·force push·원격 push 금지(승인 전).
- Conventional Commits, 의미 단위 분리. 예: `feat: revert naver adapter to shopping search api`, `feat: official-mall matching via allowlist mallName`, `feat: persist matched url + redirect fallback`, `feat(db): 0006 naver api matching fields`.
- 파일 무결성: 커밋 전 `git diff --stat`/`git diff --check`, 커밋 후 `git show --stat HEAD`.
- 시크릿(NAVER_CLIENT_ID/SECRET 등)·개인정보 비노출.
- worklog 갱신: `docs/worklog/feature-crawler-consolidation.md`(또는 새 브랜치 worklog).

---

## 9. Definition of Done

1. `naver.ts`가 **쇼핑 검색 API 어댑터**로 복귀(크롤 코드 제거), `pickOfficialOffer` 순수 함수 분리.
2. 매칭이 §2대로: 개별몰 상품만, 공식 mallName(allowlist) 매칭, 제목/용량 검증, 실패 시 비교 제외(리셀러 폴백 없음).
3. 가격·`link`가 **같은 오퍼**에서 나오고, 리다이렉트가 `affiliate_url → latest_matched_url` 우선순위로 동작.
4. 마이그레이션 0006: `price_snapshots.matched_url/matched_mall_name`, `listings.latest_matched_url` 추가. `retailer_allowlist.allowed_store_name`는 mallName 앵커로 사용.
5. 절충안 유지 + §1b **용량 감사 리포트** 제출(DB 직접 수정 없음).
6. 올영/지그재그/에이블리 **robots.txt 점검 결과** 보고 + 대안 옵션 제시(정책 변경은 승인 후).
7. 네이버 API 라이브 검증 표(매칭 결과·제외 케이스) + 쿠팡(키 있으면) 결과. 빌드·타입·린트·단위테스트 통과, worklog 갱신, 시크릿 비노출.

---

## 10. 막히면

- `productType` 코드 의미가 불명확하면 네이버 공식 문서 확인 후 진행(추측 금지). 못 정하면 보고.
- 공식몰이 검색 결과에 안 뜨거나 mallName이 많이 다른 브랜드: 해당 제품 비교 제외 + 검수 큐에 남기고, allowlist 보강을 운영자에게 요청.
- 올영 등 robots가 막혀 있으면: 크롤 중단, 대안(메뉴얼/정보 링크) 옵션과 함께 운영자 결정 요청.
- 스키마 변경이 0006 외 추가로 필요하면 멈추고 보고.
