# Claude Code 작업 프롬프트 — 크롤러 prod 쓰기 가드 (crawler:test 재발 방지)

> 목적: `crawler:test`(--test)가 어댑터만 mock하고 **persistence는 설정된(=프로덕션) Supabase에 그대로 써서** 라이브 가격을
> mock으로 덮어쓴 사고가 **두 번** 발생. 구조적으로 차단한다. (메모리 노트가 아니라 코드 가드.)
> 베이스: 최신 `main`. 분기 `chore/crawler-prod-write-guard`.

## 1. 핵심 요구
- **`--test`(crawler:test)는 절대 실제/프로덕션 Supabase에 쓰지 않는다.**
  - --test 모드면 persistence를 **mock DB(로컬)로 강제**하거나, 설정된 Supabase가 *실 프로젝트*면 **하드 에러로 중단**(명시 override 없이는). mock 모드가 어댑터뿐 아니라 *쓰기 경로*까지 mock이 되게.
- **시작 배너(test/sync 공통)**: 실행 즉시 **대상 Supabase 프로젝트 ref + 모드(test/real)**를 콘솔에 출력 → 어디에 쓰는지 항상 보이게.
- **(선택, 권장) `crawler:sync`의 로컬 prod 쓰기 안전장치**: 인터랙티브 로컬에서 prod에 쓸 땐 `CRAWLER_ALLOW_PROD_WRITE=true`(또는 `--allow-prod`) 필요. **CI/cron은 그 env를 설정해 통과**(자동화 무방해). 단 cron 도입 전이라면 이 부분은 가볍게 — 핵심은 --test 차단.

## 2. "프로덕션 Supabase" 판별
- 설정된 `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_*`가 **실 프로젝트(placeholder/test 아님)**인지 감지. CI는 시크릿 없어 mock이므로 자연히 통과(현행 유지).

## 3. 테스트
- `crawler:test`가 실 Supabase 설정에서 **쓰기 0**(mock DB로 가거나 에러)임을 단위/통합으로 검증.
- 배너가 대상 ref·모드를 출력하는지.
- (가드 적용 시) `crawler:sync`가 prod + override 없음 → 거부, override 있음 → 진행. CI 경로 통과.
- 기존 정상 `crawler:sync`(override/CI) 회귀 없음. `test:all`·typecheck·build·lint green.

## 4. 브랜치 & 커밋 / DoD
- `chore/crawler-prod-write-guard`: `fix: crawler:test never writes to production Supabase`, `feat: crawler target+mode startup banner`, (`feat: crawler:sync prod-write requires explicit allow`), `test: crawler prod-write guard`, worklog.
- `git diff --check`, 시크릿·`docs/prompts`·`tmp` 비커밋. 영어 PR → CI green → merge.
- **DoD**: crawler:test가 prod에 못 씀(테스트로 보장), 대상 배너 출력, 자동화(CI/cron) 무방해, 회귀 없음.

## 5. 막히면
- mock DB 라우팅이 persistence 코드와 강하게 결합돼 있으면 구조 보고 후 최소 침습안 제안.
- prod 판별 기준이 애매하면(스테이징 등) 보수적으로 "실 URL이면 차단"으로 두고 보고.
