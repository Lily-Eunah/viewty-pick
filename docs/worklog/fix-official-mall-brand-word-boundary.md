# fix/official-mall-brand-word-boundary

## 배경
PR #33의 공식몰 게이트는 `mallName.includes(brand)`(부분문자열) → 짧은 브랜드명이 다른 mallName에 substring으로 **오탐** 위험(브랜드 `올리브` → `올리브영`·`콩올리브`에 걸림). 운영자: allowlist 시드 대신 **매칭 규칙 자체를 단어경계로** 강화.

## 변경 (`crawler/adapters/naver.ts`)
- 신규 `mallNameHasBrandWord(mallName, brand)`: 브랜드명을 **whole-word(공백/문자열 경계)** 로 매칭 — 정규식 개념 `(?:^|\s)<brand>(?:\s|$)`.
  - 정규화: parentheticals 제거, 연속 공백 1칸, trim, **소문자화(영문 대소문자 무시; VDL=vdl)**, 브랜드 정규식 특수문자 escape.
  - ⚠️ `normalizeMallName`은 공백을 제거하므로 사용 불가 → 경계 매칭용 **공백 보존 정규화**를 자체 구현.
- `isOfficialBrandStoreOffer`의 brand-fallback 분기를 `nm.includes(nb)`(첫 토큰 substring) → `mallNameHasBrandWord(item.mallName, brand)`(whole brand, 공백경계)로 교체.
- 나머지 게이트(개별 네이버 스토어 + identity sim≥0.6 + 코어토큰 + form-conflict 없음 + 용량 일치 + outlier)와 **allowlist 우선 분기는 그대로 유지**.

## 테스트 (`naver.test.ts` +6)
- 브랜드 `올리브`: `올리브`✓ / `올리브 공식`✓ / `올리브 공식몰`✓ / `공식 올리브`✓ / `올리브영`✗ / `콩올리브`✗.
- 실제: `에뛰드 본사직영샵`✓ / `코스알엑스`✓ / `동화약품 후시다인`✓ / `바이오힐보 BOH`✓ / `토리든`✓ / 브랜드없는 `미라클 뷰`✗.
- 영문 대소문자: `vdl 공식`(VDL)✓ / `VDL official`(vdl)✓ / `vdleather`✗.
- 빈/괄호 브랜드: 빈 브랜드✗ / `조선미녀 (Beauty of Joseon)` → `조선미녀 공식스토어`✓.
- 통합: `isOfficialBrandStoreOffer`가 `올리브영` 스토어(브랜드 `올리브`) 제외, `올리브 공식몰` 채택.

## 결과
- `test:all`(14 suites)·typecheck·build·변경파일 eslint·`git diff --check` green. 앵커/OY/Coupang 회귀 0.

## 남은 이슈 / TODO
- 운영자: `crawler:sync` → 짧은 브랜드 오탐 해소 확인 → `cf:deploy`.
- 공백 없이 붙는 접미(예: `올리브공식몰`)는 경계 규칙상 불일치 — 실제 공식 스토어명이 공백 없이 브랜드+접미인 경우가 있으면 allowlist로 보정(운영자 정책상 whole-word 우선).
- Case C(없는 네이버 링크 discover/생성)는 별도 PR 예정.
