# Cloudflare R2 + KV 캐시 설정 런북 (PR2 기반)

작성일: 2026-06-30
대상 버전: `@opennextjs/cloudflare` **1.19.x**, `wrangler` **4.x** (package.json 기준)
관련: [load-improvement-plan.md](load-improvement-plan.md) PR2 — 이 작업이 끝나야 ISR/`unstable_cache`/`revalidateTag`가 실제로 동작한다(현재 `incrementalCache: "dummy"` = 무력).

---

## 0. 무엇을 왜 만드나

| 리소스 | 역할 | OpenNext 바인딩명(고정) |
|---|---|---|
| **R2 버킷** | 인크리멘털 캐시 — ISR/SSG 페이지 출력 + `unstable_cache` 데이터 저장 | `NEXT_INC_CACHE_R2_BUCKET` |
| **KV 네임스페이스** | 태그 캐시 — `revalidateTag('products')`/`revalidatePath` 동작 | `NEXT_TAG_CACHE_KV` |

> 바인딩명은 OpenNext override가 `env`에서 **이 이름 그대로** 찾는다(임의 변경 불가). 리소스 *이름*(bucket_name, 네임스페이스 title)은 자유.

queue(재검증 dedupe)는 isolate-local `memoryQueue`(바인딩 불필요)로 충분. regional cache(Cache API, 바인딩 불필요)는 읽기 지연 단축 + R2 Class B 무료 한도 보호 — **§5, 처음부터 권장**.

---

## 1. 사전 조건 (운영자, 1회)

```bash
# Cloudflare 인증 (둘 중 하나)
npx wrangler login                    # 브라우저 OAuth
# 또는 CI/헤드리스: export CLOUDFLARE_API_TOKEN=...  (R2 Edit + Workers KV Edit 권한)
```

- **R2는 대시보드에서 한 번 활성화 필요**: Cloudflare 대시보드 → R2 → "Enable"(무료 한도 있으나 결제수단 등록 요구될 수 있음). KV는 기본 사용 가능.
- Worker 이름은 [wrangler.jsonc](../wrangler.jsonc)의 `"name": "viewtypick"` — 바인딩도 같은 파일에 추가.

---

## 2. 리소스 생성 (운영자 실행)

```bash
# (1) R2 버킷
npx wrangler r2 bucket create viewtypick-inc-cache

# (2) KV 네임스페이스 — 출력된 id 를 wrangler.jsonc 에 기입
npx wrangler kv namespace create viewtypick-tag-cache
```

`kv namespace create` 출력 예:
```
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "viewtypick_tag_cache"
id = "0f2ac74b498b48028cb68387c421e279"   ← 이 id 사용
```
→ binding은 무시하고 `NEXT_TAG_CACHE_KV`로 바꿔 쓸 것. id만 복사.

(선택) `cf:preview`도 캐시 켜려면 프리뷰 네임스페이스도:
```bash
npx wrangler kv namespace create viewtypick-tag-cache --preview   # preview_id 획득
```

확인:
```bash
npx wrangler r2 bucket list
npx wrangler kv namespace list
```

---

## 3. wrangler.jsonc 바인딩 추가 (코드 — PR2)

[wrangler.jsonc](../wrangler.jsonc)에 추가:

```jsonc
{
  "name": "viewtypick",
  "main": ".open-next/worker.js",
  // ...기존 설정 유지...
  "assets": { "binding": "ASSETS", "directory": ".open-next/assets" },

  "r2_buckets": [
    { "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "viewtypick-inc-cache" }
  ],
  "kv_namespaces": [
    {
      "binding": "NEXT_TAG_CACHE_KV",
      "id": "<KV_NAMESPACE_ID>"          // 2단계에서 받은 id
      // "preview_id": "<KV_PREVIEW_ID>" // 프리뷰 캐시도 쓰면
    }
  ],

  "observability": { "enabled": true }
}
```

---

## 4. open-next.config.ts 설정 (코드 — PR2)

[open-next.config.ts](../open-next.config.ts) 교체 (1.19.x export 경로 확인됨):

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import kvNextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

const config = defineCloudflareConfig({
  // ISR/SSG 페이지 + unstable_cache 데이터 → R2 (§5 regional cache로 감싸 사용 권장)
  incrementalCache: r2IncrementalCache,
  // revalidateTag('products') / revalidatePath → KV
  tagCache: kvNextTagCache,
  // 재검증 요청 dedupe (isolate-local; 소규모엔 충분)
  queue: memoryQueue,
  // 캐시 HIT 시 라우트 핸들러 자체 skip → 부하 추가 절감
  enableCacheInterception: true,
});

// 기존 유지: Turbopack 대신 webpack 프로덕션 빌드
config.buildCommand = "next build --webpack";

export default config;
```

> 모두 **default export** (regional-cache의 `withRegionalCache`만 named export — §5).

---

## 5. regional cache — 읽기 지연 + R2 무료 한도 보호 (★처음부터 권장)

R2 직접 조회 대신 colo 내 Cache API로 한 겹 더 캐시한다. 바인딩 불필요(Cache API는 R2 ops로 안 침).

```ts
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
// ...
incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "short-lived" }),
```

두 가지 효과:
1. **TTFB 단축** — 같은 리전 반복 요청이 R2를 다시 안 읽음.
2. **R2 Class B(읽기) 무료 한도 보호** — regional cache 없으면 R2 읽기가 *페이지뷰에 비례*(요청당 ~1회), 있으면 *페이지수 × 리전수 × 갱신주기*로 트래픽과 디커플링. 무료 10M/월(≈하루 33만)을 트래픽 급증에도 지킨다.

- `short-lived`: 가져온 항목을 ~1분간 재사용(재검증과 충돌 적어 **안전한 기본값**).
- `long-lived`: 재검증 전까지 리전별 재사용(더 공격적 — 태그 무효화 전파/cache purge 고려). 안정화 후 검토.

### R2 무료 한도 점검 (참고)

| 자원 | 무료/월 | viewtypick 예상(캐시 페이지 ~200개) | 여유 |
|---|---|---|---|
| Storage | 10 GB | 수십 MB(키 덮어쓰기, 안 쌓임) | 압도적 |
| Class A(쓰기) | 1M | 재검증+온디맨드 ≈ 월 수천~수만 | 압도적 |
| Class B(읽기) | 10M | 캐시 요청당 ~1회 → regional cache로 트래픽 디커플링 | 월 수백만 PV 전까지 안전 |

→ 대시보드에서 **R2 사용량 알림** 설정 권장. 순수 정적(revalidate 없는) 페이지는 ASSETS에서 서빙되어 R2 ops 0.

---

## 6. 타입 재생성 + 빌드 검증 (코드 — PR2)

```bash
npm run cf:typegen     # cloudflare-env.d.ts 에 NEXT_INC_CACHE_R2_BUCKET / NEXT_TAG_CACHE_KV 추가됨
npm run cf:build       # 빌드 통과 확인 (.open-next/.build/open-next.config.mjs 에 dummy 대신 r2/kv 들어갔는지)
```

검증 포인트:
- `.open-next/.build/open-next.config.mjs`에서 `incrementalCache`가 더 이상 `"dummy"`가 아님.
- 배포 후 동일 ISR 페이지를 2번 호출 → 2번째 TTFB 급감, R2 오브젝트 수 증가, 대시보드 Observability에서 CPU time 하락. (캐시 상태 헤더가 있으면 HIT 확인)

---

## 7. 역할 분담

| 작업 | 누가 | 비고 |
|---|---|---|
| `wrangler login` / R2 대시보드 활성화 | **운영자** | 계정 권한 필요 |
| `r2 bucket create` / `kv namespace create` | **운영자** | 실제 클라우드 리소스 생성 |
| KV id 전달 | 운영자 → 코드 | wrangler.jsonc에 기입 |
| wrangler.jsonc 바인딩 + open-next.config.ts + cf:typegen | **코드(PR2)** | id placeholder만 운영자가 채움 |
| 배포 `cf:deploy` | 운영자(또는 CI) | |

---

## 8. 다음 단계 (이 런북 이후)

이 인프라는 캐시를 **가능하게** 만들 뿐이다. 실제 부하 절감은 PR3/PR4 코드가 사용:
- PR3: `getProducts`를 `unstable_cache(..., { tags: ['products'], revalidate: 86400 })`로 감싸고, 홈/카테고리/`/best`에 `revalidate` 선언.
- PR2 후반: `/api/revalidate`를 `revalidateTag('products')`로 확장 + 크롤러/import가 호출.
- PR4: 상세 `revalidate` + 온디맨드.

→ 순서: **이 런북(리소스+바인딩) → PR3 코드 → 크롤러 트리거.**
</content>
