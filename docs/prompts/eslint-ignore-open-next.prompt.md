# Claude Code 작업 프롬프트 — eslint가 `.open-next/` 빌드 산출물 린트하지 않도록 ignore 추가

> 문제: `npm run lint`가 gitignore된 빌드 디렉터리 **`.open-next/`** 안의 산출물까지 린트해서 에러를 뱉음. eslint는 기본적으로 `.next`/`out`/`build`는 무시하지만 `.open-next`는 무시 목록에 없음. 소스가 아니므로 CI는 깨끗하지만 **로컬 `npm run lint`가 지저분**함.
> 베이스: 최신 `main`. 분기 `chore/eslint-ignore-open-next`. 대상: eslint 설정(`eslint.config.*` flat config의 `globalIgnores` 또는 `ignores`).

## 변경
- eslint flat config에 **`.open-next/**`** 를 글로벌 무시에 추가(한 줄). 예: `globalIgnores(['.open-next/**'])` 또는 최상위 `{ ignores: ['.open-next/**'] }`. 기존 ignore 항목은 보존.
- 설정이 `.eslintignore`(legacy) 방식이면 거기에 `.open-next/` 한 줄 추가.

## 테스트/검증
- `npm run lint` → `.open-next/` 발(發) 에러 0, **소스 린트는 그대로 동작**(다른 ignore·룰 변화 없음).
- `tsc --noEmit` exit 0 회귀 확인.
- 소스 파일 린트 결과 불변(이 변경으로 새 에러/경고 0).

## 적용
- `chore/eslint-ignore-open-next`: 단일 커밋 `chore(lint): ignore .open-next build output in eslint`, 필요 시 `docs: worklog`. 영어 PR → CI `validate` 통과 → merge.
- `git diff --check`, 시크릿·`docs/prompts`·`tmp` 비커밋.
