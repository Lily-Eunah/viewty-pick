# 페이지 로딩 성능 분석 및 개선안

작성일: 2026-06-30
대상: ViewtyPick 웹(Next.js 16 App Router + OpenNext → Cloudflare Workers)
증상: 전체 페이지(특히 SEO `/best/[slug]` 비교 페이지) 로딩이 매우 느림. 간헐적으로 "Worker is busy" 발생.

---

## 0. 한 줄 결론

**인크리멘털 캐시가 `"dummy"`(no-op)로 빌드되어 ISR/SSG가 런타임에서 완전히 무력화**되어 있다.
그 결과 `revalidate=3600`이 걸린 `/best` 페이지조차 **모든 요청마다 처음부터 풀 서버 렌더링**을 하고, 그 렌더 한 번이 *8개 테이블 전체 스캔 + 전 상품 동기 변환(O(N×L)) + 거대한 RSC 직렬화*를 수행한다. 캐시가 비용을 흡수하지 못하니 모든 페이지가 느리고, 동시 요청이 겹치면 isolate가 포화되어 "Worker is busy"가 난다.

가장 효과 큰 조치는 **① R2 인크리멘털 캐시 + KV 태그 캐시 연결(ISR 부활)** 과 **② 매 요청 풀-DB 렌더 비용 축소** 두 가지다.

---

## 1. 현재 렌더링/캐시 구성 (사실 확인)

### 1.1 인크리멘털 캐시가 꺼져 있다 (가장 중요)

빌드 산출물 `.open-next/.build/open-next.config.mjs`에서 `defineCloudflareConfig({})`가 인자 없이 호출되어, 아래처럼 모든 캐시 오버라이드가 기본값 `"dummy"`로 해석된다:

```js
function resolveIncrementalCache(value = "dummy") { ... }  // ← 인자 없음 → "dummy"
function resolveTagCache(value = "dummy")        { ... }
// 결과: incrementalCache: "dummy", tagCache: "dummy", queue: "dummy"
```

- `"dummy"` 캐시는 **읽기에 항상 미스, 쓰기는 버리는 no-op** 구현이다.
- 즉 Next의 ISR/SSG는 "프리렌더 결과를 인크리멘털 캐시에서 읽어 서빙"하는 구조인데, **읽을 캐시가 없으므로 매번 서버 렌더로 폴백**한다.
- 소스([open-next.config.ts](../open-next.config.ts))의 주석은 "default in-memory incremental cache를 쓴다"고 적혀 있으나 **실제 빌드 결과와 불일치**한다. 현재 어댑터에서 무설정 기본값은 in-memory가 아니라 `dummy`다.

### 1.2 캐시를 저장할 바인딩 자체가 없다

[wrangler.jsonc](../wrangler.jsonc)에는 `ASSETS` 바인딩만 있고 **R2 / KV / Durable Object 바인딩이 전혀 없다.** 그래서 설령 ISR을 켜고 싶어도 저장소가 없다. (`open-next.config.ts`의 "R2 + KV 태그 캐시는 다음 단계로 미룸" TODO가 아직 미해결 상태.)

### 1.3 페이지별 렌더 모드 현황

| 경로 | 선언 | 데이터 패치 | 실제 런타임 동작(현재) |
|---|---|---|---|
| `/` (홈) | 없음 | `getHomePageData()` → 전 상품 | 매 요청 동적 SSR (풀-DB) |
| `/c`, `/c/[category]` | 없음 | `getCategoryPageData()` → 전 상품 | 매 요청 동적 SSR (풀-DB) |
| `/search` | 없음(searchParams) | `getProducts()` → 전 상품 | 매 요청 동적 SSR (풀-DB) |
| `/skin/[type]/[category]` | 없음 | `getProducts()` → 전 상품 | 매 요청 동적 SSR (풀-DB) |
| `/best`, `/best/[slug]` | `revalidate=3600` + `generateStaticParams` | `getSeoPageData()` → 전 상품 | **ISR 의도였으나 dummy 캐시로 매 요청 SSR** |
| `/p/[slug]` | 없음 | `getProductDetailPageData()`(scoped) | 매 요청 동적 SSR (범위 한정) |
| `/pick`, `/pick/[badge]/[category]` | 없음 | `/pick`은 정적, 하위는 전 상품 | `/pick`만 정적 에셋, 나머지 SSR |

핵심: **`/best`는 캐시가 동작한다는 전제로 설계됐지만, 캐시가 dummy라 그 전제가 깨졌다.** 그래서 "SEO 페이지인데도 느리다"는 증상이 정확히 설명된다.

---

## 2. 근본 원인 분석 (영향 큰 순)

### C1. ISR/SSG 무력화 — 매 요청 풀 렌더 (영향: 최상)

위 1.1 그대로. `revalidate`와 `generateStaticParams`가 적힌 `/best`도 캐시 미스로 100% SSR된다. 빌드 시 프리렌더한 HTML은 dummy 캐시에 저장돼 서빙되지 못한다. **캐시 히트율 ≈ 0%** 이 모든 느림의 증폭기다.

### C2. 한 렌더 = 8개 테이블 전체 스캔 (영향: 상)

[lib/queries/index.ts:360](../lib/queries/index.ts) `fetchAllData()`:

```ts
Promise.all([
  supabase.from('products').select('*').eq('is_active', true),
  supabase.from('listings').select('*').eq('is_active', true),
  supabase.from('current_prices').select('*'),          // ← 전량
  supabase.from('categories').select('*'),
  supabase.from('product_badges').select('*'),
  supabase.from('badges').select('*'),
  supabase.from('sellers').select(...),
  supabase.from('listing_prices_public').select('*'),    // ← 전량
])
```

홈/카테고리/검색/스킨/베스트 등 **거의 모든 리스트 페이지가 카탈로그 전체(8테이블 풀 셀렉트)를 가져온다.** `cache()`(React)는 *한 요청 안*에서만 중복 제거하므로 요청 간 재사용은 없다(C1 때문에 더더욱).

### C3. Edge ↔ Supabase 왕복 지연 (영향: 상)

Cloudflare Worker는 전 세계 엣지에서 실행되고, Supabase(PostgREST/HTTPS)는 단일 리전이다. 콜드 렌더마다 8개 쿼리가 **엣지 → Supabase 리전 왕복(RTT) + TLS/커넥션 비용**을 치른다. `Promise.all`로 병렬화돼도 가장 느린 쿼리 + 연결 셋업이 지배하고, 캐시가 없으니(C1) 이 비용을 **모든 요청이** 매번 지불한다. Supabase가 한국에서 먼 리전이면 체감 지연이 크게 증가한다.

### C4. 무거운 동기 CPU 변환 O(N×L), 그리고 `/best`는 2회 실행 (영향: 중상)

[mapToUIProduct](../lib/queries/index.ts) 는 상품마다 다음을 수행한다:

- `dbListings.filter(...)` 안에서 `dbSellers.find(...)` (중첩 선형 탐색)
- `prodListings.map(...)` 안에서 매번 `dbSellers.find` + `dbListingPrices.find`
- `dbCategories.find`, `dbProductBadges.filter`, 배지마다 `dbBadges.find`

전 상품 N개 × 리스팅 L개에 대해 사실상 **O(N×L)** 의 반복 선형 탐색 + 정렬이 한 요청 안에서 동기로 돈다(워커 단일 스레드를 그대로 점유). 상품 ~94개 + 수백 개 리스팅 규모에서 수만~수십만 연산.

추가로 **`/best/[slug]`는 `generateMetadata`와 페이지 본문이 각각 `getSeoPageData()`를 호출**한다([app/best/[slug]/page.tsx:44](../app/best/%5Bslug%5D/page.tsx), [:67](../app/best/%5Bslug%5D/page.tsx)). DB 패치는 `fetchAllData`의 `cache()` 덕에 공유되지만, **`getProducts()`의 전 상품 매핑과 `matchSeoProducts()`는 cache 미적용이라 한 요청에 2번 실행**된다. CPU 비용이 그대로 2배.

### C5. 쓰지도 않는 `current_prices`를 매번 풀 패치 (영향: 중)

`fetchAllData`가 `current_prices`를 전량 가져와 `dbPrices`로 넘기지만, [mapToUIProduct](../lib/queries/index.ts)는 이 인자를 **한 번도 참조하지 않는다**(파라미터로만 전달). 매 렌더마다 풀 테이블 쿼리 1개 + 직렬화 비용이 순수 낭비다.

### C6. 홈이 전 상품을 클라이언트로 직렬화 (영향: 중)

[app/page.tsx:8](../app/page.tsx)에서 `allProducts`(stores 배열까지 포함한 전체 카탈로그)를 그대로 클라이언트 컴포넌트 [HomeInteractiveSection](../components/home/HomeInteractiveSection.tsx)에 prop으로 넘긴다. 이 데이터는 RSC 페이로드/HTML에 통째로 실려 전송되고 클라이언트에서 하이드레이션된다. 실제로 클라가 쓰는 건 "스킨타입 재필터"용 일부 필드뿐인데 전량을 보낸다 → **전송 바이트 + 파싱/하이드레이션 비용(특히 모바일 TTI) 증가.**

### C7. 리스트 페이지에 `revalidate` 자체가 없음 (영향: 중)

홈/`/c`/`/search`/`/skin`은 ISR 선언조차 없다. C1을 해결(캐시 연결)하더라도 이 페이지들은 여전히 동적이라 캐시 대상이 안 된다. ISR로 전환해야 캐시 효과를 받는다.

---

## 3. 개선 방안 (우선순위 / 효과 / 난이도)

> 효과 추정은 "콜드 렌더 1회 비용을 얼마나 줄이거나 회피하는가" 기준.

### P0 — 인크리멘털 캐시 실연결로 ISR 부활 (효과: 최상 / 난이도: 중, 운영 작업 필요)

1. R2 버킷 + KV 네임스페이스(태그 캐시)를 프로비저닝하고 [wrangler.jsonc](../wrangler.jsonc)에 바인딩 추가.
2. [open-next.config.ts](../open-next.config.ts)를 R2 인크리멘털 캐시 + KV 태그 캐시 + (선택) 캐시 인터셉션으로 설정:

   ```ts
   import { defineCloudflareConfig } from "@opennextjs/cloudflare";
   import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
   import kvTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-tag-cache";

   export default defineCloudflareConfig({
     incrementalCache: r2IncrementalCache,
     tagCache: kvTagCache,
     enableCacheInterception: true, // 캐시 히트 시 풀 라우트 핸들러 건너뜀
   });
   ```
   (정확한 import 경로/옵션은 설치된 `@opennextjs/cloudflare` 버전 문서로 최종 확인.)

3. 효과: `/best`, `/pick/*`, 그리고 P0-②로 ISR 전환할 리스트 페이지가 **캐시 히트 시 DB·CPU 0** 으로 즉시 응답. revalidate 윈도우 안에서는 풀 렌더가 사라진다. "Worker is busy"의 주원인(동시 요청이 한 isolate에 풀 렌더를 쌓는 것)도 함께 완화된다.

### P0 — 리스트 페이지를 ISR로 전환 (효과: 상 / 난이도: 하)

홈/`/c`/`/c/[category]`/`/skin/[type]/[category]`/`/pick/[badge]/[category]`에 `export const revalidate = 600`(예: 10분) 추가. 크롤러가 하루 1회 갱신이므로 신선도 손해는 거의 없다. (P0-① 캐시 연결과 짝으로 동작해야 실효.)
- `/search`는 `searchParams`(`q`)를 읽어 동적 강제 — 단, 서버는 `q`를 안 쓰고 클라 필터만 하므로([app/search/page.tsx:27](../app/search/page.tsx)) `searchParams` 의존 제거 또는 데이터 패치를 캐시 함수로 분리하면 ISR 가능.

### P1 — 렌더 1회 비용 자체 축소 (효과: 상 / 난이도: 중)

캐시 미스(첫 요청·revalidate 시점)에도 빨라지도록 렌더 비용을 줄인다.

1. **불필요 패치 제거(C5):** `fetchAllData`에서 `current_prices` 쿼리와 `dbPrices` 인자 경로를 삭제. 즉시 적용 가능, 무위험.
2. **`select('*')` → 필요한 컬럼만** 지정. 전송/파싱 바이트 감소.
3. **`getProducts()`/`getSeoPageData()`를 `cache()`로 감싸기**(C4): `/best`의 매핑·매칭 2회 실행을 1회로. `getProductDetailPageData`처럼 동일 패턴.
4. **O(N×L) → O(N+L) 인덱싱(C4):** `mapToUIProduct` 진입 전에 `Map`을 한 번 구성
   (`listingsByProduct`, `sellersById`, `lpByListingId`, `badgesById`, `pBadgesByProduct`, `categoriesById`)하고 내부 `.find/.filter`를 Map 조회로 교체. 캐시 미스 렌더의 CPU를 크게 절감.

### P1 — DB 왕복 자체 줄이기 (효과: 중상 / 난이도: 중)

8개 쿼리를 **단일 Postgres RPC/뷰**로 합쳐 한 번의 왕복으로 "리스트에 필요한 형태"를 받으면 C3의 RTT·연결 비용이 8→1로 준다. 또는 카테고리/배지/셀러 같은 **거의 불변 데이터는 별도 장수명 캐시**(예: `unstable_cache`/`"use cache"` + 긴 revalidate)로 분리.

### P2 — 클라이언트 페이로드 축소 (효과: 중 / 난이도: 중)

- 홈의 `allProducts` 전량 전달(C6)을 **클라가 실제 쓰는 필드만 추린 경량 배열**로 축소하거나, 스킨타입 재필터를 서버 액션/별도 라우트로 빼서 초기 페이로드에서 제거.
- 상품 리스트를 서버 컴포넌트로 렌더하고, 상호작용이 필요한 부분만 작은 클라이언트 컴포넌트로 분리해 하이드레이션 범위를 줄인다.

### P2 — 지역 지연 완화 (효과: 상황 의존 / 난이도: 중)

Supabase 리전이 한국 사용자 기준 멀다면, 캐시(P0)가 대부분 흡수하지만 캐시 미스 경로를 위해 리전 근접성·커넥션 재사용(Supabase 측 설정)을 점검.

---

## 4. 권장 적용 순서

1. **P1-①(current_prices 제거)** — 무위험·즉시. 작은 회귀 테스트로 바로 머지.
2. **P0-①(R2+KV 캐시 연결)** + **P0-②(리스트 페이지 revalidate)** — 한 PR 묶음. 가장 큰 체감 개선. 운영자가 R2/KV 프로비저닝 + 바인딩 필요.
3. **P1-③(getProducts/getSeoPageData cache())**, **P1-④(Map 인덱싱)** — 캐시 미스 경로 가속.
4. **P1-⑤(RPC/뷰 통합)**, **P2(페이로드/리전)** — 추가 여력 시.

---

## 5. 개선 효과 검증 방법

- **캐시 동작 확인:** 동일 `/best/[slug]` 2회 연속 요청 후 응답 헤더의 캐시 상태(예: `x-opennext-cache: HIT/MISS`/Age) 및 응답 시간 비교. HIT에서 수십 ms대면 정상.
- **렌더 비용:** Cloudflare 대시보드 Observability(이미 `observability.enabled=true`)에서 Worker **CPU time / wall time / subrequest 수**를 배포 전후 비교.
- **DB 부하:** Supabase 로그에서 페이지뷰당 쿼리 수가 8→(RPC 통합 시)1로 줄었는지, 풀스캔이 사라졌는지 확인.
- **프론트:** Lighthouse/WebPageTest로 TTFB·LCP·TBT, RSC 페이로드 바이트(홈) 전후 비교.
- **부하 시:** 동시 요청을 준 상태에서 "Worker is busy" 재현 여부 — 캐시 연결 후 사라져야 한다.

---

## 6. 부록 — 근거 파일 위치

- 캐시 무력화 근거: `.open-next/.build/open-next.config.mjs` (`incrementalCache: "dummy"`), [open-next.config.ts](../open-next.config.ts), [wrangler.jsonc](../wrangler.jsonc) (R2/KV 바인딩 없음)
- 풀-DB 패치: [lib/queries/index.ts](../lib/queries/index.ts) `fetchAllData` (≈360행~)
- 미사용 `current_prices`: [lib/queries/index.ts](../lib/queries/index.ts) `mapToUIProduct` 인자 `dbPrices`
- `/best` 이중 호출: [app/best/[slug]/page.tsx](../app/best/%5Bslug%5D/page.tsx) `generateMetadata`(44행) + `BestPage`(67행)
- SEO 매칭: [lib/seo/match.ts](../lib/seo/match.ts) `matchSeoProducts`
- 홈 전량 직렬화: [app/page.tsx](../app/page.tsx), [components/home/HomeInteractiveSection.tsx](../components/home/HomeInteractiveSection.tsx)
</content>
</invoke>
