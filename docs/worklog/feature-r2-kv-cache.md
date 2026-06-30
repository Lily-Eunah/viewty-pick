# feature/r2-kv-cache

부하 개선 계획([docs/load-improvement-plan.md](../load-improvement-plan.md))의 **PR2 — 캐시 인프라**.
no-op `dummy` 인크리멘털 캐시를 R2 + KV 기반 durable 캐시로 교체해 ISR/`unstable_cache`/`revalidateTag`가 실제로 동작하게 한다. (런북: [docs/cloudflare-cache-setup.md](../cloudflare-cache-setup.md))

## 구현 요약

- **`open-next.config.ts`**: `defineCloudflareConfig({})`(=dummy) → 다음으로 교체
  - `incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "short-lived" })` — ISR/SSG 출력 + `unstable_cache` 데이터를 R2에 저장, colo 내 Cache API로 한 겹 더 캐시(TTFB·R2 Class B 읽기 절감)
  - `tagCache: kvNextTagCache` — `revalidateTag`/`revalidatePath` 지원
  - `queue: memoryQueue` — ISR 재검증 dedupe(isolate-local)
  - `enableCacheInterception: true` — 캐시 HIT 시 라우트 핸들러 skip
- **`wrangler.jsonc`**: 바인딩 추가/수정
  - R2: `NEXT_INC_CACHE_R2_BUCKET` → bucket `viewtypick-inc-cache`
  - KV: `NEXT_TAG_CACHE_KV` → id `bb41e27b83bb4a4ba59df1359c8d7f04`
  - ⚠️ wrangler 자동 추가본은 바인딩 이름이 `viewtypick_inc_cache`/`viewtypick_tag_cache`였음 → OpenNext override가 읽는 **고정 이름**으로 교정(안 맞으면 캐시 미동작). `remote: true`는 로컬 dev가 프로덕션 캐시에 붙지 않도록 제거.

## 검증

- `npm run typecheck` — exit 0 (clean)
- `npx eslint open-next.config.ts` — clean
- `npm run cf:build` — **exit 0**, `.open-next/.build/open-next.config.mjs`에 `cf-r2-incremental-cache` + `withRegionalCache` + `kv-next-mode-tag-cache` 반영 확인. "OpenNext build complete."

> 로컬 노이즈 메모: `cf:typegen`이 gitignored `cloudflare-env.d.ts`를 더 엄격한 런타임 타입(`.json(): unknown`)으로 재생성하면서 기존 코드 전반에 tsc 25개·lint(probe 스크립트) 에러가 떴으나, 이 파일은 **gitignored이고 CI는 생성하지 않으므로** 영향 없음. 베이스라인 복원(파일 삭제) 후 typecheck/lint clean 확인. lint 에러의 `_probe_*.ts`도 전부 untracked 로컬 파일.

## 운영자 액션 / 활성화

- R2 버킷 `viewtypick-inc-cache` + KV 네임스페이스(id 위)는 **생성 완료**(운영자).
- **다음 `cf:deploy` 시 캐시 활성화.** 배포 후 확인: 동일 ISR 페이지(`/best/[slug]`) 2회 호출 시 2번째 TTFB 급감 + R2 오브젝트 증가 + Observability CPU 하락.
- R2 사용량 알림 설정 권장(무료 한도: 런북 §5 표).

## 남은 이슈 / TODO (후속)

- **PR3:** `getProducts`를 `unstable_cache` + `products` 태그 + 일1회 revalidate → 전역 1회 계산. 홈/카테고리/`/best` `revalidate` 선언 + 경량 projection. `mapToUIProduct` Map 인덱싱(+픽스처 테스트). 사이트맵 getProducts 재사용.
- **PR2 후반/PR3:** `/api/revalidate`를 `revalidateTag('products')`로 확장 + 크롤러(일간)·import 트리거 활성화([crawler/run.ts](../../crawler/run.ts) 주석 해제).
- **PR4:** 상세 `/p/[slug]` `revalidate` + 온디맨드.
</content>
