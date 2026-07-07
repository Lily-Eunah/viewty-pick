# hotfix/best-poisoned-error-cache — /best 반복 500 근본 해결

## 증상
- 프로덕션 `/best`·`/best/[slug]`가 **매일 아침 500**으로 시작 (나머지 라우트는 200).
- 1차 핫픽스(PR #98, getActiveSeoPages R2 캐시화) 배포 당일은 200 → 다음날 새벽 크롤 후 다시 500.

## 근본 원인 (실측으로 확정)
1. 새벽 크롤러가 Supabase에 대량 쓰기 후 `/api/revalidate` 발사 → `revalidateTag('products','max')` + `revalidatePath('/','layout')` → 전 라우트 캐시 무효화.
2. 직후 첫 방문자(주로 검색봇 — /best는 SEO 허브)가 재렌더 트리거. 이때 Supabase가 크롤 부하 여파로 쿼리 1회 실패 가능.
3. 실패 시 `fetchAllData`가 `loadMockDB()`(fs.readFileSync)로 폴백 → Worker엔 fs가 없어 throw → 500.
4. **OpenNext가 그 500을 라우트 응답으로 캐시** (ETag까지 붙음) → 이후 모든 요청이 박제된 500 서빙 → 다음 revalidate/배포까지 하루 종일 지속.

증거: 500 응답에 `ETag: "66fci67lppl"`; 코드 변경 없이 `/api/revalidate` 수동 발사만으로 즉시 200 복구; `/p/*`(매 요청 라이브 쿼리)는 정상 = 런타임 Supabase 자체는 건강.

## 수정 (3중 방어)
1. **`lib/queries/index.ts`**
   - `withRetry` 헬퍼 (3회, 점증 딜레이 400ms/800ms).
   - `fetchAllData`: configured 시 재시도 후 실패면 **clean throw** (fs 폴백 제거 — unstable_cache에 빈 값이 하루 캐시되는 것도 방지).
   - `fetchActiveSeoPages`: 동일하게 재시도 + 실패 시 throw (기존 `[]` 반환은 빈 목록이 86400s 캐시되는 문제).
   - `getCategories`/`getCategoryBySlug`: configured-but-failed 시 `[]`/`null` (fs 경로 차단).
2. **페이지 가드** — `app/best/page.tsx`(빈 허브로 degrade), `app/best/[slug]/page.tsx`(notFound로 degrade). 렌더가 절대 throw하지 않으므로 캐시에 박힐 500이 없음. ISR 3600s가 1시간 내 자가 복구.
3. **`.github/workflows/crawl.yml`** — 크롤 후 warmup 스텝: `/`·`/best`·`/best/toner-best` 상태 체크, 500이면 revalidate 재발사 + 재시도, 끝내 실패 시 job fail (Actions/Discord로 가시화).

## 검증
- `npx tsc --noEmit` 클린, `npm run test:all` ALL PASS
- `cf:build` 성공 + 로컬 workerd(`opennextjs-cloudflare preview`)에서 revalidate 사이클: `/best`·`/best/toner-best`·`/best/pdrn`·`/` 모두 200
- 프로덕션은 수동 revalidate로 선복구(200) 후 본 픽스 배포

## 남은 이슈 / TODO
- [ ] OpenNext가 에러 응답을 라우트 캐시에 저장하는 동작 자체는 upstream 이슈 소지 — 필요시 opennextjs-cloudflare에 리포트
- [ ] 야간 transient의 1차 원인(크롤 직후 Supabase 부하) 계측: Workers Logs(observability enabled)에서 새벽 시간대 로그 확인 가능
