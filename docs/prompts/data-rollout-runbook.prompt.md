# Claude Code 작업 프롬프트 — 운영 데이터 롤아웃 런북 (마이그레이션 + import dedup + 통제된 재import/limited sync/recompute)

> 목적: 구현된 코드(네이버 API 어댑터·올영 via 네이버·package extractor)를 **실제 원격 Supabase에
> 안전하게 켠다.** 원격 마이그레이션 적용 → sheet import 중복 방지(코드) → 통제된 데이터 정리 →
> 재import → **제한적** crawler sync → current_prices recompute.
>
> ⚠️ 이 작업은 **원격(운영) 데이터에 쓰기/스키마 변경**을 한다. 되돌리기 어려운 단계가 있으므로
> 아래 안전 원칙을 반드시 지킨다.

---

## 0. 안전 원칙 (전 과정 공통 — 위반 금지)

1. **읽기 먼저, 쓰기 나중.** 각 쓰기/파괴 단계 전에 read-only 감사로 현재 상태를 캡처·보고한다.
2. **파괴적 단계는 백업 + 확인 게이트.** 원격 마이그레이션·데이터 삭제/리셋 전에 백업하고, 영향 행수와 계획을 보고한 뒤 **운영자 "go"를 받기 전엔 실행하지 않는다.**
3. **순서 엄수.** `0006 → 0007` 적용이 **모든 import/sync/recompute의 선행조건.** 적용 확인 전에는 `sheets:import`·`crawler:sync`·`price_snapshots` write·`current_prices` recompute 금지.
4. **멱등성.** 재import가 중복을 만들지 않아야 한다(Part 1 코드가 보장).
5. **제한적 우선.** crawler sync는 소수 제품으로 먼저 검증 후, 확인되면 전체.
6. 시크릿·개인정보 비노출·비커밋. CLAUDE.md(브랜치·커밋·파일 무결성) 준수.

---

## 1. 전제조건 (시작 전 확인, 없으면 멈추고 보고)

- 베이스: PR #9가 머지된 **최신 `main`**.
- env(이름만 확인): `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NAVER_CLIENT_ID/SECRET`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_SPREADSHEET_ID`, `DISCORD_WEBHOOK_URL`, `REVALIDATE_SECRET`.
- **단일 정본 시트 확인(운영자 선결)**: 중복의 근본 원인은 서로 다른 키 체계의 시드가 두 번 들어간 것(예: product_id 1~7 ↔ 29~35, 같은 URL이 여러 link_key로). **재import 전에 Google Sheet가 제품당 1행(정본)으로 정리**돼 있어야 한다. 시트가 더러우면 DB만 정리해도 재import가 중복을 되살린다. → 시트 정리 상태를 운영자에게 확인.
- Supabase 접근(원격 적용 권한) 확인. 마이그레이션 적용 방식(`supabase db push`/`migration up --linked` 등 프로젝트 관례) 확인.

---

# Part 1 — 코드: Sheet import 중복 방지 (선행, 별도 PR)

재import가 중복을 다시 만들지 않게 하는 **코드 변경**. 이게 main에 머지된 뒤에 Part 2 운영을 실행한다.

## 2. 구현 (`crawler/sheets/`)
1. **중복 감지(`validate.ts`)**: 시트 내 **중복 `product_key`·중복 `link_key`·여러 listing이 같은 `url`** 을 감지 → 명확한 리포트와 함께 import 실패(fail-fast). 어떤 행이 충돌인지 출력.
2. **멱등 upsert(`import.ts`)**: products는 `product_key`, listings는 `link_key`, badges는 (product_key,badge) 기준 upsert임을 보장(중복 insert 금지).
3. **Orphan 정리(reconcile)**: **현재 시트에 없는** DB 행을 `is_active=false`로 비활성(삭제 아님) → 재import가 DB를 시트로 수렴시킴. (하드 삭제는 Part 2에서 백업·확인 후 별도.)
4. `sheet_import_runs`에 처리/스킵/비활성 카운트 기록, 오류 시 Discord 보고.

## 3. 테스트 + 브랜치/커밋/PR
- fixture 단위 테스트: 중복 product_key/link_key/url 감지, 재import 멱등(같은 시트 2회 → 행수 불변), orphan 비활성.
- 브랜치 `feature/sheet-import-dedup`(최신 main에서 분기). 커밋 단위:
  - `feat: detect duplicate product_key/link_key/url in sheet validation`
  - `feat: reconcile orphaned db rows on sheet import`
  - `test: sheet import dedup and idempotency`
- 각 커밋 전 `lint && typecheck && test:all && build` 통과 + `git diff --check`. 커밋 후 `git show --stat HEAD`.
- 영어 PR(요약·이유·테스트결과) → CI green → `gh pr merge --merge --delete-branch`. **이 머지 완료가 Part 2의 선행조건.**

---

# Part 2 — 운영 런북 (Part 1 머지된 main에서 실행, 게이트/백업)

> 각 Phase는 read-only 감사 → (필요 시 백업·확인) → 실행 → 검증 순. 결과를 `docs/worklog/ops-data-rollout.md`에 기록.

## 4. Phase A — 사전 감사 (READ-ONLY, 쓰기 0)
- 원격 현재 상태 캡처·보고: `products`/`listings`/`badges`/`price_snapshots`/`current_prices` 행수.
- **중복 맵**:
  ```sql
  select url, count(*) from listings where is_active group by url having count(*)>1;
  select product_key, count(*) from products group by product_key having count(*)>1;
  -- 같은 실제 제품이 다른 product_id로 중복된 의심 목록(슬러그/이름 기준)
  ```
- 적용된 마이그레이션 vs 로컬(`0006`,`0007` 원격 적용 여부) 확인.
- 산출: "현재 상태 + 중복 목록 + 마이그레이션 격차" 리포트.

## 5. Phase B — 원격 마이그레이션 `0006 → 0007` (백업 후, 순서 엄수)
- **백업 먼저**: 영향 테이블 덤프(`supabase db dump` 또는 pg_dump: `listings`,`price_snapshots`,`current_prices`,`retailer_allowlist`) 또는 대시보드 백업/PITR 확인. 백업 위치 보고.
- `0006` 적용 → 검증(컬럼 존재): `price_snapshots.matched_url/matched_mall_name`, `listings.latest_matched_url`.
- `0007` 적용 → 검증: `crawl_method`에 `naver_sourced` 허용(CHECK 갱신).
- 둘 다 성공 확인 전에는 다음 Phase 진입 금지.

## 6. Phase C — 데이터 정리 (게이트 + 백업)
- **기본안(권장): prune 비활성.** Part 1의 orphan reconcile에 의존 — 정본 시트 재import 시 시트에 없는 중복 행이 자동 `is_active=false`. 별도 삭제 없이 수렴. (가장 안전·가역)
- **하드 리셋/삭제가 필요할 때만**(테스트 junk 완전 제거 원할 시): 백업 확인 후, 삭제 대상 행수·목록을 보고하고 **운영자 "go" 후** 실행. 외래키 순서(price_snapshots/current_prices → listings/badges → products) 주의.
- 어느 쪽이든 **실행 전 영향 행수 보고 + 확인 게이트.**

## 7. Phase D — 재import (정본 시트 → 원격)
- `npm run sheets:import` 실행(Part 1 dedup 코드 포함).
- 검증:
  ```sql
  select url, count(*) from listings where is_active group by url having count(*)>1;  -- 0행이어야
  ```
  `sheet_import_runs` 최신 기록, 처리/비활성 카운트, 중복 0 확인. 시트와 DB 행수 정합.

## 8. Phase E — 제한적 crawler sync (소수 제품 먼저)
- **제한 모드**로 3~5개 제품만: `npm run crawler:sync`에 limit/subset 옵션(없으면 추가하거나 일시적으로 제품 좁히기). Naver API 한도 준수, **올영 직접 요청 없음** 확인.
- 검증:
  - `price_snapshots`에 네이버/올영(via 네이버) 가격 + `matched_url`/`matched_mall_name` 기록.
  - 올영 4단계 분기 동작(네이버 매칭/ manual_override / link-only).
  - `parse_confidence`·용량 절충안(불일치 시 base 유지·unit_price null) 정상.
  - Discord 알림 정상, `crawl_runs`/`crawl_errors` 기록.
- 이상 없으면 전체 sync로 확장(운영자 확인 후).

## 9. Phase F — current_prices recompute
- 최신 스냅샷 + Viewty Score로 `current_prices` 재계산.
- 검증: `base_lowest_price`/`base_lowest_seller`/혜택가/`has_promotion` 스팟 체크 수 제품, ml당 비교에서 `unit_price_reliable=false` 제외 동작 확인.

## 10. Phase G — 엔드투엔드 검증
- 제품 상세에서 네이버/올영 가격·구매링크(올영=큐레이터) 정상 표시. 갱신 시각·결제가 확인 캐비엇 노출.
- **알려진 한계**: 올영 **tier-4(link-only) UI는 미구현(§7.4 follow-up)** — `mapToUIProduct`가 스냅샷 없는 listing을 drop하므로 가격 없는 올영 행은 아직 안 보일 수 있음. **버그 아님**, follow-up으로 보고.
- 시크릿·개인정보 노출 없음, 의도치 않은 대량 쓰기 없음 재확인.

---

## 11. 롤백
- 마이그레이션: 컬럼/enum 추가는 가역(필요 시 down 또는 백업 복원). 적용 실패 시 다음 Phase 중단.
- 데이터: Phase B 백업으로 복원. 하드 삭제는 백업 없으면 실행 금지.
- crawler/recompute: 스냅샷은 누적이므로, 잘못된 sync는 해당 run 식별 후 무시/정정. current_prices는 재계산으로 복구.

## 12. Definition of Done
1. Part 1(dedup/reconcile) 머지 완료, 재import 멱등성 테스트 통과.
2. 원격에 `0006 → 0007` 순서로 적용·검증 완료.
3. 백업 확보 + 데이터 정리(또는 prune 수렴)로 **중복 0**(Phase D 쿼리 0행).
4. 제한적 sync로 네이버/올영 가격·matched 필드·올영 4단계·용량 절충안 정상 확인 → (확인 후) 전체 sync.
5. current_prices recompute 정상, 스팟 체크 통과.
6. `docs/worklog/ops-data-rollout.md`에 각 Phase 결과(행수·백업 위치·검증 쿼리 결과) 기록. tier-4 UI는 follow-up으로 명시.

## 13. 막히면
- 마이그레이션 적용 권한/방식 불명확 → 멈추고 보고(임의 SQL 강행 금지).
- 정본 시트가 아직 안 정리됨 → 재import 중단, 시트 정리를 운영자에게 요청(더러운 시트로 import 금지).
- 삭제 대상이 모호하거나 실데이터 혼입 의심 → 삭제 금지, 목록 보고 후 확인 요청.
- 커버리지가 낮아 link-only가 많으면 → Phase G에서 보고(수동 입력/UI follow-up 우선순위 재논의).
