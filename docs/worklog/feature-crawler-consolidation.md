# Worklog — feature/crawler-consolidation

크롤러 브랜치 통합 + §1 용량 정책 단일화 + 크롤 경로 라이브 재검증 시도.
작업 베이스: `feature/pipeline-mvp`에서 분기한 `feature/crawler-consolidation`.

---

## 0. 베이스 진단 정정 (증빙)

프롬프트 진단은 "세 브랜치 모두 main에서 분기"였으나, 실제 git 그래프는 다르다:

- `feature/pipeline-mvp`(b356e4f)는 **`feature/package-title-extractor`(979b7eb) 위에 직접 적층**.
  `git merge-base --is-ancestor feature/package-title-extractor feature/pipeline-mvp` → **YES**.
  → pipeline-mvp ⊇ package-title-extractor. `packageExtractor.ts`까지 이미 포함, 가져올 게 없음.
- `git merge-base feature/pipeline-mvp main` = `17414bf` = **main의 tip** → pipeline-mvp는 이미 main 최신 상태. **rebase/merge 불필요**.
- 따라서 "통합"은 git상 자명: pipeline-mvp가 이미 통합 베이스. package-title-extractor 대비 유일한 실질 차이는 `normalize.ts`이며, §1 결정대로 pipeline-mvp normalize를 정본으로 채택(아래 §1 절충 게이트 적용).

### 구현 경로 증빙 (DoD #1)

| 파일 | 증빙 | 결과 |
|---|---|---|
| `crawler/adapters/naver.ts` (pipeline-mvp) | `import { chromium } from 'playwright'`, `page.goto(url)`, robots.txt 확인 | **Playwright 브랜드스토어 크롤** |
| | `grep shop.json\|openapi.naver` → 없음 | 검색 API 호출 **없음** |
| `crawler/adapters/naver.ts` (package-title-extractor) | `openapi.naver.com/v1/search/shop.json` | 검색 API (구버전, 폐기) |
| `crawler/adapters/coupang.ts` | `crypto.createHmac('sha256', …)`, `CEA algorithm=HmacSHA256`, `MIN_CALL_INTERVAL_MS=360000` | **HMAC 서명 + 360s 레이트리밋** |

→ 통합 베이스의 naver 어댑터는 크롤 경로이며, 검색 API productId 미스매칭 문제는 코드에서 사라짐.

---

## 1. 용량 불일치 정책 — §1 절충안 단일화 (DoD #2)

`commit: feat: unify volume-mismatch policy to §1 compromise`

원칙: **가격은 실재하므로 게이트하지 않는다. 용량이 불확실하면 ml당 계산만 비활성화한다.**

| 항목 | 변경 전 (pipeline-mvp 강한 게이트) | 변경 후 (§1 절충) |
|---|---|---|
| `parse_confidence` (용량 불일치 시) | `low` (가격까지 비교 제외) | **`high` 유지** (가격 정상이면 게이트 안 함) |
| `base_unit_price` / `effective_unit_price` | 그대로 | **그대로 노출·비교** |
| `unit_price` (ml당) | 그대로 계산 | **`null`** |
| `unit_price_reliable` (신규) | — | **`false`** (불일치/미검증 시) |
| healthcheck `volume_mismatch` | `status='failed'` (가격 드랍/이전가 사용) | **`status='warning'`** (검수 큐, 가격 유지) |

변경 파일:
- `crawler/core/normalize.ts` — `unit_price_reliable` 필드 추가, 불일치 시 `parse_confidence='low'` 강제 제거, `volume_mismatch` 또는 `volume_verified===false`일 때만 `unit_price=null`.
- `crawler/core/healthcheck.ts` — Rule 5(volume mismatch) `failed`→`warning`로 강등(검수 큐 라우팅, 가격 비게이트).
- `crawler/run.ts`, `crawler/core/score.ts` — 가격 정상인 용량불일치 행(`unit_price_reliable===false`)을 base/effective 비교에 **포함**. ml 랭킹/Score ml항목은 `unit_price=null`로 자동 제외(score.ts는 `unit_price!==null` 필터 사용 → 변경 불필요).
- `lib/types.ts` + `supabase/migrations/0005_add_unit_price_reliable.sql` — `unit_price_reliable` 영속화.

### §1b 미검증 용량 게이트
`commit: feat: disable ml unit_price for explicitly-unverified volumes`

- `Product.volume_verified?: boolean` 추가. `=== false`이면 불일치가 없어도 ml당 비활성(가격 유지). 미설정(undefined)은 레거시 동작 유지 → **사이트 전역 ml 비교를 조용히 끄지 않음**. 운영자가 감사 후 행을 미검증으로 표시하면 자동 적용.

### 검증 (DoD #6)
- `tsc --noEmit` 통과, `eslint` 0 errors(기존 `<img>` 경고 1건만, 본 변경과 무관).
- `npm run test:all` 전부 PASS (normalize/healthcheck/naver/coupang/packageExtractor). 용량불일치·미검증 케이스 단위 테스트 추가.
- `npm run build` 성공.

---

## 2. 라이브 크롤 경로 재검증 (DoD #5) — **robots.txt로 차단됨**

`npm run live-check:naver` (robots.txt preflight, 실크롤 미수행) 결과:

| host | robots.txt | 판정 |
|---|---|---|
| `brand.naver.com` | `User-agent: * → Disallow: /` | **BLOCKED — 크롤 금지** |
| `naver.me` (단축링크) | HTTP 404 (allow 처리) | redirect 대상이 `brand.naver.com`(차단) → 실질 차단 |

요약: **네이버 브랜드스토어 6개 URL 전부 robots.txt가 전체 경로(`/`)를 disallow.**
프롬프트 §5 규칙대로 **크롤 금지 + "검증 불가 + 사유" 보고, 정답 날조 없음.**
이는 코드 결함이 아니라 정책 준수이며, 어댑터의 robots 체크가 정상 작동함을 입증(실제로 크롤을 거부함).

검증 불가 항목/사유:
- 네이버 6개 URL: robots.txt `Disallow: /` → 라이브 파서-vs-페이지 대조 불가.
- 검색 API ID 미스매칭은 **코드에서 제거됨**(naver.ts가 더 이상 search API 미사용) — 정적 증빙으로 확인(위 §0). 단, 라이브 파싱 정확도 대조는 robots 차단으로 미수행.

→ 다음 단계: 운영자 승인 하에 (a) 네이버 공식 데이터 제휴/허용된 경로 확보, 또는 (b) 쿠팡처럼 공식 API 경로로 검증. 쿠팡 `live-check:coupang`은 Partners API(크롤 아님) + 360s 간격이라 키 제공 시 실행 가능(이번 세션 미실행).

---

## 3. 시드 중복/placeholder 정리안 (§3) — **읽기 전용 제안, 쓰기는 승인 후**

라이브 Supabase 읽기(`_inspect.ts`/`_sample.ts`, seller_id=4) 기준: **활성 네이버 listing 14건 = 고유 URL 6개**. 두 차례 시드(legacy `PROD_00x`/`LINK_NAVER_*` + 신규 `p<hash>`)가 같은 URL을 가리켜 2~3중복.

| # | URL | 제품 | 중복 listing (id / link_key / product_key) | 비고 |
|---|---|---|---|---|
| A | `brand.naver.com/mongdies/products/13009860683` | 몽디에스 엑설런트 선크림 | #2 `LINK_NAVER_1`/PROD_001, #10 `LINK_NAVER_001`/PROD_001, #56 `naver_p8veeo9`/p8veeo9 | 3중복 |
| B | `brand.naver.com/dongwhafusidyne/products/9999261730` | 후시다딘 카밍 선크림 | #4 `LINK_NAVER_2`/PROD_002, #12 `LINK_NAVER_002`/PROD_002, #58 `naver_p19w4a4o`/p19w4a4o | 3중복 + **placeholder ID(9999261730)** |
| C | `naver.me/5zURlN5z` | 아로셀 멜라 TXA 선세럼 | #20 `LINK_NAVER_004`/PROD_004, #65 `naver_p1iafa5k`/p1iafa5k | 2중복 + **단축링크(미해석)** |
| D | `brand.naver.com/innisfree/products/13155811785` | 이니스프리 톤업 노세범 선크림 | #25 `LINK_NAVER_005`/PROD_005, #69 `naver_p7eg0l0`/p7eg0l0 | 2중복 |
| E | `brand.naver.com/beautyofjoseon/products/13518654945` | 조선미녀 톤업 선크림 퍼플 | #28 `LINK_NAVER_006`/PROD_006, #74 `naver_p1xe9jfw`/p1xe9jfw | 2중복 |
| F | `brand.naver.com/numbuzin/products/5788327291` | 넘버즈인 3번 톤업베이지 선크림 | #31 `LINK_NAVER_007`/PROD_007, #77 `naver_p4yux6n`/p4yux6n | 2중복 |

### 제안 (운영자 승인 필요 — DB 직접 수정 금지)
1. **URL당 listing 1개로 정규화**: 각 그룹에서 canonical 1건만 활성 유지, 나머지는 `is_active=false`(삭제 아님 — snapshot 이력 보존).
2. **canonical 세대 선택은 운영자 결정**: `PROD_00x`(legacy) vs `p<hash>`(신규) 중 **현재 Google Sheet의 product_key와 일치하는 세대**를 정본으로(=`sheets:import` 재실행 시 재생성되는 키). 권장: 시트 기준 세대 유지, 타 세대 비활성.
3. **B(placeholder)**: `9999261730`은 가짜 ID. 운영자가 동화약품 후시다딘 실제 `brand.naver.com/dongwhafusidyne/products/{실ID}` 제공 필요. 확보 전 해당 listing crawl 대상 제외.
4. **C(단축링크)**: `naver.me/5zURlN5z`를 canonical `brand.naver.com/{store}/products/{id}`로 해석해 교체(크롤 경로는 실 URL 필요). 단, 해석 결과도 `brand.naver.com`이면 robots 차단 대상.

---

## 4. 용량 감사 리포트 (§1b) — **읽기 전용 제안, DB·시트 미수정**

라이브 `products.volume_ml` 전수: 위 7개 선크림 **전부 `50ml`**. 균일한 50ml는 LLM 시드 기본값 정황(프롬프트: 몽디에스 실제 60ml인데 DB 50ml). 크롤 추출 용량은 **robots 차단으로 미수집** → 제목 기반 정정값을 날조하지 않음.

| product | brand | DB volume_ml | 크롤 추출 용량 | 제안 정정값 | 신뢰도 |
|---|---|---|---|---|---|
| 몽디에스 엑설런트 선크림 | 몽디에스 | 50 | 미수집(robots 차단) | **수동 확인 필요** (프롬프트는 몽디에스 60ml 정황 언급 — 단, 이는 '이지워시' 제품 fixture라 '엑설런트'와 동일 단정 불가) | 낮음 |
| 후시다딘 카밍 선크림 | 동화약품 | 50 | 미수집 | 수동 확인 필요 | 낮음 |
| 아로셀 멜라 TXA 선세럼 | 아로셀 | 50 | 미수집 | 수동 확인 필요 | 낮음 |
| 이니스프리 톤업 노세범 선크림 | 이니스프리 | 50 | 미수집 | 수동 확인 필요 | 낮음 |
| 조선미녀 톤업 선크림 퍼플 | 조선미녀 | 50 | 미수집 | 수동 확인 필요 | 낮음 |
| 넘버즈인 3번 톤업베이지 선크림 | 넘버즈인 | 50 | 미수집 | 수동 확인 필요 | 낮음 |

### 결론 / 제안
- 7개 모두 `50ml` 균일 + 크롤 차단 → **현재 용량은 미검증으로 간주**. §1에 따라 ml당 비교는 **정정 전까지 비활성이 정상**(base 가격 비교는 정상 동작).
- 운영자 워크플로우: (1) 시트에 `volume_verified`(bool) 컬럼 추가, 7개 행 `false`로 표시 → `sheets:import` 재실행 시 `Product.volume_verified=false` 반영 → 코드가 자동으로 ml당 비활성(이미 구현·테스트됨). (2) 공식 제품 페이지/공식몰에서 실 용량 확인 후 `volume_ml` 정정 + `volume_verified=true` → ml당 비교 재활성. (3) **DB·시트 직접 수정은 운영자 승인 후.**

---

## 6. (UPDATE) 네이버 크롤 폐기 → 쇼핑 검색 API 전환 + 매칭 모델 확정 (최종 스펙)

§2의 robots 차단 결론에 따라 **네이버 크롤 경로를 폐기하고 승인된 쇼핑 검색 API로 전환**. storefront robots는 API에 미적용. 쿠팡(HMAC Partners API+360s)은 그대로.

### 6.1 어댑터 (`crawler/adapters/naver.ts`) — 크롤 제거 후 API 재작성
- Playwright/셀렉터/robots 크롤 로직 삭제. 순수 매칭 함수 `pickOfficialOffer(items, {brand,name,volumeMl,allowedStoreName})` 분리(단위 테스트 가능).
- 매칭: (a) **개별 몰 상품만** — 가격비교 catalog 대표(`mallName="네이버"`/`/catalog/` 링크) 제외, `productType∈{2,3}` 2차 필터. (b) **공식몰** = `mallName` vs `retailer_allowlist.allowed_store_name`(정규화 + 브랜드 포함 폴백). (c) **동일 제품** = 제목 토큰 유사도 ≥ 0.5, 용량은 제목에서 파싱해 `parsedVolumeRaw`로 **전달만**(DB 용량 미검증이라 하드 reject 안 함 — §1b). 가격(`lprice`)·`link`는 **같은 오퍼**에서. 실패 시 **비교 제외 + 검수 플래그**(리셀러 폴백 없음).
- **productType 주의**: 공식 문서(developers.naver.com)가 빌드 환경에서 fetch 차단됨 → 숫자 매핑은 통념(1=catalog 대표, 2·3=개별몰)을 **2차 필터로만** 적용하고 주석에 근거·한계 명시. **1차 판별은 문서화된 `mallName` 필드.** 운영자 공식 문서 대조 권장(§10).

### 6.2 데이터 모델 (`migrations/0006_naver_api_matching.sql`)
- `price_snapshots.matched_url / matched_mall_name` 추가(스냅샷별 매칭 오퍼 기록 — 감사/변경 감지).
- `listings.latest_matched_url` 추가(최신 매칭 link 캐시).
- `retailer_allowlist.allowed_store_name`는 기존 컬럼을 공식 mallName 앵커로 **재사용**(스키마 변경 없음).
- 리다이렉트(`/go/[listingId]`): `affiliate_url → latest_matched_url → 미노출(홈)` 우선순위.

### 6.3 라이브 API 검증 (크롤 아님, robots 무관) — `npm run live-check:naver`
실 키로 어댑터 end-to-end 실행. 검색-API productId 미스매칭은 **사라짐**(매칭 = mallName+제목). **4/7 매칭, 3 제외(검수 큐, 리셀러 폴백 없음).**

| product | 결과 | matched mallName | price | matched link | parsed ml |
|---|---|---|---|---|---|
| 몽디에스 엑설런트 선크림 | MATCHED | 몽디에스 | 31,500 | smartstore.../13009860683 | **60** |
| 후시다딘 카밍 선크림 | **EXCLUDED** | — | — | — | — (개별몰 오퍼 없음, catalog 대표만) |
| 아로셀 멜라 TXA 선세럼 | MATCHED | 아로셀 | 49,200 | smartstore.../11957265981 | — |
| 이니스프리 톤업 노세범 선크림 | MATCHED | 이니스프리 | 14,000 | smartstore.../13435703575 | **50** |
| 조선미녀 톤업 선크림 퍼플 | MATCHED | 뷰티오브조선 : 조선미녀 | 15,300 | smartstore.../13518654945 | **50** |
| 넘버즈인 3번 톤업베이지 선크림 | **EXCLUDED** | — | — | — | — (공식몰 mallName 미일치) |

- 제외 2건은 정확히 **검수 큐 + allowlist 보강 요청** 대상(§10): 후시다딘=검색결과에 개별 공식몰 오퍼 미노출(catalog만), 넘버즈인=공식 mallName 미일치 → `retailer_allowlist`에 동화약품/넘버즈인 공식 mallName 등록 필요.

### 6.4 §1b 용량 감사 — API 제목 기반(이제 수집 가능)
크롤은 막혔지만 **API 매칭 오퍼의 공식몰 제목**에서 용량 파싱 가능 → 감사 근거 확보:

| product | DB volume_ml | API 제목 파싱 | 제안 | 신뢰도 |
|---|---|---|---|---|
| 몽디에스 엑설런트 선크림 | 50 | **60** (몽디에스 공식몰, 60ml×2 기획 추정) | 50→**60** 정정 후보 | 중 |
| 이니스프리 톤업 노세범 선크림 | 50 | **50** (공식몰 일치) | 50 유지 + `volume_verified=true` | 중상 |
| 조선미녀 톤업 선크림 퍼플 | 50 | **50** (공식몰 일치) | 50 유지 + `volume_verified=true` | 중상 |
| 아로셀 멜라 TXA 선세럼 | 50 | 제목에 ml 없음 | 수동 확인 | 낮음 |
| 후시다딘 / 넘버즈인 | 50 | 매칭 제외로 미수집 | allowlist 보강 후 재측정 | — |

→ DB·시트 직접 수정 없음. 운영자 승인 후 시트 `volume_ml`/`volume_verified` 반영 → `sheets:import`.

### 6.5 다른 판매처 robots 점검 (§5) — `npx tsx scripts/live-check/check-robots.ts`
| seller | host | robots.txt | 판정 | 비고 |
|---|---|---|---|---|
| oliveyoung (#1, 어댑터 有) | `www.oliveyoung.co.kr` | **HTTP 403** | **불확실/주의** | robots.txt 자체가 403 → 안티봇(WAF) 정황. clean allow 아님 → 크롤 가능성 불투명, **검증 필요**. 대안(메뉴얼/정보 링크 강등) 옵션 검토 권장 — **정책 변경은 승인 후.** |
| zigzag (어댑터 無) | `store.zigzag.kr` | `User-agent: * Disallow:` (빈값) | 허용 | 단, 어댑터 미구현 → 현재 크롤 안 함 |
| ably (어댑터 無) | `m.a-bly.com` | HTTP 403 | 불확실 | 어댑터 미구현 |

→ 코드상 Playwright 크롤 판매처는 **oliveyoung 1곳뿐**(zigzag/ably는 listing만 있고 어댑터 없음 → run.ts에서 skip). 올영 403은 단독 판단 금지, 운영자 보고 + 옵션 제시.

### 6.6 검증 (DoD)
`tsc`/`eslint`(기존 `<img>` 경고 1건만)/`test:all`(normalize·healthcheck·naver(pickOfficialOffer)·coupang·packageExtractor 전부 PASS)/`build` 통과.

---

## 5. 남은 이슈 / TODO

- [ ] (운영자) `retailer_allowlist`에 **공식 mallName 등록**: 동화약품(후시다딘)·넘버즈인 등 매칭 제외 브랜드 → 비교 활성화의 선결.
- [ ] (운영자) productType 숫자 매핑을 네이버 공식 문서로 확인(현재 mallName 1차 판별 + productType 2차 필터로 안전 동작).
- [ ] (운영자) 시드 중복 정리 canonical 세대 확정(§3). 단, API 전환으로 `listings.url`은 "참고/매칭 힌트(선택)"로 강등됨 — placeholder/단축링크는 더 이상 차단 요인 아님.
- [ ] (운영자) 시트 `volume_verified` 컬럼 추가 → 몽디에스 50→60 검토, 이니스프리·조선미녀 `true`, 미검증 행 `false` → `sheets:import`.
- [ ] (운영자) `migrations/0005`·`0006` 라이브 적용 승인(스키마 변경).
- [ ] 쿠팡 `live-check:coupang`(실 키·360s·≤3건) 이번 세션 미실행.
- [ ] `feature/crawler-consolidation` push & PR(영어 description)은 테스트 통과 확인 — 운영자 승인 시 진행.
