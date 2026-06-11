# ViewtyPick 서비스 설계서

> 기준 문서: `README.md` · 버전 3.5 (2026-06-11) · 대상: MVP (제품 50~100개)
> 핵심 제약: **최소 운영 비용 · 모바일 우선 · SEO 중심 트래픽**
> 도메인: **viewtypick.com** (구매 예정) · 개발 주체: 운영자 직접 개발
>
> v3.0 변경 요약: 전체 설계서 내용 병합. 가격 모델을 **기본 최저가 / 혜택 최저가 2트랙**으로 확장(§4.3), 조건부 혜택(쿠폰·앱·멤버십·카드) 제외 정책 명문화, `retailer_allowlist`·`manual_overrides`·`affiliate_clicks`·`crawl_errors`·`sheet_import_runs` 도입(§5·§6), Viewty Score에 **판매처 신뢰도** 요소 추가(§8), 브랜드 공식몰을 가격 비교에서 제외하고 정보 링크로만 제공(§4.1).
> v3.1 변경 요약: §18 충돌 항목 사용자 확정 반영. 제휴 수수료·정산 조건 표 추가, 컬리 제외 확정. `manual_overrides`를 **가격+프로모션 수동 주입**으로 확장(§4.4·§5). README §2.2 브랜드 공식몰 정합성 수정 완료.
> v3.2 변경 요약: 제휴 약관 1차 검증 반영(§12.3).
> v3.3 변경 요약: 제휴 링크 **수동 발급·시트 입력** 확정(§12.1) → 자동화 제약 제거. 우선순위를 **수수료 순**으로 환원하고, 남은 변수는 *가격비교 사이트 게재 허용 여부* 하나로 좁힘.
> v3.4 변경 요약: 제휴 프로그램에 네이버 어필리에이트 추가(§12). 이미 가격 비교 3순위인 네이버 listing을 그대로 수익화 — 시너지 큼.
> v3.5 변경 요약: 명칭 정정 — 프로그램명은 **네이버 쇼핑 커넥트**(2025-07 출시), **브랜드 커넥트**는 이를 포함하는 상위 크리에이터 제휴 플랫폼. 전 항목 명칭 통일.

---

## 0. 핵심 설계 결정 요약

| 항목 | 결정 |
|---|---|
| 프레임워크 | Next.js (App Router, TypeScript) — SSG/ISR로 SEO·모바일 성능 확보 |
| 호스팅 | Vercel (개발~검증) → **수익화 시 Cloudflare 이전 확정**. 1순위 Workers+OpenNext, 2순위 Pages+별도 Worker (§3.1) |
| DB | Supabase (Postgres, 무료 티어) |
| 가격 수집 | 공식 API 우선 + 무API 판매처는 크롤링, **하루 1회** (GitHub Actions cron, KST 04:00 = UTC 19:00) |
| 제품 관리 | **Google Sheets(입력) → Supabase(서빙)** → 트래픽 증가 후 어드민 페이지 전환 (§7) |
| 이상 알림 | **Discord 웹훅** — 크롤링 실패·링크 이상·프로모션 검수 (§4.4) |
| 가격 모델 | **기본 최저가**(조건 없는 1개가) / **혜택 최저가**(1+1·2+1·수량할인 실질 개당가) **2트랙 분리**. 모든 가격은 비교를 위해 **ml당 가격으로도 정규화**. 쿠폰·앱·멤버십·카드 할인은 기본 최저가 제외, 조건부 혜택으로만 표시 (§4.3) |
| 신뢰 게이트 | 파싱 불확실(`parse_confidence=low`)·상품 불일치 가격은 비교에서 제외 (§4.3·§4.4) |

**예상 월 운영비: 도메인(약 1.5만 원/년) 제외 0원.**

---

## 1. 설계 원칙

1. **비용 0에 수렴** — 전 구성 요소 무료 티어, 트래픽 증가 시에만 유료 전환.
2. **모바일 우선** — 모든 화면을 모바일 세로 기준으로 설계, 데스크톱은 반응형 확장.
3. **SEO 우선** — 콘텐츠 페이지는 SSG/ISR 정적 생성, 크롤러가 완성된 HTML을 받음.
4. **신뢰 우선** — 불확실한 가격(파싱 실패·프로모션 모호·상품 불일치)은 노출하지 않는다. 잘못된 최저가가 서비스 신뢰를 깬다.
5. **운영 자동화 + 단순성** — 가격은 자동 수집, 이상은 Discord로 통지, 제품 관리는 시트로.

---

## 2. 시스템 아키텍처

```
┌────────────────────────────────────────────────────────┐
│ 운영자: Google Sheets (제품·판매처URL·뱃지·허용스토어·보정) │
└──────────────┬─────────────────────────────────────────┘
               │ ① sheet-import (크롤링 전 자동, 검증 + upsert)
               ▼
┌────────────────────────────────────────────────────────┐
│ GitHub Actions cron — 매일 04:00 KST (UTC 19:00)         │
│  1. sheet-import  시트 → DB upsert + 유효성 검사          │
│                   (sheet_import_runs 기록)               │
│  2. crawl-prices  판매처별 어댑터(API/크롤링) 병렬 수집     │
│  3. normalize     프로모션 파싱 → 기본가/혜택가/ml당 정규화 │
│  4. healthcheck   링크 상태·가격 이상치·상품명 일치 점검    │
│                   (crawl_runs / crawl_errors 기록)       │
│  5. score         Viewty Score 재계산                    │
│  6. revalidate    변경 페이지 ISR 재생성 트리거            │
│  7. notify        Discord 웹훅 (즉시 알림 + 일일 요약)     │
└──────────────┬─────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────┐
│ Supabase (Postgres): products / listings /              │
│ price_snapshots / current_prices / badges /             │
│ retailer_allowlist / manual_overrides / affiliate_clicks│
│ crawl_runs / crawl_errors / sheet_import_runs           │
└──────────────┬─────────────────────────────────────────┘
               ▼
┌────────────────────────────────────────────────────────┐
│ Next.js on Vercel→Cloudflare — SSG/ISR, 모바일 우선 UI    │
└──────────────┬─────────────────────────────────────────┘
               ▼
   사용자(모바일 웹) ──/go/ 리다이렉트(클릭집계)──▶ 판매처 (어필리에이트)
```

---

## 3. 기술 스택 및 선택 근거

### 3.1 호스팅 — Vercel(개발~검증) → Cloudflare 이전 (확정)

- **Vercel Hobby(무료)는 약관상 비상업 용도 한정.** AdSense·어필리에이트 수익이 발생하는 순간 상업적 이용이 된다.
- 따라서 **개발~검증 단계는 Vercel Hobby**로 진행하고, 수익화(쿠팡 파트너스 승인·AdSense 게재·제휴 링크 운영) 직전에 **Cloudflare로 이전한다 (확정)**.
- **이전 대상 우선순위**:
  1. **Cloudflare Workers + OpenNext** (기본 권장) — App Router·Route Handler(`/go`, `/api/revalidate`)·ISR/on-demand revalidation을 유지하고 향후 어드민도 같은 코드베이스에 둘 수 있음.
  2. **Cloudflare Pages + 별도 Worker** (대안) — 정적 export 중심으로 단순화할 경우. 클릭 추적·revalidate API는 별도 Worker로 분리.
- 무료 티어에서 상업적 이용 허용, 대역폭 무제한 → 비용 0 유지.
- **ISR·on-demand revalidation·image optimization·Route Handler 호환성을 Phase 2에서 사전 검증**하고, 비호환 기능은 처음부터 사용하지 않는 것을 원칙으로 한다(이전 비용 최소화). 검증 완료 전에는 제휴/광고 운영을 시작하지 않는다.

### 3.2 프레임워크 — Next.js (App Router)

- SSG로 카테고리·제품·SEO 랜딩 페이지를 빌드 타임 HTML로 생성.
- ISR + On-Demand Revalidation으로 크롤링 완료 직후 가격 반영 → 항상 신선한 정적 페이지.
- 메타데이터 API, 동적 sitemap/robots, JSON-LD 등 SEO 기능 내장.

### 3.3 DB — Supabase

- 무료 Postgres 500MB. 100제품 × 6판매처 × 365일 스냅샷 ≈ 22만 행/년 → 수년간 여유.
- **Supabase Studio가 간이 어드민 역할** — 긴급 데이터 보정에 활용.
- 웹은 anon 키 + RLS 읽기 전용, 쓰기는 배치의 service role만 (§13).

### 3.4 기타

- **스타일**: Tailwind CSS (모바일 우선 유틸리티).
- **분석**: GA4 + Google Search Console (무료).
- **알림**: Discord 웹훅 (URL 하나로 구현, 무료).

---

## 4. 가격 수집 파이프라인

### 4.1 판매처 정책 및 수집 방법

가격 비교 대상은 **검증된 판매처로 제한**한다. 개인 스마트스토어·검증되지 않은 오픈마켓·출처 불명 쇼핑몰·중고 거래·**컬리**는 제외한다.

| 판매처 | 우선순위 | 가격비교 | 방식 | 비고 |
|---|---|---|---|---|
| 올리브영 | 1 | 포함 | Playwright 크롤링 | 핵심 뷰티 판매처. 1+1·2+1·올영세일 등 프로모션 정교 처리, 모바일 페이지 파싱 단순 |
| 쿠팡 (로켓/신뢰상품) | 2 | 포함 | **쿠팡 파트너스 API** | 직접 크롤링 차단 강함. API로 가격·딥링크 동시 해결. 검색 API 시간당 10회 제한 → 단건 조회 + 지연 |
| 네이버 공식 브랜드스토어 | 3 | 포함 | **네이버 쇼핑 검색 API** + 보조 크롤링 | `lprice` 반환(일 25,000회 무료). **`retailer_allowlist`로 검증된 공식 스토어만** 채택, 스토어명 불일치 시 제외. **쇼핑 커넥트로 수익화 가능**(직접 5~20%, §12) |
| 지그재그 | 4 | 포함(확장) | Playwright 크롤링 | 공식 브랜드/신뢰 입점사만. 수수료 7~10%로 높아 **게재 허용 확인되면 우선 연동**(링크 수동 입력, §12.3). 웹 구조 변동 잦음 |
| 에이블리 | 5 | 포함(확장) | Playwright 크롤링 | 수수료 2%로 낮아 **후순위 유지** |
| 브랜드 공식몰 | 보조 | **제외** | — | **가격 비교·크롤링·최저가 계산 제외**, 제품 상세의 "공식 정보 보기" 링크로만 제공 (근거는 §18) |

> 어필리에이트 네트워크 피드(링크프라이스 등)는 검토 결과 **쿠팡 외 대상 판매처를 제공하지 않아 채택하지 않는다** (2026-06 확인). 가격 수집은 위 API + 크롤링 체계로 확정.

### 4.2 크롤러 구조 — 판매처별 어댑터 패턴

```
crawler/
├─ sheets/
│  ├─ import.ts        # 시트 → DB upsert (sheet_import_runs)
│  └─ validate.ts      # 필수값/중복 slug·link_key/URL/retailer_code 검증
├─ adapters/           # 판매처별 독립 모듈 (한 곳 실패가 전체에 영향 없음)
│  ├─ coupang.ts       (API)
│  ├─ naver.ts         (API + 보조 크롤링, allowlist 필터)
│  ├─ oliveyoung.ts    (Playwright)
│  ├─ zigzag.ts        (Playwright, Phase 5)
│  └─ ably.ts          (Playwright, Phase 5)
├─ core/
│  ├─ normalize.ts     # 프로모션 파싱 · 기본가/혜택가 · ml당 가격 계산
│  ├─ healthcheck.ts   # 링크/이상치/상품명 일치 점검
│  ├─ revalidate.ts    # 변경 경로 on-demand revalidation
│  └─ notify.ts        # Discord 웹훅
└─ run.ts
```

크롤링 예절: robots.txt 존중, 요청 간 2~5초 랜덤 지연, 하루 1회 소량(수백 건), 가격 외 콘텐츠(이미지 원본·리뷰 본문)는 복제하지 않고 링크로만 연결.

어댑터 인터페이스(개념):

```ts
interface RetailerAdapter {
  code: RetailerCode;
  requiresBrowser: boolean;
  supportsPromotionParsing: boolean;
  fetchOffer(link: Listing): Promise<PriceOffer>;
}
```

### 4.3 가격·프로모션 모델 — 기본 최저가 / 혜택 최저가 2트랙

화장품 판매처는 1+1·2+1·쿠폰·앱 전용가·멤버십가·카드 할인 등 조건이 많다. 단일 숫자로 보여주면 오인을 부른다. 따라서 가격을 두 트랙으로 분리하고, 비교 정합성을 위해 **ml당 가격으로도 정규화**한다.

| 구분 | 의미 |
|---|---|
| `base_unit_price` (기본가) | 조건 없이 1개 구매 가능한 검증 판매처 최저가 |
| `effective_unit_price` (혜택가) | 1+1·2+1·수량할인 적용 시 실질 개당가 |
| `unit_price` (ml당) | `price / total_ml` — 용량·구성 다른 제품 간 비교용 |

**자동 최저가 계산 포함** (즉시·조건 없이 누구나): 페이지 즉시 세일가, 1+1, 2+1, N개 M% 할인, N개 총액 할인, 명확한 번들가.

**자동 계산 제외 → 조건부 혜택으로만 표시**: 로그인/앱 전용/첫구매/장바구니 쿠폰, 멤버십 전용가, 카드 청구할인, 특정 결제수단 할인, 포인트 적립, 정기배송 할인. **이 가격들은 기본가·혜택가·구조화 데이터에 넣지 않는다.**

계산식:

```
1+1   판매가 18,900 → 2개 수령 → 개당 9,450
2+1   판매가 18,900 → 3개 수령 → 18,900×2/3 = 12,600
2개 20% 할인  18,900×2×0.8 / 2 = 개당 15,120
```

정규화 처리:
1. 상품명·프로모션 영역에서 패턴 추출: `1+1`, `2+1`, `N개입`, `50ml+50ml`, `더블기획`, `증정` 등 — 정규식 사전 기반, 운영하며 규칙 추가.
2. 추출 성공 → `quantity`, `total_ml`, 기본가/혜택가 계산.
3. **추출 실패·모호** → `promo_type=unknown`, `parse_confidence=low` 저장 후 **최저가 비교에서 제외** + Discord "검수 필요" 알림.
4. 증정품(사은품)은 가격 계산 미반영, `promo_text`로만 노출.
5. 상세 페이지에서 프로모션 상품은 단품과 **별도 행**으로 기본가·혜택가·ml당 가격을 함께 표기 → 직접 비교 가능.

`promo_type` enum: `none | sale | buy_x_get_y | quantity_discount | bundle | gift | coupon | membership | app_only | card_discount | unknown` (뒤 5종은 조건부 혜택 표시 전용).

### 4.4 헬스체크 & Discord 알림

| 감지 항목 | 판정 | 조치 |
|---|---|---|
| HTTP 404/410, 판매종료 페이지 | 링크 사망 | **즉시 알림** + listing 비활성 후보 |
| 5xx, 타임아웃, 403(차단) | 일시 장애 가능 | `fail_count` 증가, 직전 가격 유지 |
| 파싱 성공했으나 가격 필드 누락 | 페이지 구조 변경 의심 | 즉시 알림 (어댑터 수정 필요) |
| 전일 대비 가격 ±50% 변동 | 파싱 오류 의심 | 알림 + 비교 제외 |
| 1,000원 미만·정가<판매가·1+1가>기본가 | 이상치 | 알림 + 비교 제외 |
| 상품명 유사도 불일치 | 상품 오매칭 의심 | 해당 가격 비교 제외 + 알림 |
| 공식 스토어명이 allowlist와 불일치 | 신뢰 검증 실패 | 비교 제외 + 알림 |
| `parse_confidence=low` | 프로모션 모호 | 일일 요약에 포함 |

**연속 실패 단계 처리**: 1회 → 직전 정상가 유지(내부 warning) · 2회 → Discord 알림 · 3회 → 해당 판매처 가격 비노출 · 5회 → "수동 점검 필요" 상태로 전환.

**수동 복구**: 자동 수집이 막힌 항목은 운영자가 `manual_overrides`(시트 → MVP, 어드민 → Phase 2)로 **가격뿐 아니라 프로모션(promo_type·promo_text·실질 개당가)까지 직접 주입**할 수 있다. normalize 단계에서 active override가 크롤링 결과를 덮어쓰고, `expires_at` 경과 시 자동 해제되어 정상 수집으로 복귀한다.

알림 2종: **즉시 알림**(치명 이슈) + **일일 요약 1건**(성공률, 신규 이상, 검수 대기 목록). 추가 알림 대상: 시트 import 실패, 제휴 링크 누락, 모든 판매처 수집 실패, 전일 1+1이 오늘 사라짐, revalidation 실패.

---

## 5. 데이터 모델 (Supabase / Postgres)

```sql
categories (id, slug, name, sort_order)        -- 선크림/토너/로션/세럼/크림/클렌징
sellers    (id, slug, name, priority,          -- 판매처 메타 (retailer)
            collect_method,                     -- api | crawl
            is_affiliate_supported bool,
            is_price_comparison_enabled bool,    -- 브랜드 공식몰 = false
            is_trusted bool)

products (
  id, slug,                  -- SEO URL용 (예: round-lab-birch-suncream)
  product_key,               -- 시트 매칭 키
  name, brand, category_id,
  volume_ml,                 -- 단품 기준 용량
  image_url, features,
  skin_types text[],         -- 민감성/지성/건성/복합성/수부지/여드름성
  hwahae_url, official_info_url,
  viewty_score numeric,      -- 배치에서 계산·저장 (런타임 계산 없음)
  source text,               -- sheet | admin
  is_active bool
)

badges (id, slug, name)                        -- 디렉터파이/화해랭킹/올영베스트
product_badges (product_id, badge_id, detail, source_title, ref_url, source_date)

listings (                   -- 제품 × 판매처 (크롤링 대상). 시트 product_links 대응
  id, link_key, product_id, seller_id,
  url,                       -- 크롤링 대상 원본 URL
  affiliate_url,             -- 사용자 노출 링크
  store_name,                -- 판매자/스토어명
  is_official_store bool, is_rocket bool,
  crawl_enabled bool, crawl_method text,        -- api | html | playwright | manual
  last_crawled_at timestamptz,
  fail_count int default 0,
  is_active bool
)

retailer_allowlist (id, seller_id, brand,      -- 네이버/지그재그/에이블리 신뢰 스토어
  allowed_store_name, is_active)

price_snapshots (            -- 하루 1회 누적 → 가격 추이 데이터 자산
  id, listing_id, product_id, crawled_at,
  regular_price int, sale_price int,
  base_unit_price int,       -- 조건 없는 1개가
  promo_type text, promo_text text,
  min_quantity int, paid_quantity int, free_quantity int, total_quantity int,
  total_ml numeric,          -- 구성 반영 총 용량
  unit_price numeric,        -- price / total_ml (ml당)
  effective_unit_price int,  -- 혜택 적용 실질 개당가
  in_stock bool,
  source_text text,          -- 감지 원문
  parse_confidence text,     -- high | low
  status text                -- ok | warning | failed
)

current_prices (             -- 제품별 노출용 요약 캐시 (price_summaries)
  product_id PK,
  base_lowest_price int, base_lowest_seller text, base_lowest_listing_id,
  promo_lowest_unit_price int, promo_lowest_seller text, promo_label text,
  has_promotion bool, last_checked_at, updated_at)

manual_overrides (id, product_id, seller_id,                  -- 크롤링 불안정 항목 수동 보정
  override_type text,        -- price | promo_type | promo_text | unit_price | in_stock
  value text,                -- 보정값 (타입별 파싱)
  reason text, expires_at timestamptz, is_active bool)
  -- normalize 단계에서 active override가 크롤링 결과를 덮어씀(가격·프로모션 모두 수동 주입 가능)

affiliate_clicks (id, product_id, listing_id, seller_code,   -- 개인정보 미저장
  clicked_at, referrer, page_path, user_agent_hash, session_id)

crawl_runs   (id, started_at, finished_at, status,           -- 실행 단위 로그
  total_links, success_count, warning_count, failure_count, summary jsonb)
crawl_errors (id, crawl_run_id, product_id, listing_id, seller_code,
  error_type, severity, message, raw_context jsonb, created_at)  -- info|warning|critical
sheet_import_runs (id, started_at, finished_at, status,
  products_count, links_count, badges_count, error_count, summary jsonb)

seo_pages (id, slug, page_type, title, h1, description,      -- 데이터 기반 랜딩(선택)
  category, skin_type, badge_type, is_active)

score_config (key, value)                      -- Viewty Score 가중치 (코드 배포 없이 조정)
```

> 명명 메모: 본 문서는 기존 `sellers / listings / current_prices` 명칭을 유지한다. 전체 설계서의 `retailers / product_links / price_summaries`는 동일 개념의 별칭이다. `crawl_logs`는 `crawl_runs` + `crawl_errors`로 분리했다.

---

## 6. 제품 데이터 관리 — Google Sheets (MVP)

**입력 = 시트, 서빙 = Supabase** 분리 패턴. 시트가 single source of truth이며, 어드민 전환 전까지 제품 정보는 시트에서만 수정한다.

| 시트 탭 | 컬럼 |
|---|---|
| products | product_key, slug, 제품명(ko/en), 브랜드, 카테고리, 용량(ml), 이미지URL, 짧은설명, 특징, 피부타입(쉼표), 화해URL, 공식정보URL, 활성여부 |
| product_links | link_key, product_key, 판매처코드, 상품URL, **어필리에이트URL(수동 발급 입력)**, 스토어명, 공식스토어여부, 로켓여부, crawl_enabled, crawl_method, 활성여부 |
| badges | product_key, 뱃지유형, 표시명, 출처제목, 출처URL, 출처날짜, 활성여부 |
| retailer_allowlist | 판매처코드, 브랜드, 허용스토어명, 활성여부 |
| manual_overrides | product_key, 판매처코드, 보정유형(price/promo_type/promo_text/unit_price/in_stock), 보정값, 사유, 만료일, 활성여부 |
| seo_pages | slug, 페이지유형, title, h1, description, 카테고리, 피부타입, 뱃지유형, 활성여부 |

`sheet-import` 잡: 필수값·중복 키·URL 형식·retailer_code 유효성 검사 → Supabase upsert → 시트 `is_active=false`는 DB에서도 비활성 처리(삭제 대신) → 오류 시 Discord 보고 + `sheet_import_runs` 기록. 긴급 보정은 Supabase Studio에서 직접.

> **셀렉터 관리 정책(판단)**: 전체 설계서는 `selector_price/promo/stock`을 시트에 두자고 제안한다. 본 설계는 **셀렉터를 어댑터 코드에 둔다**(가독성·테스트·버전관리 우위). 시트의 `crawl_method`/`is_active`로 충분히 운영 가능하며, 코드 무배포 셀렉터 교체가 꼭 필요해지면 그때 DB 컬럼으로 승격한다. — §18 참조.

---

## 7. 어드민 전략 — 단계적 전환

| 단계 | 도구 | 범위 |
|---|---|---|
| **Phase 1 (MVP)** | Google Sheets + Discord | 제품·URL·뱃지·허용스토어·보정 관리 전부 / 이상 알림 수신 |
| **Phase 1.5** | 읽기 전용 상태 페이지 `/admin/status` (Basic Auth) | 크롤링 성공률, 실패 listing, 검수 대기 큐 — 개발 1~2일 수준 |
| **Phase 2** | Next.js 어드민 (Supabase Auth) | 제품 CRUD, 가격 수동 보정, 프로모션 검수 큐, 클릭/수익 대시보드. 시트 폐기(Supabase 단일 원천) |

**Phase 2 전환 기준**: 제품 100개 초과, 시트 관리가 병목이 될 때, 또는 운영자 2인 이상.

---

## 8. Viewty Score

사용자에게 점수는 비노출, 리스트 정렬·추천 순위에만 사용. 100점으로 normalize.

```
ViewtyScore = 추천 신뢰도(50) + 가격 경쟁력(35) + 판매처 신뢰도(15)

추천 신뢰도(≤50): 디렉터파이 +25 / 화해 랭킹 +15 / 올영 베스트 +15 / 복수 출처 +10
가격 경쟁력(≤35): 카테고리 내 ml당 가격 상위 30% +15 / 기본가 평균 대비 10%↓ +10
                  / 혜택가 존재 +5 / 최근 7일 가격 하락 +5
                  (parse_confidence=low 가격은 제외)
판매처 신뢰도(≤15): 올리브영 +5 / 쿠팡 +5 / 네이버 공식 +5 / 검증 판매처 3곳↑ +5
```

- 가중치·뱃지 점수는 `score_config` 테이블에 보관 → 코드 배포 없이 튜닝.
- 크롤링 후 일괄 재계산하여 `products.viewty_score`에 저장. 동점 시 가격 갱신 최신순.

> v2.1 대비 변경: 2요소(0.6·0.4) → **3요소(50/35/15)**. 판매처 신뢰도를 명시 요소로 승격. — §18 참조.

---

## 9. 페이지 구조 및 라우팅

| 경로 | 렌더링 | 설명 |
|---|---|---|
| `/` | ISR | 홈: 카테고리 진입 + 오늘의 픽(Score 상위) + 디렉터파이/올영 행사 섹션 |
| `/c/[category]` | ISR | 카테고리 리스트 + 피부타입 필터 |
| `/p/[slug]` | ISR | 제품 상세: 기본가/혜택가 비교, 뱃지, 외부 링크 |
| `/pick/[badge]/[category]` | SSG | SEO 랜딩: "디렉터파이 추천 선크림" (= curation) |
| `/skin/[type]/[category]` | SSG | SEO 랜딩: "민감성 선크림 추천" |
| `/go/[listingId]` | 서버 302 | 클릭 집계(affiliate_clicks) 후 어필리에이트 URL로 이동 |
| `/api/revalidate` | POST | `secret` 검증 후 변경 경로 on-demand revalidation |
| `/sitemap.xml`, `/robots.txt` | 동적 | 자동 생성 (크롤링 후 갱신) |

- ISR `revalidate` 24h + 크롤링 완료 후 on-demand revalidation(`/p/{slug}`, `/c/{category}`, `/skin/...`, `/pick/...`, `/`).
- 피부타입 필터는 쿼리(`?skin=`)로 처리하되, SEO 가치 높은 조합은 SSG 랜딩으로 별도 생성. 제품 수가 적어 씬한 조합 페이지는 noindex.
- `/go/` 리다이렉트로 클릭 자체 집계 → 수익·전환 분석 기반.

> URL 구조 판단: 전체 설계서는 루트형(`/sunscreen/`, `/curation/...`)을 제안한다. 본 설계는 네임스페이스 충돌·라우팅 단순성 우위로 **`/c/`·`/skin/`·`/pick/` 접두형을 유지**한다. 루트형의 미미한 SEO 이점보다 slug 충돌 리스크 회피를 우선. — §18 참조.

---

## 10. 모바일 우선 UI

**홈** — 검색 없음(MVP 100개 이하라 탐색으로 충분):

```
[로고]
[카테고리 칩 가로 스크롤: 선크림 토너 세럼 크림 클렌징 로션]
[오늘의 픽: Score 상위 카드 캐러셀]
[카테고리별 섹션: 상위 3개 + 더보기]
```

**카테고리 리스트** — 1열 카드, Score순 기본(옵션: 기본가순/혜택가순/ml당 가격순):

```
[카테고리 탭] [피부타입 필터: 바텀시트]
┌──────────────────────────────┐
│ [이미지] 브랜드 / 제품명         │
│   🏷 디렉터파이 · 올영BEST       │
│   기본 12,900원~ (ml당 258원)   │
│   혜택 9,450원~/개 · 올영 1+1   │
└──────────────────────────────┘
```

**제품 상세**:

```
[이미지] [브랜드 / 제품명 / 용량] [뱃지] [피부타입 태그] [특징]
─ 판매처별 가격 ─────────────────────
  판매처   기본가    판매가   혜택   실질개당가  조건
  올리브영 22,000   18,900   1+1   9,450     2개 수령  ← 혜택가 하이라이트
  쿠팡     20,000   17,800   없음  17,800    1개 구매  ← 기본가 최저 하이라이트
  네이버   21,000   18,500   쿠폰  별도표시  쿠폰 다운로드 필요(조건부)
  "가격은 매일 오전 갱신 · 마지막 갱신 6/11 04:00"
─ 외부 정보 ─────────────────────────
  [화해 성분 분석] [브랜드 공식 정보]
─ FAQ ──────────────────────────────
  1개만 사면 어디가 싼가요? / 1+1 기준 최저는? / 공식 판매처만 비교? / 쿠폰가는 최저가 포함?
```

- 가격 갱신 시각 명시 + "실제 결제가는 판매처에서 확인" 안내 = 신뢰 장치.
- 구매 버튼은 엄지 도달 영역, `/go/` 경유, `rel="sponsored nofollow"`. (우선순위: affiliate_url → url → 비활성 시 버튼 비노출)
- 리스트는 페이지네이션 + canonical (무한 스크롤보다 SEO 유리).
- 데스크톱은 동일 컴포넌트의 다열 그리드 확장.

---

## 11. SEO 구현

- **메타 템플릿**: `{제품명} 최저가 · 검증 판매처 가격 비교 | ViewtyPick` + Open Graph 카드.
- **JSON-LD**: 상세에 `Product` + `AggregateOffer`(lowPrice/highPrice/offerCount), 리스트에 `ItemList`, 랜딩에 `BreadcrumbList`. **대표 가격은 조건 없이 확인 가능한 기본 최저가만 사용**, 1+1 실질가·쿠폰·앱 전용가는 구조화 데이터에 넣지 않는다(페이지에 안 보이는 가격 금지).
- **내부 링크**: 랜딩 ↔ 카테고리 ↔ 상세 상호 연결로 크롤링 깊이·키워드 커버리지 확보.
- **Core Web Vitals**: next/image + WebP, Pretendard 서브셋, 리스트·상세는 서버 컴포넌트로 클라이언트 JS 최소화.
- **씬 콘텐츠 회피**: 랜딩에 자연어 도입 문단 1~2개 + 추천 근거·ml당 가격 등 고유 정보 (AdSense 승인 대비).

---

## 12. 수익 모델 연동

### 12.1 제휴 프로그램 현황 (2026-06)

| 판매처 | 프로그램 | 수수료 | 정산 조건 | 연동 방식 |
|---|---|---|---|---|
| 네이버 | 쇼핑 커넥트(브랜드 커넥트 플랫폼 내) | **직접 5~20%(상품별) / 간접 1.8% 고정** | 매월 1~말일 정산 → 익월 21일 지급, 익월 말일까지 구매확정 취소 시 제외 | 브랜드 커넥트 크리에이터 스페이스 + 본인 채널 등록(블로그·SNS 제한 없음), 사전 심사 없음. 네이버플러스 스토어 상품 링크 발급 |
| 지그재그 | 공유리워드 | **7~10%** | 익월 28일 합산 → 익익월 정산일(매월 20일) 지정계좌 지급 | 앱에서 링크 공유 |
| 올리브영 | 큐레이터 활동 | **직접 7% / 간접 3%** | 5,000원 이상 수익화, 매월 21일 10시~말일 수익화 | 마이페이지>큐레이터 |
| 쿠팡 | 쿠팡 파트너스 | 3% | 매월 말일 정산 → 익월 15일 지급(확정 1만 원 이상) | API·딥링크(웹 지원) |
| 에이블리 | 크리에이터 | 2% | 적립월 익월 15일 지급 | 앱에서 링크 공유 |
| 컬리 | 큐레이터 | — | 조건이 까다로워 **제외** | — |

**링크 수급 방식 (확정)**: 제휴 링크는 **자동 발급하지 않는다.** 제품을 추가할 때마다 운영자가 각 앱/대시보드에서 링크를 **수동으로 발급해 Google Sheets `product_links.affiliate_url`에 직접 입력**한다. MVP 50~100개 규모이고 디렉터파이 제품도 수동 정리하므로 운영 부담은 수용 가능하며, 기존 시트 입력 워크플로우와 일치한다. → **자동 링크 생성 API 유무는 더 이상 제약이 아니다.**

**수익 우선순위**: 자동화 제약이 사라지면서 **수수료 기준**으로 정렬한다 — **네이버 쇼핑 커넥트(직접 5~20%) ≈ 지그재그(7~10%) ≈ 올리브영(7%) > 쿠팡(3%) > 에이블리(2%)**. 네이버는 이미 가격 비교 3순위 판매처(§4.1)라 기존 네이버 listing을 그대로 수익화할 수 있고, 사전 심사 없이 본인 채널(블로그·SNS 제한 없음)을 등록하는 방식이라 **게재 허용 측면에서도 유리**하다. 남은 변수는 *각 프로그램이 가격비교 사이트 게재를 약관상 허용하는가* 하나뿐이다(§12.3). 쿠팡은 웹 게재가 명시 허용돼 확실하고, 네이버·올리브영·지그재그·에이블리는 **운영자가 각 사에 게재 허용 여부만 확인**하면 고수수료 판매처를 우선 연동할 수 있다.

### 12.3 약관 검증 결과 (2026-06 확인)

링크를 **수동 발급해 시트에 입력**하므로(§12.1) "자동 생성 API 없음"은 제약에서 제외한다. 남은 판단 기준은 **가격비교 사이트 게재 허용 여부**와 **게재 조건**뿐이다.

| 프로그램 | 가격비교 사이트 게재 | 비고 |
|---|---|---|
| 네이버 쇼핑 커넥트 | ◎ 본인 소유·운영 채널(블로그·SNS 등) 등록형, **사전 심사 없음** | 자체 운영 사이트를 채널로 등록 가능성 높음. 직접 5~20%로 매력적. 가격 수집(네이버 쇼핑 API)·판매처가 이미 3순위라 **연동 시너지 큼** |
| 쿠팡 파트너스 | ✅ 웹·앱·블로그 **명시 허용** | 수수료 고지 문구 필수. ⚠️ 단, **가격 수집**은 직접 크롤링 차단 대상이라 **검색 API(시간당 10회·상품 10개)로만** 수집(§4.1) — 링크 수동 입력과 별개 이슈 |
| 올리브영 큐레이터 | △ 블로그 포함 "본인이 활동하는 소셜 플랫폼" 허용 | 자체 운영 콘텐츠 사이트는 '블로그'로 볼 여지. **관련 콘텐츠 + 광고 고지 필수**, 정책 위반 사이트 금지. 추천/큐레이션 콘텐츠가 있는 페이지면 적합 |
| 지그재그 공유리워드 | △ 약관이 **"본인의 SNS 채널"** 전제 | 독립 웹사이트 게재가 명시 허용된 게 아님 → **게재 가능 여부만 사전 문의**. 가능하면 7~10%로 매력적 |
| 에이블리 크리에이터 | △ SNS 공유 전제 | 지그재그와 동일 쟁점 + 수수료 2%로 최저 → **후순위** |

**핵심 결론**: 링크 수동 입력으로 자동화 장벽은 해소됐다. 남은 "안 될 이유"는 **약관의 게재 허용 범위** 하나다 — 쿠팡은 웹 게재가 명시 허용돼 확실하고, **네이버 쇼핑 커넥트는 본인 채널 등록형·사전 심사 없음이라 자체 사이트 등록 가능성이 높으며**, 올리브영은 *콘텐츠 + 광고 고지*를 갖추면 블로그형으로 적합하고, 지그재그·에이블리는 약관이 "본인 SNS"를 전제로 해 **독립 가격비교 사이트 게재 가능 여부만 각 사에 확인**하면 된다. 확인 후 허용되면 **수수료 순(네이버·지그재그·올리브영 우선)**으로 연동하고, 불허 판매처는 **가격 비교에만 노출하고 제휴 수익은 제외**한다. (모든 페이지에 제휴 수수료 고지 문구 노출 — 공통 필수)

### 12.2 연동 원칙

- **어필리에이트**: `/go/[listingId]` 경유 → `affiliate_clicks` 기록 → 302 이동. 각 프로그램의 수수료 고지 문구를 푸터·상세에 노출. 제휴 링크가 없으면 일반 URL로 이동(가격 비교는 유지, 내부 warning).
- **클릭 로그 개인정보 최소화**: `product_id / listing_id / seller_code / page_path / referrer / clicked_at / 익명 session_id / user_agent_hash`만 저장. 이름·이메일·전화·원본 IP·로그인 계정은 저장 금지.
- **AdSense**: 콘텐츠 방해 없는 위치(리스트 중간/상세 하단). 게재 시점 = Cloudflare 이전 완료 후(§3.1).

---

## 13. 보안·법적 고려사항

- **시크릿**: API 키(쿠팡/네이버/구글 서비스 계정), Supabase service key, Discord 웹훅 URL, `REVALIDATE_SECRET`은 GitHub Actions Secrets에만. 클라이언트 번들 노출 금지.
- **DB 접근(RLS)**: 웹은 RLS 읽기 전용(active 제품/요약가만), 쓰기는 배치 service role만. `crawl_errors`·`affiliate_clicks`·`sheet_import_runs`는 public read 금지. `affiliate_clicks` insert는 서버 route에서만. `affiliate_url`은 서버 redirect에서만 노출.
- **크롤링**: robots.txt 존중, 공개 가격 정보만, 저작물 미복제, 제휴 약관 준수. 약관의 법적 판단은 별도 검토 권장.
- **가격 고지**: 수집 시각 표기, 실제 결제가 차이 가능성 안내.
- **환경변수**: `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `DISCORD_WEBHOOK_URL`, `REVALIDATE_SECRET`, `CRAWLER_USER_AGENT`, `COUPANG_ACCESS_KEY/SECRET_KEY`.

---

## 14. 비용 추정 (월)

| 항목 | MVP | 수익화 이후 |
|---|---|---|
| 호스팅 | 0원 (Vercel Hobby) | 0원 (Cloudflare) or $20 (Vercel Pro) |
| DB / 크론 / API | 0원 | 0원 (트래픽 급증 시 Supabase Pro $25) |
| 도메인 | ~1,300원 (연 1.5만 원 환산) | 동일 |
| **합계** | **월 ~1,300원** | **월 ~1,300원 또는 +$20** |

---

## 15. 개발 로드맵

| 단계 | 기간 | 산출물 |
|---|---|---|
| **0. 셋업** | 1주 | repo, Next.js+Tailwind 스캐폴드, Supabase 스키마, 시트 템플릿(6탭), Discord 웹훅 |
| **1. 파이프라인** | 2~3주 | 시트 동기화(sheet_import_runs), 쿠팡(API)·네이버(API+allowlist)·올리브영 어댑터, 기본가/혜택가 정규화, 헬스체크, cron |
| **2. 사용자 웹** | 2~3주 | 홈/카테고리/상세/랜딩, Viewty Score(3요소), SEO(JSON-LD·sitemap), `/go/` 집계, `/api/revalidate`. **OpenNext 호환성 사전 검증** |
| **3. 런칭** | 1주 | 디렉터파이 언급 제품 50개 수동 정리·입력, viewtypick.com 연결, Search Console, GA4 |
| **4. 수익화** | 런칭 후 | **Cloudflare 이전 실행**(검증 완료 후). 제휴 링크 **수동 입력**으로 연동 — 쿠팡(웹 허용 확정) + **네이버 쇼핑 커넥트·올리브영·지그재그(고수수료, 게재 허용 확인 후)**. AdSense 신청, 제휴 고지·개인정보 처리방침·이용약관 |
| **5. 확장** | 트래픽 확인 후 | 어드민 페이지, 화해·올영 뱃지 확장, **에이블리(저수수료·게재 허용 확인 후)**, 가격 추이 그래프 |

**MVP 의도적 제외**: 회원/로그인, 검색, 리뷰·댓글, 가격 알림 푸시, 에이블리, 브랜드 공식몰 가격 비교, 앱. (지그재그는 수수료가 높아 수익화 단계에서 우선 연동)

GitHub Actions cron 예시:
```yaml
on:
  schedule: [{ cron: "0 19 * * *" }]   # KST 04:00
  workflow_dispatch: {}
# steps: npm ci → npm run sheets:import → npm run crawler:sync (revalidate 포함)
```

---

## 16. 리스크 및 대응

| 리스크 | 대응 |
|---|---|
| 크롤링 차단 | API 우선, 일 1회 저빈도, 어댑터 격리(한 곳 실패가 전체 미영향), 실패 시 직전 가격 유지 |
| 페이지 구조 변경 | 헬스체크 즉시 알림 + 해당 판매처만 비교 제외(연속 3회→비노출), 서비스는 정상 유지 |
| 1+1 가격 오표기 → 신뢰 훼손 | parse_confidence 게이트: 불확실하면 미노출. 기본가/혜택가 분리로 오인 방지 |
| 조건부 혜택 오표시 | 쿠폰·앱·멤버십·카드 할인은 기본 최저가/구조화 데이터에서 제외, 조건부로만 표시 |
| 공식 판매처 검증 실패 | retailer_allowlist 수동 검증, 스토어명 불일치 시 가격 제외 + 알림 |
| 제휴 링크 누락 | affiliate_url 누락 시 일반 URL 사용 + 내부 warning, 제휴 가능 판매처는 필수 검증 |
| 공유리워드 약관 제약 | 올영·지그재그·에이블리는 앱 공유형 리워드 → 웹 게재 가능성 사전 확인, 불허 시 제휴 수익 제외(가격 비교만 유지) |
| 시트 데이터 오류 | sheet-import 유효성 검사, 오류 행 skip, Discord 알림, sheet_import_runs 기록 |
| Vercel Hobby 상업 제한 | 수익화 전 Cloudflare 이전(확정), OpenNext 호환성 Phase 2에서 사전 검증 |
| 크롤링 법적 이슈 | robots.txt 존중, 공개 가격만 수집, 저작물 미복제, 약관 별도 검토 |

---

## 17. 확정 사항 (2026-06-11)

| 항목 | 결정 |
|---|---|
| 도메인 | **viewtypick.com** 구매 예정 (가용 확인 완료) |
| 어필리에이트 네트워크 | 링크프라이스 검토 결과 대상 판매처 미제공 → **미채택**, 쿠팡 파트너스 + 크롤링 체계로 확정 |
| 호스팅 | 개발은 Vercel Hobby, **수익화 시 Cloudflare 이전** (1순위 Workers+OpenNext) |
| 가격 모델 | **기본 최저가 / 혜택 최저가 2트랙 + ml당 정규화**, 조건부 혜택 분리 표시 |
| 디렉터파이 제품 수집 | **수동 정리** (영상 자동화는 범위 외) |
| 개발 주체 | **운영자 직접 개발** |

---

## 18. 전체 설계서 병합 시 충돌·판단 항목 (2026-06-11 확정)

전체 설계서를 반영하며 기존 결정과 부딪힌 지점과 **사용자 확정 결과**.

1. **브랜드 공식몰 가격 비교** — **확정: 제외(정보 링크만)**. 사용자가 공식몰 구매 빈도가 낮고, 유지보수 비용·불명확한 가격 기준·낮은 제휴성도 근거. README §2.2도 정합성 수정 완료.
2. **네이버 수집 방식** — **확정: 병합**. 네이버 쇼핑 검색 API 1차 수집 + `retailer_allowlist`로 공식 스토어만 채택.
3. **가격 모델** — **확정: 둘 다 채택**. 기본가/혜택가 2트랙 + ml당 정규화.
4. **URL 구조** — **확정: 기존 유지** (`/c/`·`/skin/`·`/pick/`).
5. **Viewty Score** — **확정: 3요소**(50/35/15), `score_config`로 조정.
6. **셀렉터 위치** — **확정: 코드 유지**, 필요 시 DB 승격.
7. **제휴 우선순위** — **확정: 링크 수동 입력 전제로 수수료 순**. 링크를 시트에 직접 입력하므로 자동화는 무관(§12.1). **지그재그(7~10%)·올리브영(7%) 우선 → 쿠팡(3%) → 에이블리(2%)**. 단 올리브영·지그재그·에이블리는 *가격비교 사이트 게재 허용 여부*만 각 사 확인 후 연동(§12.3). 컬리는 조건 까다로워 제외.
8. **이상치/실패 임계** — **확정: 전체 설계서값**(±50%·1/2/3/5회 단계).
9. **crawl_logs 구조** — **확정: 분리**(`crawl_runs` + `crawl_errors`). 추가로 실패 항목은 `manual_overrides`로 **가격·프로모션 수동 주입** 가능(§4.4).
10. **신규 테이블/시트** — **확정: 도입**. `retailer_allowlist`, `manual_overrides`, `affiliate_clicks`, `sheet_import_runs`, `seo_pages`(선택).

### 남은 확인 사항 (To-Do)

제휴 링크는 **수동 입력**으로 확정(§12.1) → 자동 발급 검토 불필요. 운영자가 각 사에 **게재 허용 여부만 확인**:

- [ ] **네이버 쇼핑 커넥트**: 브랜드 커넥트 크리에이터 스페이스에 자체 운영 사이트를 채널로 등록 가능한지, 가격비교 콘텐츠 게재가 허용되는지 (사전 심사 없으나 채널 적격성 확인).
- [ ] **올리브영 큐레이터**: 자체 운영 큐레이션 웹사이트가 허용 '블로그/소셜 플랫폼'에 해당하는지 (콘텐츠 + 광고 고지 전제).
- [ ] **지그재그 공유리워드**: 본인 SNS 외 독립 웹사이트 게재 허용 여부 (허용 시 고수수료라 우선 연동).
- [ ] **에이블리 크리에이터**: 동일 (수수료 2%라 우선순위 낮음).
- [ ] **쿠팡 파트너스(기술)**: 시간당 10회·상품 10개 API 제한 하에서 50~100개 제품 일일 가격 갱신 스케줄 설계(단건 조회 분산). ※ 링크가 아닌 **가격 수집** 이슈.

> 허가받지 못한 판매처는 **가격 비교에만 노출하고 제휴 링크/수익은 제외**한다. 전 페이지 제휴 수수료 고지 문구 노출은 공통 필수.
