# ViewtyPick 구현 계획서 (Implementation Plan)

> 기준 문서: `DESIGN.md` v3.5 · `README.md` · `docs/uiux/UI_DESIGN.md` · `docs/uiux/UI_PROMPT.md` · `docs/uiux/Figma_UI.png`
> 범위: **MVP (Phase 0~3)** — 셋업 · 가격 파이프라인 · 사용자 웹 · 런칭
> 대상 독자: 운영자 본인 + 구현 에이전트(Claude)
> 작성일: 2026-06-11
>
> 본 문서는 "무엇을 만들지(DESIGN.md)"와 "어떻게 보일지(UI_DESIGN.md)"를 **실제 구현 단계·파일·커밋 단위**로 변환한 작업 지시서다. 단계 순서대로 따라가면 그대로 구현된다.

---

## 0. 먼저 읽기 — 소스 문서 4종의 역할과 충돌 해소

프로젝트에는 성격이 다른 문서 4종이 있고 일부가 서로 충돌한다. **구현 시 아래 우선순위로 판단한다.**

| 문서 | 역할 | 권위(authoritative) 범위 |
|---|---|---|
| `DESIGN.md` | 서비스/시스템 아키텍처 | **스택·DB·파이프라인·라우팅·수익모델 = 최우선** |
| `README.md` | 서비스 정의·가치 | 제품 정책·판매처 정책 |
| `docs/uiux/UI_DESIGN.md` | 비주얼 디자인 시스템 | **컬러·타이포·컴포넌트·화면 레이아웃 = 최우선** |
| `docs/uiux/UI_PROMPT.md` | UI 구현 프롬프트(초안) | 화면별 문구·컴포넌트 분해·커밋 워크플로 (단, 스택 제안은 아래 §0.1 참조) |

### 0.1 충돌 항목과 확정 결정

| # | 충돌 | DESIGN.md | UI_PROMPT.md | **확정 결정 (근거)** |
|---|---|---|---|---|
| C1 | 프레임워크 | **Next.js App Router (SSG/ISR) 확정** | — | **Next.js App Router 확정 (사용자 확정 2026-06-11).** DESIGN 설계 원칙 #3(SEO 우선·크롤러가 완성 HTML 수신)에 따라 SSG/ISR 필수. UI_PROMPT의 컴포넌트 분해·화면 문구·커밋 절차만 참고하고 코드는 Next.js·서버 컴포넌트로 구현 (§3·§5) |
| C2 | 브랜드명 | **ViewtyPick** / viewtypick.com | (구) ViewtyDeal | **ViewtyPick 확정 (사용자 확정 2026-06-11).** "ViewtyDeal"은 이전 이름 — 코드·메타·로고·문서 전부 ViewtyPick으로 통일 |
| C3 | 라우트 | `/c/`·`/p/`·`/pick/`·`/skin/` | `/category/`·`/product/`·`/guide/` | **DESIGN 라우트 채택** (DESIGN §9에서 slug 충돌 회피 근거 명시). UI 화면은 §5 매핑표로 1:1 대응 |
| C4 | 데이터 | 실데이터(Supabase + 크롤링) | mock data | **단계 분리.** Phase 2 UI 초기 개발은 mock으로 빠르게, 이후 동일 인터페이스로 Supabase 연동. mock↔실데이터 타입을 일치시켜 교체 비용 0 (§5.4) |
| C5 | 검색·관심상품 | **MVP 제외** | 화면 포함 | **확정: 탭바에 "준비 중" 비활성으로 노출 (사용자 확정 2026-06-11).** 기능·라우트는 Phase 5. 컴포넌트는 미리 작성 (§5.3) |
| C6 | 가격비교 판매처 | **컬리 제외** | UI 예시에 "컬리" 등장 | **컬리 미노출.** UI mock·예시의 컬리는 네이버 등 허용 판매처로 교체 (§5.4) |

> **핵심 한 줄**: *아키텍처와 라우팅은 DESIGN.md, 픽셀과 컴포넌트는 UI_DESIGN.md를 따른다. UI_PROMPT.md는 화면 문구·컴포넌트 분해·커밋 절차의 참고서로 쓰며, 스택은 Next.js App Router로 통일한다.*

---

## 1. 목표 산출물 (Definition of Done — MVP)

Phase 0~3 완료 시점에 아래가 동작해야 한다.

1. `viewtypick.com`에서 모바일 우선 정적 사이트가 뜨고, 홈·카테고리·제품상세·SEO 랜딩이 UI_DESIGN.md 비주얼대로 렌더링된다.
2. Google Sheets에 제품/링크/뱃지를 입력하면 매일 04:00 KST 자동으로 Supabase에 반영되고, 쿠팡·네이버·올리브영 가격이 수집되어 기본가/혜택가/ml당 가격이 계산된다.
3. 파싱 불확실·이상치 가격은 비교에서 제외되고 Discord로 알림이 온다.
4. 크롤링 완료 후 변경 페이지가 자동 재생성(ISR revalidate)되어 신선한 가격이 노출된다.
5. `/go/[listingId]` 클릭이 집계되고 판매처로 리다이렉트된다.
6. Search Console·GA4 연결, sitemap/robots/JSON-LD 동작, 디렉터파이 제품 50개 이상 입력 완료.

수익화(Cloudflare 이전·제휴/AdSense)는 Phase 4이며 본 계획의 범위 밖(요약만 §10).

---

## 2. 저장소 구조 (모노레포 단일 패키지)

```
viewty-pick/
├─ DESIGN.md  README.md
├─ docs/
│  ├─ IMPLEMENTATION.md          # 본 문서
│  └─ uiux/ (UI_DESIGN.md, UI_PROMPT.md, Figma_UI.png)
├─ app/                          # Next.js App Router
│  ├─ layout.tsx                 # 루트 레이아웃 (폰트·전역 CSS·모바일 프레임)
│  ├─ globals.css                # 디자인 토큰(CSS 변수) + Tailwind
│  ├─ page.tsx                   # 홈 (/)
│  ├─ c/[category]/page.tsx      # 카테고리 리스트
│  ├─ p/[slug]/page.tsx          # 제품 상세
│  ├─ pick/[badge]/[category]/page.tsx   # SEO 랜딩(큐레이션)
│  ├─ skin/[type]/[category]/page.tsx    # SEO 랜딩(피부고민)
│  ├─ go/[listingId]/route.ts    # 클릭 집계 후 302
│  ├─ api/revalidate/route.ts    # on-demand ISR
│  ├─ sitemap.ts  robots.ts      # 동적 생성
│  └─ (admin)/admin/status/page.tsx      # Phase 1.5 읽기전용 상태(Basic Auth)
├─ components/
│  ├─ layout/   (AppShell, BottomTabBar, Header)
│  ├─ common/   (Button, Badge, Chip, SearchBar, PriceText, ProductImage)
│  ├─ product/  (ProductCard, ProductListCard, ProductCarousel,
│  │            StorePriceCard, RecommendationReasonBox, PriceTable)
│  └─ seo/      (JsonLd, Faq, RelatedLinks)
├─ lib/
│  ├─ supabase/ (client.ts=anon/RLS, server.ts=service role)
│  ├─ queries/  (제품/카테고리/요약가 읽기 쿼리 — 서버 컴포넌트 전용)
│  ├─ format.ts (won(), perMl(), priceDrop() 등)
│  └─ types.ts  (Product, Listing, PriceSummary … DB와 1:1)
├─ crawler/                      # GitHub Actions에서 실행 (DESIGN §4.2)
│  ├─ run.ts
│  ├─ sheets/   (import.ts, validate.ts)
│  ├─ adapters/ (coupang.ts, naver.ts, oliveyoung.ts, zigzag.ts*, ably.ts*)
│  └─ core/     (normalize.ts, healthcheck.ts, score.ts, revalidate.ts, notify.ts)
├─ supabase/migrations/          # SQL 마이그레이션 (§4)
├─ scripts/                      # seed, mock 생성
├─ .github/workflows/crawl.yml   # cron
├─ tailwind.config.ts  next.config.mjs  tsconfig.json
└─ .env.example
```
`*` = Phase 5 (지그재그/에이블리).

> **OpenNext 호환 원칙(DESIGN §3.1)**: 처음부터 Cloudflare Workers+OpenNext에서 동작하는 기능만 사용한다. App Router·Route Handler·ISR·on-demand revalidation·next/image는 Phase 2 종료 전 OpenNext에서 빌드/동작 검증한다. 비호환 기능(예: 특정 Node 런타임 API)은 도입 금지.

---

## 3. 기술 스택 확정

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 14+ App Router, TypeScript | SSG/ISR, 서버 컴포넌트 기본 |
| 스타일 | Tailwind CSS + CSS 변수 토큰 | UI_DESIGN §1 팔레트를 그대로 토큰화 |
| 폰트 | Pretendard (서브셋, next/font local) | CWV·한글 최적화 |
| DB | Supabase (Postgres) | anon+RLS 읽기 / service role 쓰기 |
| 데이터 입력 | Google Sheets (6탭) → sheet-import | single source of truth (MVP) |
| 크롤링 | Playwright(올영) + 쿠팡/네이버 API | 어댑터 패턴 |
| 스케줄 | GitHub Actions cron (04:00 KST) | 무료 |
| 알림 | Discord 웹훅 | 즉시+일일요약 |
| 분석 | GA4 + Search Console | 무료 |
| 호스팅 | Vercel Hobby(개발) → Cloudflare(수익화) | DESIGN §3.1 |
| 배포 검증 | OpenNext 빌드 테스트 | Phase 2 |

권장 버전 핀(설치 시점 최신 LTS 확인 권장): Next 14.x, React 18, Tailwind 3.4, @supabase/supabase-js 2.x, playwright 1.4x, tsx(크롤러 실행), zod(검증).

---

## 4. 데이터 모델 구현 (Supabase / Postgres)

DESIGN §5의 스키마를 마이그레이션으로 작성한다. `supabase/migrations/0001_init.sql` 핵심 골격:

```sql
-- 마스터
create table categories (id bigint generated always as identity primary key,
  slug text unique not null, name text not null, sort_order int default 0);

create table sellers (id bigint generated always as identity primary key,
  slug text unique not null, name text not null, priority int,
  collect_method text check (collect_method in ('api','crawl')),
  is_affiliate_supported bool default false,
  is_price_comparison_enabled bool default true,   -- 브랜드 공식몰 = false
  is_trusted bool default true);

create table products (id bigint generated always as identity primary key,
  slug text unique not null, product_key text unique not null,
  name text not null, brand text, category_id bigint references categories(id),
  volume_ml numeric, image_url text, features text,
  skin_types text[] default '{}',
  hwahae_url text, official_info_url text,
  viewty_score numeric default 0,
  source text default 'sheet', is_active bool default true);

create table badges (id bigint generated always as identity primary key,
  slug text unique not null, name text not null);
create table product_badges (product_id bigint references products(id),
  badge_id bigint references badges(id), detail text,
  source_title text, ref_url text, source_date date,
  primary key (product_id, badge_id));

create table listings (id bigint generated always as identity primary key,
  link_key text unique not null,
  product_id bigint references products(id),
  seller_id bigint references sellers(id),
  url text not null, affiliate_url text, store_name text,
  is_official_store bool default false, is_rocket bool default false,
  crawl_enabled bool default true,
  crawl_method text check (crawl_method in ('api','html','playwright','manual')),
  last_crawled_at timestamptz, fail_count int default 0, is_active bool default true);

create table retailer_allowlist (id bigint generated always as identity primary key,
  seller_id bigint references sellers(id), brand text,
  allowed_store_name text, is_active bool default true);

-- 가격
create table price_snapshots (id bigint generated always as identity primary key,
  listing_id bigint references listings(id), product_id bigint references products(id),
  crawled_at timestamptz default now(),
  regular_price int, sale_price int, base_unit_price int,
  promo_type text, promo_text text,
  min_quantity int, paid_quantity int, free_quantity int, total_quantity int,
  total_ml numeric, unit_price numeric, effective_unit_price int,
  in_stock bool default true, source_text text,
  parse_confidence text check (parse_confidence in ('high','low')) default 'high',
  status text check (status in ('ok','warning','failed')) default 'ok');

create table current_prices (product_id bigint primary key references products(id),
  base_lowest_price int, base_lowest_seller text, base_lowest_listing_id bigint,
  promo_lowest_unit_price int, promo_lowest_seller text, promo_label text,
  has_promotion bool default false, last_checked_at timestamptz, updated_at timestamptz default now());

create table manual_overrides (id bigint generated always as identity primary key,
  product_id bigint references products(id), seller_id bigint references sellers(id),
  override_type text, value text, reason text,
  expires_at timestamptz, is_active bool default true);

-- 로그/집계
create table affiliate_clicks (id bigint generated always as identity primary key,
  product_id bigint, listing_id bigint, seller_code text,
  clicked_at timestamptz default now(), referrer text, page_path text,
  user_agent_hash text, session_id text);   -- 개인정보 미저장

create table crawl_runs (id bigint generated always as identity primary key,
  started_at timestamptz, finished_at timestamptz, status text,
  total_links int, success_count int, warning_count int, failure_count int, summary jsonb);
create table crawl_errors (id bigint generated always as identity primary key,
  crawl_run_id bigint references crawl_runs(id), product_id bigint, listing_id bigint,
  seller_code text, error_type text,
  severity text check (severity in ('info','warning','critical')), message text,
  raw_context jsonb, created_at timestamptz default now());
create table sheet_import_runs (id bigint generated always as identity primary key,
  started_at timestamptz, finished_at timestamptz, status text,
  products_count int, links_count int, badges_count int, error_count int, summary jsonb);

create table seo_pages (id bigint generated always as identity primary key,
  slug text unique not null, page_type text, title text, h1 text, description text,
  category text, skin_type text, badge_type text, is_active bool default true);

create table score_config (key text primary key, value numeric);
```

### 4.1 RLS (보안 — DESIGN §13)
`0002_rls.sql`:
- 모든 테이블 `enable row level security`.
- **public(anon) read 허용**: `products(is_active)`, `categories`, `sellers`, `badges`, `product_badges`, `current_prices`, `listings(is_active)`, `seo_pages(is_active)`.
- **public read 금지**: `price_snapshots`, `crawl_runs`, `crawl_errors`, `affiliate_clicks`, `sheet_import_runs`, `manual_overrides`, `retailer_allowlist`.
- **쓰기**: 전부 service role 전용(배치). `affiliate_clicks` insert는 서버 Route Handler에서 service role로만.
- `affiliate_url`은 클라이언트로 내려보내지 않고 `/go/[listingId]` 서버 리다이렉트에서만 사용.

### 4.2 score_config 시드
DESIGN §8 가중치를 행으로 시드: `directorpi=25, hwahae_rank=15, oliveyoung_best=15, multi_source=10, perml_top30=15, base_below_avg10=10, has_effective=5, price_drop_7d=5, seller_oliveyoung=5, seller_coupang=5, seller_naver=5, sellers_3plus=5`.

---

## 5. 라우팅 · 화면 · 디자인 시스템

### 5.1 디자인 토큰 → Tailwind (UI_DESIGN §1 그대로)
`app/globals.css`에 CSS 변수 정의 + `tailwind.config.ts`에서 `theme.extend.colors`로 매핑한다.

```css
:root{
  --primary:#6B8A47; --primary-dark:#4F6A34; --primary-light:#EDF3E6;
  --accent:#F6C915; --accent-light:#FFF6CF;
  --background:#F8F6EE; --background-warm:#EAE3C0; --surface:#FFFFFF;
  --price:#E05D44; --price-bg:#FFF0EA;
  --title:#1F241A; --body:#4A4A42; --sub:#8A8778; --border:#E4E0D2;
}
```
```ts
// tailwind.config.ts (발췌)
colors:{
  primary:{DEFAULT:'var(--primary)',dark:'var(--primary-dark)',light:'var(--primary-light)'},
  accent:{DEFAULT:'var(--accent)',light:'var(--accent-light)'},
  bg:{DEFAULT:'var(--background)',warm:'var(--background-warm)'},
  surface:'var(--surface)', price:'var(--price)', 'price-bg':'var(--price-bg)',
  title:'var(--title)', body:'var(--body)', sub:'var(--sub)', line:'var(--border)',
},
borderRadius:{card:'20px','card-lg':'24px',btn:'16px',pill:'999px'},
```
규약 (UI_DESIGN §13): 페이지 배경 `bg`, Hero/SEO 상단 `bg-warm`, 카드 `surface`, CTA `primary-dark`, 가격 `price`, 신뢰 뱃지 `primary-light`, 혜택 뱃지 `accent-light`. **노란색 남용 금지** — accent는 "오늘의 최저가/혜택"에만.

### 5.2 레이아웃 프레임 (UI_DESIGN §3, UI_PROMPT §7)
`AppShell`: `max-w-[430px] mx-auto min-h-screen bg-bg`, 데스크톱에서 중앙 정렬된 모바일 프레임. 좌우 패딩 16px, 카드 라운드 18~24px, 하단 탭바 64~72px fixed. 활성 탭 `--primary`, 비활성 `#AAA697`.

### 5.3 UI 화면 → DESIGN 라우트 매핑 (충돌 C3·C5 해소)

| UI_DESIGN/PROMPT 화면 | UI 시안 경로 | **실제 구현 경로(DESIGN §9)** | 렌더링 | MVP |
|---|---|---|---|---|
| 홈 | `/` | `/` | ISR | ✅ |
| 카테고리 목록 | `/category/:slug` | `/c/[category]` | ISR | ✅ |
| 제품 상세 | `/product/:slug` | `/p/[slug]` | ISR | ✅ |
| SEO 랜딩(큐레이션) | `/guide/directorpi-sunscreen` | `/pick/[badge]/[category]` | SSG | ✅ |
| SEO 랜딩(피부고민) | `/sensitive-sunscreen` | `/skin/[type]/[category]` | SSG | ✅ |
| 클릭 리다이렉트 | — | `/go/[listingId]` | 302 | ✅ |
| 검색 | `/search` | (준비 중) | — | ⛔ Phase 5 |
| 관심상품 | `/wishlist` | (준비 중) | — | ⛔ Phase 5 |
| 마이 | — | (준비 중) | — | ⛔ Phase 5 |

- **하단 탭바**: 홈·카테고리는 활성. 검색·관심상품·마이는 **"준비 중" 비활성 상태로 노출**(탭은 보이되 탭하면 준비중 안내/무동작, 라우트 미연결). 기능·라우트는 Phase 5. UI 컴포넌트(SearchPage/WishlistPage)는 미리 작성해 두되 라우트에 연결하지 않는다.
- SEO 랜딩의 사람친화 slug(`directorpi-sunscreen`)는 `seo_pages` 또는 `/pick`·`/skin` 동적 파라미터로 매핑. 사용자 노출 URL은 DESIGN 접두형을 정식으로 하고, 가독 slug가 필요하면 `seo_pages.slug`로 별칭 라우트를 추가(rewrites).

### 5.4 컴포넌트 카탈로그 (UI_DESIGN §5·§11 + UI_PROMPT §10)

| 컴포넌트 | 출처 스펙 | 핵심 스타일 |
|---|---|---|
| `Button` (primary/secondary) | UI_DESIGN §11 | primary=`primary-dark` h54 r16 / secondary=`primary-light` 텍스트 `primary-dark` h46 r14 |
| `Badge` (trust/accent) | §5 §11 | trust=`primary-light`/`primary-dark` pill / accent=`accent-light`/`#7A5B00` pill |
| `PriceText` | §11 | `price` 컬러, 굵게, 원화 포맷 |
| `Chip` (skin/sort) | §4 §6 | 선택 전 흰배경+`border`, 선택 후 `primary` 흰글씨(피부) / `primary-light` `primary-dark`(정렬) |
| `SearchBar` | §4 | h48 흰배경 r16, 홈에선 클릭 시 `/search`(Phase 5 전엔 비활성) |
| `ProductImage` | UI_PROMPT §9 | 1:1, `#F5F3EA` 배경 placeholder(외부 이미지 무단사용 금지) |
| `ProductCard` (세로) | §5 | 이미지→추천뱃지→제품명→최저가→`가격비교 보기` |
| `ProductListCard` (가로) | §6 | 카테고리 리스트용, flex gap14 r18 |
| `ProductCarousel` | UI_PROMPT §8.1 | 추천 TOP 가로 스크롤 |
| `StorePriceCard` | §7 | 카드형 판매처 가격, 최저가만 `accent` 테두리+뱃지 |
| `PriceTable` | DESIGN §10 | 상세 판매처별 기본가/판매가/혜택/실질개당가/조건 |
| `RecommendationReasonBox` | §7 | `primary-light` 박스, "왜 추천되었나요?" 체크리스트 |
| `JsonLd`/`Faq`/`RelatedLinks` | DESIGN §11 | SEO 구조화 데이터·FAQ·내부링크 |

**정보 우선순위(UI_DESIGN §12)** — 카드: 이미지→추천출처→제품명→피부타입→최저가→버튼. 상세: 제품명→추천출처→최저가→구매CTA→추천이유→판매처비교→제품정보→외부링크.

**가격 표시 정합성(DESIGN §4.3·§11)** — 매우 중요:
- 화면 대표 최저가 = **기본 최저가(base)** 만. 1+1 실질개당가·쿠폰·앱가는 별도 행/뱃지로만.
- JSON-LD `AggregateOffer.lowPrice`도 **기본 최저가만** 사용(페이지에 안 보이는 가격 금지).
- `parse_confidence='low'`·이상치·상품 불일치 가격은 **표시/비교/구조화 데이터에서 모두 제외**.
- 쿠폰/멤버십/앱/카드 할인은 "조건부 혜택"으로만 표기, 최저가 계산 비포함.
- 컬리는 미노출(C6) — mock·예시의 컬리는 네이버 등으로 교체.
- 갱신 시각·"실제 결제가는 판매처 확인" 문구 상시 노출.

### 5.5 mock → 실데이터 교체 전략 (충돌 C4)
`lib/types.ts`의 타입을 **DB 컬럼과 1:1**로 정의하고, Phase 2 초기엔 `lib/queries/*`가 `scripts/mock/*.json`을 반환하다가, Supabase 준비 후 동일 함수가 `supabase` 쿼리로 바뀐다. 컴포넌트는 데이터 출처를 모른다 → 교체 비용 0.

---

## 6. 가격 수집 파이프라인 (DESIGN §4)

`crawler/`는 Next 앱과 같은 repo, 별도 entry. `npm run crawler:sync`로 GitHub Actions에서 실행.

### 6.1 어댑터 인터페이스
```ts
type RetailerCode='oliveyoung'|'coupang'|'naver'|'zigzag'|'ably';
interface RetailerAdapter{
  code:RetailerCode; requiresBrowser:boolean; supportsPromotionParsing:boolean;
  fetchOffer(link:Listing):Promise<PriceOffer>;   // 셀렉터는 어댑터 코드에 보관(DESIGN §6 판단)
}
```
- `coupang.ts`: 쿠팡 파트너스 API. **검색 API 시간당 10회·상품 10개 제한** → 단건 조회 분산 + 요청 간 지연으로 50~100제품 일일 갱신 스케줄 설계(DESIGN §18 To-Do).
- `naver.ts`: 네이버 쇼핑 검색 API(`lprice`, 일 25,000회) + `retailer_allowlist` 필터(스토어명 불일치 시 제외).
- `oliveyoung.ts`: Playwright, 1+1·2+1·올영세일 프로모션 파싱. robots 존중, 요청 간 2~5초 랜덤 지연.
- `zigzag.ts`/`ably.ts`: Phase 5.

### 6.2 실행 순서 (`run.ts` — DESIGN §2)
1. `sheets/import.ts` → 검증(`validate.ts`) → Supabase upsert → `sheet_import_runs` 기록, `is_active=false`는 비활성 처리.
2. `adapters/*` 병렬 `fetchOffer` (한 곳 실패 격리).
3. `core/normalize.ts`: 프로모션 정규식 추출 → `quantity`·`total_ml`·기본가/혜택가/ml당가 계산. 실패·모호 → `promo_type=unknown, parse_confidence=low` → 비교 제외 + 검수 알림. **active `manual_overrides`가 크롤링 결과를 덮어씀**.
4. `core/healthcheck.ts`: 404/410, 5xx/타임아웃/403, 가격필드 누락, ±50% 변동, <1,000원·정가<판매가·1+1가>기본가, 상품명 유사도, allowlist 불일치 점검. **연속 실패 1/2/3/5회 단계 처리**(직전가 유지→알림→비노출→수동점검).
5. `core/score.ts`: Viewty Score 재계산(`score_config` 가중치) → `products.viewty_score` 저장.
6. `core/revalidate.ts`: 변경된 `/p/[slug]`·`/c/...`·`/pick/...`·`/skin/...`·`/` on-demand revalidate(`/api/revalidate` 호출, `REVALIDATE_SECRET`).
7. `core/notify.ts`: Discord 즉시 알림(치명) + 일일 요약 1건(성공률·신규 이상·검수 대기).

### 6.3 cron (`.github/workflows/crawl.yml`)
```yaml
on:
  schedule: [{ cron: "0 19 * * *" }]   # UTC 19:00 = KST 04:00
  workflow_dispatch: {}
jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4 (node 20)
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run sheets:import
      - run: npm run crawler:sync          # normalize·healthcheck·score·revalidate·notify 포함
        env: { 모든 시크릿은 GitHub Secrets에서 주입 }
```

---

## 7. Phase별 작업 분해 + 의미 단위 커밋

> 작업 규칙(UI_PROMPT §0·§12·§14 준수): `main` 직접 커밋 금지, 작업 브랜치 사용. 각 커밋 전 `git status`·가능한 `lint/typecheck/build` 검증. `git reset --hard`·`clean -fd`·force push·원격 push 금지(사용자 요청 전까지). 검증 실패 상태 커밋 금지. Conventional Commits.
> 브랜치: 파이프라인/백엔드는 `feature/pipeline-mvp`, UI는 `feature/web-mvp`(또는 UI_PROMPT가 지정한 `feature/viewtypick-mobile-ui-mvp`).

### Phase 0 — 셋업 (약 1주)

| # | 작업 | 산출물 | 커밋 |
|---|---|---|---|
| 0.1 | Next.js+TS+Tailwind 스캐폴드, Pretendard, `globals.css` 토큰, `AppShell`/`BottomTabBar` 골격 | 빌드되는 빈 앱 | `chore: scaffold Next.js + Tailwind design tokens` |
| 0.2 | Supabase 프로젝트, `0001_init.sql`·`0002_rls.sql` 적용, `score_config` 시드 | 스키마 적용된 DB | `feat: add supabase schema and RLS` |
| 0.3 | Google Sheets 6탭 템플릿(products/product_links/badges/retailer_allowlist/manual_overrides/seo_pages) | 시트 + 샘플행 | `docs: add product sheet template` |
| 0.4 | Discord 웹훅 채널, `.env.example`, `lib/supabase/*` 클라이언트 | 연결 확인 | `chore: wire env, supabase clients, discord webhook` |

검증: `npm run build` 통과, anon 키로 빈 테이블 read 가능, service role write 가능.

### Phase 1 — 가격 파이프라인 (약 2~3주)

| # | 작업 | 커밋 |
|---|---|---|
| 1.1 | `lib/types.ts`(DB 1:1), `sheets/import.ts`+`validate.ts`(zod), `sheet_import_runs` | `feat: sheet import with validation` |
| 1.2 | 어댑터 패턴 + `coupang.ts`(API, 시간당 10회 분산 스케줄) | `feat: coupang partners adapter` |
| 1.3 | `naver.ts`(API + allowlist 필터) | `feat: naver shopping adapter with allowlist` |
| 1.4 | `oliveyoung.ts`(Playwright + 프로모션 파싱) | `feat: oliveyoung crawler with promotion parsing` |
| 1.5 | `core/normalize.ts`(기본가/혜택가/ml당, manual_overrides 적용) | `feat: price normalization (base/effective/per-ml)` |
| 1.6 | `core/healthcheck.ts`(이상치·연속실패 단계·allowlist) + `crawl_runs/errors` | `feat: healthcheck and anomaly gating` |
| 1.7 | `core/notify.ts`(즉시+일일요약) | `feat: discord alerting` |
| 1.8 | `run.ts` 오케스트레이션 + cron `crawl.yml` | `feat: orchestrate daily crawl via github actions` |

검증: 샘플 3제품으로 end-to-end 실행 → `current_prices` 채워짐, 의도적 이상치가 제외+알림, override가 크롤값 덮어쓰기. 어댑터 단위 테스트(고정 HTML/응답 fixture).

### Phase 2 — 사용자 웹 (약 2~3주)

| # | 작업 | 커밋 |
|---|---|---|
| 2.1 | mock data + `lib/queries/*`(인터페이스 고정), `lib/format.ts` | `feat: mock data layer and query interface` |
| 2.2 | 공통 컴포넌트(Button/Badge/Chip/SearchBar/PriceText/ProductImage) | `feat: shared UI components` |
| 2.3 | product 컴포넌트(ProductCard/ListCard/Carousel/StorePriceCard/PriceTable/ReasonBox) | `feat: product components` |
| 2.4 | 홈 `/` (헤더·Hero·피부칩·카테고리grid·추천TOP캐러셀·오늘 가격 좋은 제품) | `feat: home screen` |
| 2.5 | 카테고리 `/c/[category]`(피부필터·정렬칩·리스트카드) | `feat: category listing` |
| 2.6 | 제품 상세 `/p/[slug]`(가격영역·sticky CTA·추천이유·PriceTable·함께비교) | `feat: product detail` |
| 2.7 | SEO 랜딩 `/pick/[badge]/[category]`·`/skin/[type]/[category]`(Hero·TOP·기준설명·FAQ·관련링크) | `feat: SEO landing pages` |
| 2.8 | `/go/[listingId]`(클릭집계+302), `/api/revalidate` | `feat: click redirect and revalidate api` |
| 2.9 | SEO: 메타 템플릿·JSON-LD(Product/AggregateOffer·ItemList·BreadcrumbList)·`sitemap.ts`·`robots.ts` | `feat: SEO metadata and structured data` |
| 2.10 | queries를 mock→Supabase 전환 | `feat: connect web to supabase` |
| 2.11 | **OpenNext 빌드/동작 검증**(ISR·revalidate·image·route handler) | `chore: verify opennext compatibility` |
| 2.12 | Viewty Score 정렬 연동, `/admin/status`(Basic Auth, Phase 1.5) | `feat: score-based sorting and status page` |

검증: Lighthouse 모바일(CWV)·구조화 데이터 검사·`base` 가격만 노출 확인·`parse_confidence=low` 비노출 확인·컬리 미노출.

### Phase 3 — 런칭 (약 1주)

| # | 작업 | 커밋/액션 |
|---|---|---|
| 3.1 | 디렉터파이 언급 제품 50개+ 수동 정리·시트 입력(+ allowlist·뱃지) | 데이터 입력 |
| 3.2 | `viewtypick.com` 연결(Vercel), 환경변수 운영값 | 배포 |
| 3.3 | Search Console·sitemap 제출, GA4 설치 | 연동 |
| 3.4 | 가격 고지·캐노니컬·noindex(씬 조합) 점검, 전 페이지 갱신시각 문구 | `chore: launch readiness` |

검증: 실제 50제품 크롤 1사이클 성공, 색인 요청, 모바일 실기기 QA.

---

## 8. 환경변수 / 시크릿 (DESIGN §13)

`.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # 서버/배치 전용, 클라이언트 노출 금지
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SHEETS_SPREADSHEET_ID=
DISCORD_WEBHOOK_URL=
REVALIDATE_SECRET=
CRAWLER_USER_AGENT=
COUPANG_ACCESS_KEY=
COUPANG_SECRET_KEY=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```
운영 값은 **GitHub Actions Secrets**(크롤러) + **Vercel/Cloudflare 환경변수**(웹)에만. `SUPABASE_SERVICE_ROLE_KEY`·시크릿은 절대 클라이언트 번들에 포함 금지(서버 컴포넌트/Route Handler에서만 사용).

---

## 9. 검증 / 테스트 전략

- **타입/린트/빌드**: 각 커밋 전 `npm run lint && npm run typecheck && npm run build`.
- **어댑터 단위 테스트**: 고정 fixture(HTML·API 응답)로 파싱·정규화 회귀 방지 — 특히 1+1/2+1/ml 추출, 이상치 게이트.
- **데이터 정합성 자동 점검**(healthcheck가 곧 테스트): 노출 전 비교 제외 규칙이 작동하는지 의도적 불량 데이터로 검증.
- **SEO 검증**: Rich Results Test로 JSON-LD, Lighthouse로 CWV, 페이지에 보이지 않는 가격이 구조화 데이터에 없는지 수동 확인.
- **OpenNext 호환 검증**(Phase 2.11): 수익화 전 이전 비용 0 보장.
- **고위험 항목**(가격 신뢰)은 별도 리뷰: 잘못된 최저가 1건이 서비스 신뢰를 깬다(DESIGN 원칙 #4).

---

## 10. MVP 제외 & 다음 단계 (요약, Phase 4~5)

- **Phase 4 수익화**: Cloudflare 이전(Workers+OpenNext) → 제휴 링크 **수동 발급·시트 입력**(쿠팡 확정 + 네이버 쇼핑 커넥트·올리브영·지그재그는 게재 허용 확인 후) → AdSense → 제휴 고지·개인정보 처리방침·이용약관. 전 페이지 제휴 수수료 고지 필수.
- **Phase 5 확장**: Next.js 어드민(Supabase Auth)으로 시트 폐기, 검색·관심상품 라우트 활성, 에이블리·지그재그 어댑터, 화해/올영 뱃지 확장, 가격 추이 그래프.
- **MVP 의도적 제외**: 회원/로그인, 검색, 관심상품, 리뷰, 가격 알림 푸시, 브랜드 공식몰 가격비교, 앱.

---

## 11. 확정된 결정 & 사용자 준비 항목

**확정 (2026-06-11)**: 프레임워크 = **Next.js App Router** · 브랜드명 = **ViewtyPick** · 검색/관심상품 = **탭바에 "준비 중" 비활성 노출**(기능은 Phase 5).

**사용자가 준비/검토 중인 항목**:

1. **계정·키 준비**: Supabase 프로젝트, Google 서비스 계정+시트 공유, Discord 웹훅, 쿠팡 파트너스 키, 네이버 개발자 앱(쇼핑 검색 API), GitHub repo Secrets.
2. **제휴 게재 허용 확인(DESIGN §12.3 / §18 To-Do)**: 네이버 쇼핑 커넥트·올리브영·지그재그·에이블리 — Phase 4 전까지 운영자가 각 사 확인. 미허용 판매처는 가격비교만, 제휴 수익 제외.
3. **쿠팡 가격 수집 방식(DESIGN §18)**: ① 파트너스 검색 API(시간당 10회·상품 10개) 단건 분산 스케줄, 또는 ② 자동 크롤링. **단, 쿠팡은 직접 크롤링 차단이 강해(DESIGN §4.1) 차단·안정성 리스크가 크다** → API 분산 스케줄을 1순위로 권장하고, 자동 크롤링은 차단 시 폴백으로 둔다. 결정에 따라 `coupang.ts` 어댑터 구현이 분기된다.

---

### 부록 A. 커밋 순서 요약(빠른 참조)
Phase0: scaffold → schema/RLS → sheet template → env/clients.
Phase1: sheet import → coupang → naver → oliveyoung → normalize → healthcheck → notify → orchestrate/cron.
Phase2: mock/query → common comp → product comp → home → category → detail → SEO landing → go/revalidate → SEO meta → connect supabase → opennext verify → score/status.
Phase3: seed 50 products → domain → search console/GA4 → launch readiness.
