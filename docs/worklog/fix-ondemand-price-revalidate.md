# fix/ondemand-price-revalidate

카드(리스트)와 상세의 가격 불일치 수정 — 부하 개선 [PR3](feature-global-product-cache-isr.md)의 후속.

## 문제

PR3에서 리스트는 `getAllUIProducts`(`unstable_cache`, 일 1회)로 캐시했지만 상세 `/p/[slug]`는 라이브(동적)로 남겨, **일간 크롤러가 가격을 갱신한 뒤 상세는 즉시 새 가격, 카드는 캐시 만료(최대 ~1일) 전까지 옛 가격** → 카드 ≠ 상세.

## 해법 (운영자 제안: "라이브 변경 시점에 카드 캐시도 다시 가져오기")

가격이 바뀌는 유일한 시점(일간 크롤) 직후 캐시를 온디맨드 무효화. 상세는 계속 라이브(정확), 카드는 크롤 직후 라이브 값으로 재계산 → 즉시 일치.

- **[app/api/revalidate/route.ts](../../app/api/revalidate/route.ts)**: path 없는 호출 시 `revalidateTag(PRODUCTS_TAG, 'max')` + `revalidatePath('/', 'layout')`.
  - `getAllUIProducts`(태그 `products`) 캐시 + 이를 쓰는 모든 페이지(홈/카테고리/스킨/best)를 무효화.
  - ⚠️ **Next 16.2.9에서 `revalidateTag`는 2번째 "profile" 인자 필요** — 런타임 구현(`next/dist/server/web/spec-extension/revalidate.js`) 확인 결과 1-인자도 동작하나 deprecation 경고를 내며, **공식 권장 대체값이 `'max'`**. 그래서 `revalidateTag(tag, 'max')` 사용. (앞서 PR3에서 이 시그니처 불확실로 보류했던 것을 구현 확인 후 진행.)
- **[crawler/run.ts](../../crawler/run.ts)** Step 8: 주석이던 revalidate 트리거를 활성화 — 일간 sync 끝에 `POST {REVALIDATE_URL|https://viewtypick.com/api/revalidate}` (body: `{secret}`).
  - 가드: `useSupabase && REVALIDATE_SECRET && !== 'placeholder'` → CI(crawler:test, secret=placeholder)·mock 런은 스킵(프로덕션으로 stray 호출 없음). `REVALIDATE_SECRET`은 crawl.yml에 이미 전달됨.

시간기반 일 1회 `revalidate`(PR3)는 안전망으로 유지 — 온디맨드 호출이 실패해도 하루 내 자동 갱신.

## 검증

- `npm run typecheck` — exit 0 (revalidateTag 2-인자 에러 해소 확인)
- `npx eslint <changed>` — 0 errors (기존 경고만)
- `npm run cf:build` — green
- ⏳ **런타임 확인(배포 후)**: 크롤 직후(또는 수동 `POST /api/revalidate`) 카드가 상세와 동일한 새 가격으로 갱신되는지. `'max'` profile의 퍼지 동작은 배포 환경에서 최종 확인.

## 활성화

다음 `cf:deploy` + 다음 일간 크롤(또는 수동 revalidate 호출)부터 적용. 이후 카드=상세 일치.
</content>
