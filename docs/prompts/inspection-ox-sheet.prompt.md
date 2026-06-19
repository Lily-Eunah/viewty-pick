# Claude Code 작업 프롬프트 — 검수 OX 시트 탭 (warning 가격을 O/X만으로 승격/거부)

> 목적: warning(비앵커 공식가·catalog lprice·OY 모호·용량불일치 등)으로 *보류된* 가격을, 운영자가 **O/X 한 글자**로 노출(승격)/거부하게. manual_overrides를 직접 채우는 번거로움 제거 — **크롤러가 다 채워주고 운영자는 O/X만.**
> 베이스: 최신 `main`. 분기 `feature/inspection-ox-sheet`. 대상: `crawler/run.ts`(검수항목 시트 write + 승인 read·적용), 시트 `inspection` 탭, setup_headers.

## 1. `inspection` 탭 (신설) — 크롤러가 자동 채움
컬럼: `product_key | product_name | seller | 추정가격 | 출처(mallName/카탈로그) | 사유 | 링크 | 승인`
- 매 `crawler:sync`마다, **warning/검수 대상 오퍼**(공식가 폴백·catalog lprice·OY 모호·용량불일치 등)를 이 탭에 **upsert**:
  - 키 = `product_key + seller`. 같은 행 있으면 **운영자가 찍은 `승인`(O/X)은 보존**(덮어쓰지 않음), 추정가격/사유/출처/링크만 최신화.
  - `승인` 컬럼만 비워서 둠 → 운영자가 **O**(승인) 또는 **X**(거부) 입력. (가격이 틀리면 추정가격을 직접 고친 뒤 O 해도 됨.)
- 더 이상 warning이 아니게 된(해결된) 항목 행은 제거(또는 '완료' 표시).

## 2. 적용 (다음 sync에서 read)
- `inspection` 탭 read:
  - `승인 = O` → 그 product+seller에 **추정가격을 price override로 적용** → status `ok`, 사이트 노출. (내부적으로 manual_overrides price와 동일 경로 재사용.)
  - `승인 = X` → 계속 **숨김**(link-only/미노출). 다시 묻지 않게 유지.
  - 빈칸 → 미검수 → 기존대로 warning(미노출).
- O로 승격된 가격은 이후에도 유지(운영자가 X로 바꾸거나 행 삭제 전까지).

## 3. Discord 알림(있으면) 연계
- crawl 요약에 **"검수 대기 N건"** + inspection 탭 링크/주요 항목(제품·추정가·출처·링크) 포함 → 운영자가 매일 보고 O/X.

## 테스트
- warning 발생 제품들이 inspection 탭에 자동 기록(컬럼 채워짐, 승인 빈칸).
- 운영자 O → 다음 sync에 그 가격 ok 노출; X → 계속 숨김; 빈칸 → warning 유지.
- 이미 찍은 O/X는 재sync에도 보존(덮어쓰기 0). 해결된 항목은 정리.
- manual_overrides(기존 수동 경로)와 충돌 없음(둘 다 동작). `test:all`·typecheck·build·lint green.

## 브랜치 & 적용
- `feature/inspection-ox-sheet`: `feat: inspection OX sheet (crawler pre-fills warnings, operator approves with O/X → promote to ok)`, `test`, `docs: worklog`. 영어 PR → CI → merge.
- 시트 write는 freeze write-back과 동일하게 서비스계정으로(권한 보유). 시크릿·`docs/prompts`·`tmp` 비커밋.

## 막히면
- 시트 write가 부담이면, 우선 read-only로 inspection 탭을 운영자가 수동 점검 + manual_overrides로 승격(현행)하고, 자동 write는 후속. (단 목표는 자동 채움+O/X.)
- O 적용을 manual_overrides 경로로 흡수할지(권장, 코드 재사용) 별도 테이블로 둘지는 구현 판단.
