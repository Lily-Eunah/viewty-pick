# Development Rules

구현 작업 시 아래 규칙을 반드시 따른다.

## 1. Branch 전략
- 기능 단위로 branch를 나누어 개발한다.
- 네이밍: `feature/<기능명>`, `fix/<버그명>`, `refactor/<대상>` (예: `feature/login`, `fix/image-upload`)
- `main`에 직접 commit하지 않는다.

## 2. Commit 규칙
- 의미 단위로 commit한다. 한 commit에 너무 많은 파일/변경을 담지 않는다.
- 서로 다른 목적의 변경(기능 추가 + 리팩토링 등)은 commit을 분리한다.
- Commit message 형식: `<type>: <요약>`
  - type: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
  - 요약은 무엇을/왜 변경했는지 명확하게 작성 (예: `feat: add product ranking API endpoint`)

## 3. Push / PR 규칙
- Branch push 전 반드시 테스트를 실행하고 통과를 확인한다.
- Push 후 PR을 올리고 merge한다. main에 force push 금지.
- PR title과 description은 **영어**로 작성한다.
  - Description에 포함: 변경 요약, 변경 이유, 테스트 방법/결과

## 4. 파일 무결성 확인 (Claude Desktop mount 이슈)
- Claude Desktop 작업 시 mount 이슈로 파일이 잘린 채 git에 push된 사례가 있음.
- **Commit 전**: `git diff --stat` 및 변경 파일을 직접 열어 내용이 온전한지 확인한다.
  - 파일 끝이 잘리지 않았는지, 빈 파일(0 byte)이 아닌지 확인 (`git diff --check`, 파일 크기 비교)
- **Commit 후**: `git show --stat HEAD`로 commit된 내용을 다시 확인한다.
- Push 전 잘린 파일이 발견되면 수정 후 amend한다.

## 5. 작업 로그
- 각 branch별 구현 결과를 정리하여 log로 남긴다.
- 위치: `docs/worklog/<branch명>.md`
- 포함 내용: 구현한 기능 요약, 주요 변경 파일, 테스트 결과, 남은 이슈/TODO
- Branch merge 전에 작성 완료한다.
