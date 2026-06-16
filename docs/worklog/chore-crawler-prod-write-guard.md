# chore/crawler-prod-write-guard — crawler:test never writes to production

- **일자**: 2026-06-17
- **배경**: `crawler:test`(--test)가 어댑터만 mock하고 persistence는 `isSupabaseServerConfigured()` 기반이라 설정된(=프로덕션) Supabase에 mock 가격을 써서 라이브를 덮어쓴 사고 2회. 구조적 코드 가드로 차단.

## 변경 (`crawler/run.ts`)
- `resolveCrawlTarget(env, supabaseConfigured)` 순수 함수 추출(테스트 가능):
  - **mockMode**(`VIEWTYPICK_MOCK_MODE=true` 또는 `CRAWLER_MODE=mock`, --test가 설정) → **useSupabase=false** → persistence·sheet import 모두 **로컬 mock DB**(Supabase 절대 안 씀).
  - **useSupabase** = `supabaseConfigured && !mockMode`.
  - **refused** = `useSupabase && !CI && CRAWLER_ALLOW_PROD_WRITE!=='true'` → 인터랙티브 로컬에서 실 prod 쓰기는 **명시 opt-in 필요**.
- `crawlPipeline`:
  - **시작 배너**: `mode=TEST/MOCK|LIVE · persistence=Supabase[ref]|local mock DB` — 대상 프로젝트 ref+모드를 항상 출력.
  - **refused면 즉시 return**(어떤 write도 전에). mockMode면 `skipImport`도 강제(시트 import prod 쓰기 차단).
  - 중복 `useSupabase` 계산 제거.

## 동작 (실측)
- `crawler:test` → `mode=TEST/MOCK · persistence=local mock DB` → "Persisting ... to Local JSON file" (prod write 0). ✓
- `crawler:sync`(실 env, flag 없음, 비-CI) → `mode=LIVE · persistence=Supabase[fttlbozyjvtuieznytda]` → **REFUSED**(write 0). ✓
- 자동화: `CI=true`(CI/cron) 또는 `CRAWLER_ALLOW_PROD_WRITE=true`(의도적 로컬 재수집) → 통과. CI는 시크릿 없어 supabaseConfigured=false → 자연히 mock DB.

## 테스트
- `test:prodguard`(test:all 편입): test→mock·미refuse / CRAWLER_MODE=mock→mock / LIVE 로컬→refused+ref / +ALLOW→통과 / +CI→통과 / 미설정→mock. 6/6.
- typecheck·lint·build·`test:all`·`crawler:test`(이제 안전) green.

## 비고
- 재수집 시 의도적으로 prod에 쓰려면 `CRAWLER_ALLOW_PROD_WRITE=true npm run crawler:sync -- ...`.
</content>
