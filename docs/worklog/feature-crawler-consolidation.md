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

## 5. 남은 이슈 / TODO

- [ ] (운영자) 시드 중복 정리 canonical 세대 확정 + placeholder/단축링크 실 URL 제공.
- [ ] (운영자) 시트 `volume_verified` 컬럼 추가 + 7개 선크림 `false` 표시 → `sheets:import`.
- [ ] (운영자) 7개 제품 실 용량 확인 후 `volume_ml` 정정.
- [ ] 네이버 라이브 파싱 검증: robots 차단으로 불가 → 공식 제휴/허용 경로 또는 쿠팡 API 경로로 대체 검증 협의.
- [ ] `migrations/0005` 라이브 적용은 운영자 승인 후(스키마 변경).
- [ ] 통합 후 `feature/crawler-consolidation` push & PR(영어 description)은 테스트 통과 확인했으므로 운영자 승인 시 진행.
