# 부하 개선 통합 실행 계획 (페이지별)

작성일: 2026-06-30
대상: 홈 `/` · SEO `/best`,`/best/[slug]` · 카테고리 `/c`,`/c/[category]` · 제품카드 · 상세 `/p/[slug]`
근거: [performance-analysis.md](performance-analysis.md)(진단) · [rendering-architecture-proposal.md](rendering-architecture-proposal.md)(방향)

---

## 0. 한 장 요약

부하의 근원은 두 가지다:
1. **캐시가 dummy** → ISR 무력화 → 모든 페이지가 매 요청 풀 SSR.
2. **리스트/SEO/홈이 카드 한 줄 위해 전 상품 가격을 매번 풀로 계산**(O(N×L)). 정작 가격이 진짜 필요한 **상세 페이지는 이미 그 제품 1개만 scoped로** 잘 가져온다.

개선 원칙:
- **A. 캐시를 실제로 켠다**(R2+KV) — 모든 개선의 전제.
- **B. 가격 계산을 "상세 페이지" 한 곳으로 모은다** — 홈·리스트·SEO는 제품 메타데이터만 쓰는 (거의) 정적 페이지로.
- **C. 갱신 주기를 데이터에 맞춘다** — 제품(드묾)=온디맨드 재생성, 가격(일간)=상세만 일 1회.

| 페이지 | 지금 | 목표 | 카드 가격 표시 | 재생성 주기 |
|---|---|---|---|---|
| 홈 `/` | 동적·전 상품+전량 직렬화 | ISR·경량 | ✅ **최저가 + 할인율** | 가격 일 1회 + 제품 변경 시 |
| `/best`,`/best/[slug]` | ISR 죽음·이중매핑 | ISR(부활)·경량 | ✅ **최저가 + 할인율** (공유 캐시라 부담 없음) | 가격 일 1회 + 제품 변경 시 |
| `/c`,`/c/[category]` | 동적·전 상품+클라 가격정렬 | ISR·경량 | ✅ **최저가 + 할인율** (3정렬 유지) | 가격 일 1회 + 제품 변경 시 |
| 제품카드 컴포넌트 | 가격·할인·비교 표시 | **최저가+할인율 유지**(비교 태그라인만 정리) | ✅ 전 페이지 | — |
| 상세 `/p/[slug]` | 동적·scoped(이미 효율적) | ISR 일1회 | ✅ 풀 비교(단일 책임) | 가격 일 1회 |

> **확정 결정(2026-06-30, 갱신):** 전 상품 최저가+할인율을 **전역에서 하루 1번만 계산**해 공유 데이터 캐시에 둔다(§6). 따라서 카드 가격은 **`/best`(SEO) 포함 전 페이지에서 표시**한다 — "가격 없는 SEO" 특수화는 폐기. 할인율은 `products.regular_price`(시트)+최저가로 산출. 배포는 **ISR + 온디맨드 revalidate**.
> 가격을 보여주는 모든 페이지는 가격 갱신 주기(일 1회)+제품 변경 시 재생성되지만, 계산은 페이지마다가 아니라 **전역 1회**라 부하가 낮다.

---

## 1. 공통 기반 (P0 — 모든 페이지의 전제)

1. **R2 인크리멘털 캐시 + KV 태그 캐시 연결**
   - R2 버킷·KV 네임스페이스 프로비저닝 → [wrangler.jsonc](../wrangler.jsonc) 바인딩 추가.
   - [open-next.config.ts](../open-next.config.ts): `incrementalCache: r2`, `tagCache: kv`, `enableCacheInterception: true`.
   - → `revalidate`/`revalidatePath`가 비로소 실제 동작.
2. **온디맨드 재생성 배선** (이미 절반 존재)
   - 일간 크롤러 끝에 `POST /api/revalidate` 활성화([crawler/run.ts:935](../crawler/run.ts) 주석 해제) → 상세 가격 매일 반영.
   - 운영자 제품 import(sheets:import) 후에도 revalidate 호출 → 홈·리스트·SEO 골격 재생성.
   - [app/api/revalidate/route.ts](../app/api/revalidate/route.ts)를 태그 기반으로 확장(`products`, `best` 등) → 하드코딩 4경로 대신 그룹 단위 무효화.
3. **안전망**: 각 페이지에 시간 기반 `revalidate`도 병행(온디맨드 실패해도 자동 만료).

---

## 2. 페이지별 계획

### 2.1 홈 `/`

문제: 동적 풀-DB + **`allProducts` 전량을 클라이언트로 직렬화**([app/page.tsx](../app/page.tsx) → [HomeInteractiveSection](../components/home/HomeInteractiveSection.tsx))로 RSC 페이로드·하이드레이션이 큼.

조치:
- **ISR 전환**: 긴 시간 `revalidate`(예: 7일) + 제품 변경 온디맨드.
- **추천 캐러셀을 `viewty_score` 기반**(가격 무관)으로 → 선정이 안정적이라 정적화 자연스러움.
- **`allProducts` 전량 전달 제거**: 클라가 이걸 받는 유일한 이유는 "스킨타입 재필터"뿐. 둘 중 하나로:
  - (권장) 스킨타입별 추천 목록을 **서버에서 미리 추려** 필요한 것만 전달, 또는
  - 카드에 필요한 필드만 담은 **경량 projection**(id/slug/name/image/brand/viewtyScore/skinTypes) 전달 — `stores` 배열 등 무거운 필드 제외.
- **카드에 최저가 + 할인율 유지(확정).** 추천 선정(어떤 제품이 캐러셀에 뜨는지)은 `viewty_score`로 안정적이되, 카드에 찍히는 최저가/할인율 값은 일 1회(가격 갱신) 재생성에 맞춰 갱신된다.
- **오늘의 딜(officialPicks, 할인율 정렬)**: 미리 계산된 할인율(§6)로 정렬 → 일 1회 재생성으로 유지.
- 가격을 보여주므로 홈은 **가격 갱신 주기(일 1회) + 제품 변경 시** 재생성. 단 매 요청이 아니라 캐시 서빙이므로 부하는 낮다.

### 2.2 SEO `/best`, `/best/[slug]`

문제: ISR 선언했으나 dummy로 죽음 + **`generateSeoPageData`가 `generateMetadata`와 본문에서 2번 호출** → 전 상품 매핑·매칭 ×2 + 카드 가격 + 전 상품 JSON-LD Offer.

조치:
- 기반(§1)으로 **ISR 부활** — `generateStaticParams`(이미 있음)가 빌드 프리렌더, 캐시가 서빙.
- **`getSeoPageData`를 `cache()`로 감싸** 이중 매핑 제거(요청당 1회).
- **선정은 이미 가격 무관**(matchSeoProducts = 카테고리/스킨/배지/키워드 필터 + viewtyScore 정렬). → 제품 변경 시에만 바뀜. 그대로 둠.
- 카드 **최저가 + 할인율 표시(갱신 결정).** 전역 공유 캐시(§6)에서 읽으므로 추가 매핑 부담 없음 — "가격 없는 SEO" 특수화 폐기.
- **JSON-LD per-product Offer 유지** — /best 랜딩에도 가격 rich-snippet이 붙어 CTR에 유리. (상세는 AggregateOffer로 별도 유지.)
- `revalidate`: 가격 일 1회 + 제품 변경 온디맨드(가격을 보이므로 일간 포함).
- `getSeoPageData`는 공유 캐시된 `getProducts` 결과 위에서 `matchSeoProducts`만 수행 → 페이지별 풀 매핑 없음.

### 2.3 카테고리 `/c`, `/c/[category]`

문제: 동적 풀-DB + [CategoryProductList](../components/product/CategoryProductList.tsx)가 **클라이언트에서 가격 정렬**(최저가순·할인율순)을 함 → 전 상품 가격 데이터를 클라로 보내야 함.

**확정:** 카드에 최저가 + 할인율 유지 → **3가지 정렬(추천순/최저가순/할인율순) 모두 유지.** 할인율은 미리 계산(§6)되어 클라이언트 정렬에 그대로 쓰인다.

조치:
- **ISR 전환**: 가격을 보여주므로 **가격 갱신 주기(일 1회) + 제품 변경 시** 재생성(매 요청 X, 캐시 서빙).
- `CategoryProductList`에 **경량 projection** 전달 — 카드/정렬에 필요한 필드(`lowestPrice`, `discountVsRegular`, `viewtyScore`, `skinTypes`, 카테고리, 이미지/이름/배지)만. 무거운 `stores` 배열은 제외(상세에서만 필요).
- 대분류 페이지의 소분류 chips는 그대로(카테고리 데이터만).

### 2.4 제품카드 컴포넌트 ([ProductCard](../components/product/ProductCard.tsx) / [ProductListCard](../components/product/ProductListCard.tsx))

현재 둘 다 `lowestPrice` + "정가 대비 N% 할인" + (List)판매처 비교 태그라인 표시. 쓰이는 곳: 홈 캐러셀(ProductCard)·카테고리/best 리스트(ProductListCard)·상세 하단 관련상품(ProductCard).

조치:
- **카드는 최저가 + 할인율 유지**(확정). `showPrice` prop 기본 **on**, **`/best`(SEO)에서만 off**.
- **per-store 비교 태그라인("쿠팡·올영 비교")만 정리**: 이건 `stores` 배열이 필요해 경량화에 방해됨 → 카드에선 생략하고 상세에서 노출(또는 `storeCount` 같은 경량 숫자만 미리 계산해 표시).
- 카드에 넘기는 타입을 **경량 형태**로(현 `UIProduct`엔 `stores` 등 무거운 필드 포함). 카드는 `lowestPrice`/`discountVsRegular`/`viewtyScore`/이미지/이름/브랜드/배지/`slug`/`skinTypes`만 있으면 됨 → 페이로드 축소.

### 2.5 상세 `/p/[slug]`

현재: 동적이나 **이미 scoped + `cache()`**([getProductDetailPageData](../lib/queries/index.ts)) — 해당 제품의 listings/prices만 조회. 풀 비교 + JSON-LD AggregateOffer + 스티키 구매 버튼.

조치(작음):
- **가격의 단일 책임 지점**으로 확정. 풀 비교 UI 유지.
- **`export const revalidate = 86400`(일 1회)** + 크롤러 온디맨드 → 제품당 하루 1회, **방문된 제품만** 렌더(ISR lazy). ~94제품이면 무시 가능.
- (선택) `generateStaticParams`로 인기 제품 프리렌더. 가격이 일간이라 어차피 revalidate되므로 필수는 아님.
- 관련상품 카드도 §2.4 경량/가격 옵션 적용.

---

## 3. 부하 변화 (개념)

| 항목 | Before | After |
|---|---|---|
| 홈/카테고리/best 핫패스 | 매 요청 8테이블 풀스캔 + O(N×L) 매핑 | 캐시 HIT → DB·매핑 0 (제품 변경 시에만 재생성) |
| 캐시 미스 렌더 비용 | 전 상품 + 가격 매핑 | 가격 테이블 미조회(A) → 대폭 경감 |
| 가격 계산 위치 | 모든 리스트가 전 상품 | 방문된 상세 1제품, ≤일 1회 |
| 클라 페이로드 | 전 카탈로그(stores 포함) 직렬화 | 경량 projection |
| "Worker is busy" | 동시요청이 풀 렌더 적재 | 캐시 서빙으로 해소 |

---

## 4. 단계별 적용 (PR 묶음)

- **PR1 (무위험·즉시):** 안 쓰는 `current_prices` fetch 제거(카드 최저가는 `listing_prices_public`에서 나오므로 무관하게 미사용) / `getSeoPageData`·`getProducts` `cache()` 적용 / `mapToUIProduct` Map 인덱싱. → 캐시 없이도 즉시 가벼워짐.
- **PR2 (기반):** R2+KV 캐시 연결 + open-next/wrangler 설정 + `/api/revalidate` 태그 확장 + 크롤러/Import 트리거 활성화. → ISR 실제 작동.
- **PR3 (페이지 경량화·핵심):** `getProducts`를 `unstable_cache` + `products` 태그 + 일 1회 revalidate로 감싸 **전역 1회 계산** / 홈·카테고리·`/best` ISR 선언 / 카드에 **경량 projection** 전달(전 페이지 최저가+할인율 표시, 카테고리 3정렬 유지). **사이트맵**은 캐시된 `getProducts`를 자동 재사용(또는 slug-only 경량 쿼리로 분리) → [sitemap.ts](../app/sitemap.ts)의 force-dynamic 풀매핑 낭비 해소.
- **PR4 (상세):** 상세 `revalidate` + 온디맨드 + 관련상품 카드 경량.
- 각 PR은 CLAUDE.md 규칙대로 `feature/`·`fix/` 브랜치 + 테스트 + 영어 PR.

> **결정 로그(2026-06-30):** 파생값(최저가/할인율) 저장 방식 = **공유 캐시(6-1) 확정** (DB 컬럼 6-2는 보류). 근거: 입력(`regular_price` 등)은 이미 DB라 'DB 일관성' 이점이 없고, SQL 가격 질의 소비자(사이트맵 포함)가 현재 전무하며, 캐시는 `mapToUIProduct` 표시 로직을 그대로 재사용해 드리프트가 없다. 카탈로그가 수천 개로 커지거나 SQL 가격 질의가 생기면 6-2로 승격.

---

## 5. 최종 권장 (확정·갱신)

- **모든 리스트(홈·카테고리·`/best`) = 카드에 최저가 + 할인율 표시.** "가격 없는 SEO" 특수화 폐기.
- **전 상품 최저가+할인율은 전역에서 하루 1번만 계산**(§6-1, `getProducts`를 `unstable_cache`+`products` 태그로). 페이지는 그 공유 결과를 필터·슬라이스만.
- **가격 보이는 모든 페이지 = 가격 일 1회 + 제품 변경 시 재생성**(ISR, 매 요청 X).
- **상세 = 풀 per-store 비교(방문 시 scoped) + 일 1회 ISR.**
- **기반(R2+KV 캐시 + 온디맨드 revalidate)은 선행 필수.**
- **배포 = ISR + 온디맨드 revalidate**(완전 정적 재빌드 아님).

---

## 6. 최저가·할인율을 "전역에서 1번만" 계산

운영자 통찰: "가격을 하루 1번 갱신할 때 최저가/할인율도 같이 계산해 두면, 전 상품 최저가는 1번만 계산하면 되고, 그러면 /best에서도 그냥 보여주면 된다." → 정확하다. 최저가는 제품의 전역 사실이라 페이지마다 다시 계산할 이유가 없다.

핵심 구분 — "1번"의 단위:
- **페이지 ISR만**: "페이지마다 하루 1번"이 된다(SEO 40페이지면 하루 40회 풀 매핑). `getProducts`가 페이지 렌더마다 따로 돌기 때문.
- **전역 1번**: 무거운 계산을 **공유 캐시 한 곳**에 둬야 한다.

### 6-1 (★확정 2026-06-30): 공유 데이터 캐시로 전역 1회 계산

[mapToUIProduct](../lib/queries/index.ts)가 이미 `regular_price`(products, 시트)+용량+최저가 ml당으로 [discountVsRegular](../lib/queries/index.ts)와 최저가를 계산한다. 이 **`getProducts()`를 `unstable_cache`(또는 `"use cache"`) + `products` 태그 + `revalidate: 86400`으로 감싸면**:
- 전 상품 매핑이 **전역에서 하루 1번만** 수행되고, 그 결과를 **홈·카테고리·/best 모든 페이지가 공유**해서 읽는다(필터·슬라이스만).
- 크롤러가 일간 가격 갱신 후 `revalidateTag('products')` 1번 → 1회 재계산. 제품 import 후에도 동일.
- **mapToUIProduct의 정확한 표시 로직을 그대로 캐시**하므로, current_prices가 표시용으로 버려졌던 "크롤러 계산 ≠ 표시 계산" 드리프트가 원천 차단된다.
- 별도 DB 테이블/컬럼 불필요. (R2+KV 캐시 기반(PR2) 위에서 동작.)

→ "전 상품 최저가 1번만 계산 + /best 포함 어디서나 가격 표시"가 이 한 겹으로 충족된다.

### 6-2 (대안): DB precompute 컬럼

캐시 미스 시점의 계산조차 0으로 만들고 싶거나 카탈로그가 수천 개로 커지면, **크롤러가 일간 가격 산출 시 최저가/`discount_vs_regular`/`has_any_price` 등 카드 표시 필드를 함께 계산해 `current_prices`(또는 별도 요약 테이블)에 저장**하고, 리스트는 `products + 요약`을 행 1개씩 읽는다. 단 **반드시 mapToUIProduct와 동일한 로직을 공유 함수로 추출해** 양쪽에서 호출(드리프트 방지). 지금 규모(~94)에선 6-1로 충분하므로 **추후 승격 옵션**으로 둔다.

> 결론: **6-1 채택.** 공유 데이터 캐시가 "전역 1회 계산"을 만들고, 그 덕에 /best에서도 가격을 그대로 노출한다. 규모 확장 시 6-2(크롤러 precompute)로 자연 이행.
</content>
