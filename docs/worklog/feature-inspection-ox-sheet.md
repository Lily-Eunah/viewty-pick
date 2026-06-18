# feature/inspection-ox-sheet

## 목적
warning 으로 *보류된*(미노출) 가격을 운영자가 **O/X 한 글자**로 노출(승격)/거부. 크롤러가 추정가격/출처/사유/링크를 다 채우고, 운영자는 `inspection` 탭에서 **O/X만**. manual_overrides 수기 입력 제거.

## 핵심 전제 (검증)
웹은 `listing_prices_public`(= `isDisplayablePriceSnapshot`, **status='ok'만**) 으로 노출 → **warning 가격은 이미 미노출(보류)**. 따라서 가시성 로직 변경 불필요: **O → 기존 manual_override(price) 경로로 승격 → status ok → 노출**. (current_prices 는 web 미사용 = dead.)

## 동작
1. **읽기(승격)** — 매 `crawler:sync` 시작 시 `inspection` 탭 read → `승인=O` 행을 `approvalOverrides` 로 price manual_override 합성(가격 = 탭의 추정가격; 운영자가 고친 값 사용) → `manualOverrides` 에 push → `applyManualOverrides` 가 warning→ok 로 승격.
   - 버그 수정: `applyManualOverrides`(price) 가 `inspectionWarning` 을 **null 로 clear** → 안 그러면 healthcheck Rule 4b 가 다시 warning 으로 강등(승격 무효). 
2. **수집** — 크롤 루프에서 `status='warning'` + 가격 있는 오퍼를 inspection 후보로 수집(비앵커 공식가 A2·catalog A3/B3·용량불일치·±50% 등).
3. **쓰기(upsert)** — 크롤 후 `inspection` 탭 upsert. `mergeInspectionRows`:
   - 현재 warning 행 = 데이터(추정가/출처/사유/링크) 최신화 + 기존 `승인` 보존,
   - 현재에 없는 기존 **O/X 행은 유지(sticky — 결정 영속; O는 ok 가 돼 더 이상 warning 아님)**,
   - 현재에 없는 **빈칸 행은 제거(해결/소멸)**.
4. **Discord** — 요약에 "검수 대기 N건" + 주요 항목(제품·추정가·출처) 표기(빈칸만 카운트).

## 키 / 컬럼
- 키 = `product_key + seller(slug)`.
- `inspection` 탭: `product_key | product_name | seller | 추정가격 | 출처 | 사유 | 링크 | 승인`.
- `승인` 정규화: O/ㅇ/✓/승인/노출 → O; X/✗/거부/숨김 → X; 그 외 빈칸.

## 주요 변경 파일
- 신규 `crawler/sheets/inspection.ts` — 순수 helper(parseApproval/parsePrice/rowKey/mergeInspectionRows/approvalOverrides) + 네트워크 read/write(best-effort, mock-skip).
- `crawler/run.ts` — Step 2.6 승인 read→override, 루프 내 후보 수집, Step 8.5 탭 upsert + pending, 요약 연계.
- `crawler/core/normalize.ts` — applyManualOverrides 가 inspectionWarning clear.
- `crawler/core/notify.ts` — sendDailySummary 에 검수 대기 라인.
- `crawler/sheets/setup_headers.ts` — `inspection` 탭 헤더 + 누락 탭 자동 생성(addSheet).
- 신규 `crawler/sheets/__tests__/inspection.test.ts`(+13), `package.json`(test:inspection → test:all).

## 테스트
- 순수 로직: parseApproval/parsePrice/rowKey; merge(신규=빈칸, O/X 보존+데이터 최신화, sticky O/X 유지, 빈칸 소멸 제거, seller 구분); approvalOverrides(O→override·운영자 수정가 사용, X/빈칸 무시, 미지 product/seller·가격 null skip).
- `test:all`(15 suites)·typecheck·build·변경파일 eslint·`git diff --check` green. 앵커/OY/Coupang 회귀 0.
- ⚠️ 네트워크 read/write 는 **미실행**(prod 시트 write + crawler:sync 로컬 실행 금지 정책). 운영자 환경에서 검증.

## 남은 이슈 / TODO
- **운영자**: 먼저 `npm run sheets:headers`(= `inspection` 탭 생성/헤더). 이후 `crawler:sync` → 탭에 후보 채워지는지·O 다음 sync 노출·X 계속 숨김·빈칸 warning 유지 확인 → `cf:deploy`. manual_overrides(기존 수기 경로)와 병행 동작.
- OY 모호(가격 없는 held)는 추정가격이 없어 현 수집 대상 아님(여전히 no_offer→manual). 필요 시 OY 어댑터가 후보가를 surface 하도록 후속.
- mergeInspectionRows 의 sticky O/X 는 무한 누적될 수 있음(제품/판매처 폐기 시) → 후속 정리 룰(완료 표시/만료) 고려.
