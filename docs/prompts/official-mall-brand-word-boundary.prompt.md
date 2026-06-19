# Claude Code 작업 프롬프트 — 공식몰 판정: mallName 브랜드명 매칭을 "단어 경계 whole-word"로

> 배경: PR #33의 공식몰 게이트는 `mallName.includes(brand)`(부분문자열). 짧은 브랜드명이 다른 mallName에 **substring으로 오탐** 위험(예: 브랜드 `올리브` → `올리브영`/`콩올리브`에 걸림). 운영자: retailer_allowlist 시드는 안 함 → **매칭 규칙 자체를 단어경계로** 강화.
> 베이스: 최신 `main`(PR #33 머지 후). 분기 `fix/official-mall-brand-word-boundary`. 대상: `crawler/adapters/naver.ts`의 공식몰 mallName-브랜드 판정부.

## 변경
- 공식몰 판정의 "mallName이 브랜드명 포함" 조건을 **substring → 단어경계(whole-word) 매칭**으로 교체:
  - 브랜드명은 **(문자열 시작 또는 공백) 바로 뒤 + (문자열 끝 또는 공백) 바로 앞**에 와야 함. 즉 정규식 개념상 `(^|\s)<brand>(\s|$)`.
  - 앞뒤에 다른 글자가 **공백 없이 붙으면 불일치**(예: `올리브영`·`콩올리브` → 브랜드 `올리브`와 불일치). 공백으로 구분되면 일치(`올리브 공식몰`·`공식 올리브`).
- 매칭 전 **정규화**: 양쪽 trim, 연속 공백 1칸으로, **영문은 대소문자 무시**(VDL=vdl). 브랜드명에 정규식 특수문자 있으면 escape.
- 브랜드명이 비어있으면(없으면) 공식몰 후보로 보지 않음(기존 안전쪽).
- 그 외 게이트(개별 네이버 스토어 + identity sim≥0.6 + 코어토큰 + form-conflict 없음 + 용량 일치 + outlier)는 **그대로 유지**. (allowlist는 있으면 여전히 우선; 없어도 동작.)

## 테스트
- 브랜드 `올리브`: `올리브`✓ / `올리브 공식`✓ / `올리브 공식몰`✓ / `공식 올리브`✓ / `올리브영`✗ / `콩올리브`✗.
- 실제 케이스 회귀: `에뛰드 본사직영샵`(브랜드 에뛰드)✓ / `코스알엑스`✓ / `동화약품 후시다인`(브랜드 동화약품)✓ / `바이오힐보 BOH`✓ / `토리든`✓.
- 리셀러형 `미라클 뷰`(브랜드명 없음)✗ / `이니스프리 공식몰`이 외부몰이면 개별스토어 아님으로 이미 제외.
- 영문 대소문자: `vdl 공식`(브랜드 VDL)✓.
- `test:all`·typecheck·build·lint green. 앵커/OY/Coupang 회귀 0.

## 브랜치 & 적용
- `fix/official-mall-brand-word-boundary`: `fix(matcher): official-mall mallName brand match = whole-word (space/boundary), not substring`, `test`, `docs: worklog`. 영어 PR → CI → merge → `crawler:sync` → `cf:deploy`.
- `git diff --check`, 시크릿·`docs/prompts`·`tmp` 비커밋.

## 막히면
- 한글은 `\b`가 잘 안 먹으니 `(^|\s)`/`(\s|$)` 경계로 직접 구성(또는 mallName을 공백 split 후 토큰/연속토큰 비교). 브랜드명이 여러 토큰(공백 포함)이면 그 시퀀스를 공백경계로 매칭.
