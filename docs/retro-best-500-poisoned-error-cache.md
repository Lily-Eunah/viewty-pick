# 회고: 매일 아침 되살아나는 500 — Cloudflare Worker에 박제된 에러 응답을 추적하기

> 블로그 초안용 정리. ViewtyPick(`viewtypick.com`) `/best` 라우트가 **매일 아침 500으로 재발**하던 장애의
> 원인 추적 → 오진 → 실측 → 근본 해결 전 과정. (2026-07-02 최초 보고 → 07-07 최종 해결)

---

## 0. 시스템 구성 (배경)

- **Next.js 16 (App Router) + OpenNext → Cloudflare Workers** 배포
- 데이터: **Supabase** (상품·가격·SEO 페이지)
- 캐시: OpenNext 인크리멘털 캐시 = **R2** (페이지 HTML + `unstable_cache` 데이터), 태그 캐시 = **KV**
- **일일 크롤러** (GitHub Actions, KST 새벽 4시): 가격 수집 → Supabase 대량 쓰기 → 끝나고
  `/api/revalidate` 호출 → `revalidateTag('products','max')` + `revalidatePath('/','layout')`
  = **전 라우트 캐시 무효화**
- `/best` = SEO 허브 (추천 가이드 ~50개 링크). 사이트에서 검색봇이 가장 많이 두드리는 페이지

## 1. 증상

- `viewtypick.com/best`, `/best/[slug]` → **500 Internal Server Error**
- 나머지 전부 정상: `/` `/c` `/c/suncare` `/search` `/skin/*` `/p/*` → 200
- 특징: **"오늘도" 또 발생** — 고쳐도 다음 날 아침 재발
- 응답: `Content-Type: text/plain`, 본문 `Internal Server Error`, `x-opennext: 1`… 그리고 **`ETag` 헤더가 붙어 있음** ← 나중에 결정적 단서가 됨

## 2. 1차 진단과 부분 픽스 (PR #98) — 절반만 맞았다

### 관찰
- Supabase 자체는 건강: anon key로 REST 직접 호출 → `seo_pages` 48행 200 OK
- 홈은 되고 `/best`만 죽음 → 두 라우트의 데이터 경로 차이를 추적
- 홈·카테고리 = `getAllUIProducts`가 `unstable_cache`(R2)로 **빌드타임 캐시 서빙**
- `/best`만 `getActiveSeoPages`가 **매 요청 라이브 Supabase 호출** (uncached)

### 1차 결론 (부분 정답)
라이브 호출이 실패하면 폴백이 문제였다:

```ts
// 문제의 패턴 (곳곳에 있었음)
if (isSupabaseConfigured()) {
  const { data, error } = await supabase.from('seo_pages').select('*')...;
  if (!error && data) return data;
}
const db = loadMockDB();   // ← fs.readFileSync — Worker엔 파일시스템이 없다 → throw → 500
```

로컬 개발용 mock DB 폴백(`fs.readFileSync`)이 **Worker에서는 그 자체로 크래시**.

### 1차 픽스
`getActiveSeoPages`를 `unstable_cache`(R2, 태그, 1일)로 감싸 라이브 호출 자체를 제거.
배포 → `/best` 200 ✅ … **그리고 다음 날 아침 다시 500.**

### 이때의 오진 하나
"Worker 런타임에 `NEXT_PUBLIC_*` env가 안 바인딩된 것"이라고 추정했으나, 확인 결과
**시크릿은 전부 설정돼 있었다**. (`NEXT_PUBLIC_*`은 빌드타임 인라인이라 런타임 시크릿과 무관하기도 함)
→ 교훈: env 가설은 대시보드 확인 한 번이면 반증된다. 먼저 확인할 것.

## 3. 재발 — 진짜 원인을 찾아서

### 3-1. 로그가 없다
`wrangler tail`로 500 요청을 잡았는데… 출력은 `GET /best - Ok` 한 줄. 예외도 콘솔도 없음.
**OpenNext가 예외를 잡아 500 응답으로 변환하므로 invocation outcome은 "ok"** — `--status error` 필터도 무용.
→ 교훈: 프레임워크가 에러를 삼키면 tail은 침묵한다. 로그 없이도 진행할 수 있는 실험을 설계해야 한다.

### 3-2. Blast radius 정밀 매핑 (가장 값쌌던 실험)
```
/              200        /best             500
/c/suncare     200        /best/toner-best  500
/skin/dry/...  200        /best/pdrn        500
/p/[slug]      200  ←★
```
`★ /p/*`(상품 상세)는 **매 요청 라이브 Supabase 쿼리**를 하는데 200이다.
→ **"런타임 Supabase가 죽었다" 가설 즉시 기각.** 런타임 DB 접근은 멀쩡하다.

### 3-3. 로컬 재현 실패가 알려준 것
`cf:build` + `opennextjs-cloudflare preview`(로컬 workerd)에서 동일 시퀀스
(정상 확인 → revalidate 발사 → 재렌더)를 돌리면… **전부 200. 재현 안 됨.**
→ 프로덕션에만 있는 조건이 원인. (실제 R2/KV, 그리고 **크롤 직후라는 타이밍**)

### 3-4. 결정 실험 — 코드 한 줄 안 바꾸고 복구되면?
500 응답에 `ETag`가 붙어 있다 = **이 500은 렌더 결과가 아니라 캐시에서 나온다**는 가설.
검증: 프로덕션에 revalidate만 다시 발사 (크롤러가 밤마다 하는 것과 동일한 무해한 조작):

```
[전]  GET /best → 500  (ETag: "66fci67lppl")
      POST /api/revalidate → 200 {"revalidated":true}
[후]  GET /best → 200, 200, 200, 200  (86,956 bytes 정상 페이지)
```

**코드 변경·배포 없이 즉시 복구.** 가설 확정: *실패한 렌더가 라우트 캐시에 500으로 박제되어 하루 종일 서빙되고 있었다.*

### 3-5. 타임라인 맞추기
GitHub Actions 기록:
```
07-06 14:11 UTC  핫픽스 배포 → /best 200 확인
07-06 20:51 UTC  Daily Price Sync & Crawl (성공, 16m) → 말미에 revalidate 발사
07-07 00:16 UTC  /best 500 (재발 확인)
```
크롤 → revalidate → 재발. 매일 밤 같은 시퀀스.

## 4. 근본 원인 — 세 가지의 결합

1. **트리거**: 크롤러가 Supabase에 대량 쓰기 직후 revalidate → 전 라우트 purge →
   첫 방문자(검색봇, /best 최다 피격)가 재렌더 트리거 → **DB가 아직 바쁜 시점에 쿼리 폭주** → 1회 transient 실패
2. **증폭기**: 실패 시 `fetchAllData`가 `loadMockDB()`(fs) 폴백 → **Worker에서 throw → 500**
   (1차 픽스는 `getActiveSeoPages`만 고치고 이 폴백은 남겨뒀다)
3. **영구화**: **OpenNext가 그 500 응답을 라우트 캐시에 저장** (ETag까지 발급) →
   1회성 transient가 **다음 revalidate까지 하루 종일 지속되는 장애로 박제**

셋 중 하나만 없어도 안 터진다. 그래서 "가끔 한 번 삐끗"이 "매일 아침 확정 장애"가 됐다.

## 5. 해결 — 3중 방어 (PR #99)

### 층 1: 쿼리 — 재시도 + clean throw (fs·빈값 금지)
```ts
async function withRetry<T>(fn, attempts = 3, base = 400ms) { ... }

const fetchAllData = cache(async () => {
  if (isSupabaseConfigured()) {
    return withRetry(async () => {
      const [...] = await Promise.all([ ...7 queries... ]);
      if (pRes.error || !pRes.data) throw new Error(...);  // ← fs 폴백 대신 clean reject
      return {...};
    });
  }
  return loadMockDB(...);  // 로컬 dev 전용 (fs 있는 곳)
});
```
포인트 둘:
- **fs 폴백 제거** — configured인데 실패하면 던진다 (Worker-fatal 경로 차단)
- **빈 값 반환도 금지** — `unstable_cache` 콜백이 `[]`를 반환하면 그 빈 값이
  revalidate 윈도(86,400초) 내내 캐시된다. 실패는 reject로 — 에러는 데이터 캐시에 저장되지 않는다.

### 층 2: 페이지 — 에러 응답이 캐시에 박힐 수 없게
```tsx
// app/best/page.tsx
try {
  [pages, products] = await Promise.all([getActiveSeoPages(), getProducts(...)]);
} catch (e) {
  console.error('[best] data unavailable, rendering degraded hub', e);
  // 빈 배열로 degraded 200 렌더 → ISR(3600s)이 1시간 내 재시도·자가치유
}
```
렌더가 절대 throw하지 않으므로 **캐시에 저장될 500이 존재하지 않는다.**
최악의 경우 = 빈 허브가 최대 1시간 (500 하루 종일 vs 비교 불가).

### 층 3: 워크플로 — self-heal (최후 보루)
```yaml
# crawl.yml — 크롤 후 warmup
- name: Warm up & self-heal key routes
  run: |
    for route in / /best /best/toner-best; do
      # 200 아니면: revalidate 재발사 → 재시도 ×3 → 끝내 실패 시 job fail (가시화)
    done
```
원인 불문 어떤 잔여 케이스도 아침 전에 자동 복구되거나, 최소한 Actions 실패로 보인다.

## 6. 검증 방법론

- `next dev`(Node)로는 **이 계열 버그를 못 잡는다** — fs가 있고, 캐시 구조도 다름
- 정답: `cf:build` + `opennextjs-cloudflare preview`(**workerd** = 실 Worker 런타임)에서
  **revalidate 사이클**(정상 → purge → 재렌더) 통과 확인
- 배포 후 **라이브에서도 같은 사이클을 1회 실행**해 확인 (박제 대신 200 유지)
- transient 자체(DB 부하 삐끗)는 재현 불가 — 그래서 "재현해서 고치기"가 아니라 **구조적 방어**가 정답이었다

## 7. 교훈 요약

1. **"로컬 dev용 폴백"은 프로덕션 런타임에서 흉기가 된다** — `fs` 폴백은 Worker에서 그 자체로 크래시.
   폴백을 넣을 땐 "이 코드가 실행될 수 있는 모든 런타임"을 기준으로.
2. **에러 응답이 캐시되면 transient가 영구화된다** — 서버리스+엣지캐시 조합에서 렌더 throw는
   "한 번의 실패"가 아니라 "다음 무효화까지의 확정 장애"가 될 수 있다. 렌더는 degrade하되 throw하지 말 것.
3. **blast radius 매핑이 가설을 가장 빨리 죽인다** — `/p/*` 200 하나가 "런타임 DB 장애" 가설을 즉사시켰다.
4. **결정 실험을 설계하라** — 로그가 없어도 "revalidate만 쏘고 복구되는가?"로 캐시 박제 가설을 확정했다.
   (ETag 붙은 500 = 캐시에서 나온 500이라는 힌트를 놓치지 말 것)
5. **재발하는 장애는 트리거의 주기를 의심하라** — "매일 아침" = cron. Actions 타임라인과 맞춰보면 바로 나온다.
6. **부분 픽스 후 "당일 정상"에 속지 말 것** — 배포가 캐시를 재구축하므로 트리거(다음 크롤)까지는 무조건 정상으로 보인다.
   픽스 검증은 반드시 **트리거와 같은 시퀀스**로.

## 8. 에필로그: 픽스를 배포하자 CI가 깨졌다 — 하중을 받치고 있던 버그

PR #99를 머지하자마자 **CI(Mock/Offline)가 빨간불**이 됐다. 로그:

```
NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co   ← CI의 가짜 URL
[queries] seo_pages query failed: TypeError: fetch failed
```

### 무슨 일이 있었나 — 두 버그의 상쇄

- **버그 A (숨은 원인)**: CI의 placeholder env(`https://example.supabase.co` / `placeholder`)가
  `isSupabaseConfigured()`의 placeholder 판별(canonical 문자열 비교)에 안 걸림 →
  mock 빌드가 자신을 **"실제 DB 연결됨"으로 착각** → 61페이지 프리렌더 내내 죽은 호스트로 fetch
- **버그 B (받침대)**: fetch 실패 → fs mock 폴백이 조용히 흡수 → **CI는 몇 주간 green**
  — "정상 동작"이 아니라 *버그 A를 버그 B가 상쇄*하던 상태
- **PR #99가 버그 B를 제거** (Worker 크래시 방지라는 정당한 이유로) →
  받침대가 사라지자 버그 A가 그제서야 빌드 실패로 표면화

Hyrum's Law의 전형: *"시스템의 모든 관찰 가능한 동작은 결국 누군가가 의존하게 된다"* —
여기선 그 "누군가"가 자기 자신의 CI였다.

### 수정 (PR #100)

- **ci.yml**: 판별 로직이 인식하는 canonical placeholder로 교체 → mock 빌드가 의도된 mock-DB 경로 사용
- **`isSupabaseConfigured()` 강화**: `placeholder`·`example.supabase.co` 계열은 전부 unconfigured 판정
  (denylist 특정 문자열 비교 → 패턴 기반으로)

### 덤으로 드러난 것

고치자 CI 빌드가 **4분 → 1분대**. 그동안 매 빌드가 죽은 호스트로의 fetch 타임아웃을
기다리며 3분을 태우고 있었다 — green이라서 아무도 들여다보지 않은 낭비.

### 에필로그의 교훈

7. **CI green ≠ 정상** — 폴백이 실패를 삼키는 구조에서는 green이 거짓말을 한다.
   "우연히 통과"와 "의도대로 통과"를 구분하려면 mock 경로가 실제로 타지는지 확인해야 한다.
8. **mock/placeholder 판별은 denylist가 아니라 explicit flag로** — "이 문자열이면 mock"은 언젠가 새는
   구멍이 생긴다. `MOCK_MODE=true` 같은 명시적 스위치가 정답 (이번엔 패턴 매칭으로 보강).
9. **빌드 시간의 이상은 신호다** — mock 빌드가 4분씩 걸린 것 자체가 죽은 fetch의 증거였다.
10. **정당한 픽스가 깨뜨린 것은 원복이 아니라 추적 대상** — #99를 되돌리는 게 아니라,
    #99가 드러낸 숨은 결함(A)을 고치는 것이 맞다.

## 부록: 사건 일지

| 일시 (UTC) | 사건 |
|---|---|
| 07-02 | `/best` 500 최초 보고. 이 시점 배포본은 `getActiveSeoPages` uncached (매 요청 fs 폴백 리스크) |
| 07-06 13:5x | 1차 진단: uncached 라이브 쿼리 + fs 폴백 → PR #98 (R2 캐시화) |
| 07-06 14:11 | 배포 e118dd06 → `/best` 200 확인 |
| 07-06 20:51 | 일일 크롤 → revalidate → (밤사이 재렌더 1회 실패 → 500 박제) |
| 07-07 00:1x | 재발 확인. tail 무음("Ok"), blast radius 매핑, 로컬 workerd 재현 실패 |
| 07-07 00:3x | ETag 단서 → 결정 실험(수동 revalidate) → **500→200, 캐시 박제 확정** |
| 07-07 00:5x | PR #99 (3중 방어) → 머지 → 배포 c39931fd → 라이브 revalidate 사이클 통과 |
| 07-07 01:0x | **에필로그**: #99가 CI를 깨뜨림 — mock env가 판별을 통과해 죽은 호스트 fetch, fs 폴백 제거로 표면화 |
| 07-07 01:4x | PR #100 (canonical placeholder + 판별 강화) → CI green, 빌드 4분→1분 |
| 07-08 새벽~ | (관찰) 크롤 후 warmup 스텝이 Actions 로그에 상태 기록 — 최종 시험대 |
