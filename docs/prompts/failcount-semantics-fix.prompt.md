# Claude Code 작업 프롬프트 — fail_count 의미론 수정 (no-match ≠ fetch 실패)

> 목적: 정당한 "오퍼 없음(no-match)"을 fetch 실패와 똑같이 취급해 `fail_count`를 올리는 버그를
> 고친다. 현재는 네이버/올영에 정당하게 오퍼가 없는 listing(예: tier-4 link-only)이 매 런마다
> fail_count가 누적돼 **연속 3회 → 비노출 / 5회 → 수동점검**으로 자동 비활성된다.
> 이건 **일일 cron(및 가격 히스토리 자산)의 하드 블로커**다.
>
> 베이스: 최신 `main`. 신규 분기 `feature/failcount-semantics`.

---

## 0. 배경 / 근본 원인

파이프라인이 두 개의 다른 결과를 하나로 뭉뚱그린다:

1. **Fetch/기술 실패** — HTTP 4xx/5xx, 타임아웃, 403 차단, 데이터 있어야 할 페이지의 파싱 실패/구조 변경. → `fail_count`가 원래 잡으려던 것(DESIGN §4.4 연속 1/2/3/5회 단계).
2. **정당한 no-match** — 검색/API는 **성공(200)**했는데, 이 제품의 자격 있는 공식몰 오퍼가 **없음**(해당 플랫폼 미입점, 공식 스토어 오퍼 부재 등). → **실패가 아니라 정상 상태.** link-only로 두면 됨. **fail_count 올리면 안 됨.**

현재는 2번도 fail_count를 올려서 정상 listing이 자동 비활성된다. **핵심 = 이 둘을 구분.**

---

## 1. 확정 규칙

fetch 시도의 결과를 **3-state**로 분류한다:

| 결과 | 조건 | fail_count | listing | 비고 |
|---|---|---|---|---|
| `OK_PRICED` | 자격 오퍼 매칭, 가격 산출 | **0으로 리셋** | active | price_snapshot(status=ok) 기록 |
| `OK_NO_OFFER` | fetch 성공, 자격 오퍼 없음 | **0으로 리셋**(올리지 않음) | active(link-only) | 실패 아님. 커버리지 정보로만 |
| `FETCH_FAILED` | HTTP 오류·타임아웃·403·데이터 누락 파싱오류 | **+1** | DESIGN §4.4 단계 | 1 경고→2 알림→3 비노출→5 수동점검 |

**불변식:** `fail_count` = **연속 fetch 실패** 횟수. **성공한 fetch(가격 있든 없든)는 무조건 0으로 리셋.** 자동 비활성은 오직 `fail_count`(=진짜 fetch 실패)에만 반응 → no-match는 절대 비활성 안 됨.

**분류 기준(어댑터별):** 네이버/쿠팡(예정)은 **API 응답이 200이고 결과 배열을 받았으면 성공** — 그 안에 자격 오퍼가 없으면 `OK_NO_OFFER`, API 오류/타임아웃은 `FETCH_FAILED`. (크롤 경로가 있으면: 페이지 정상 로드인데 항목 없음=no_offer, 페이지 오류/차단=failed.)

---

## 2. 구현

1. **어댑터 반환 타입 확장**: `fetchOffer`가 단순 PriceOffer/throw가 아니라 **결과 종류(`ok|no_offer|failed`) + 사유**를 명시적으로 반환하도록(또는 결과 객체에 outcome 필드). 네이버 `pickOfficialOffer`가 "후보 0개/유사도 미달"이면 `no_offer`, API 호출 자체 실패면 `failed`.
2. **run.ts / healthcheck.ts**:
   - `OK_PRICED`·`OK_NO_OFFER` → `listings.fail_count = 0`.
   - `FETCH_FAILED` → `fail_count += 1`, DESIGN §4.4 단계 처리(직전가 유지→알림→비노출→수동점검)는 **이 경로에만**.
   - 자동 비활성/비노출 판정이 `fail_count` 기준임을 확인(no_offer는 영향 0).
3. **no_offer 기록(선택, 권장)**: 진단·히스토리 연속성을 위해 price_snapshot을 `status='no_offer'`(가격 null)로 남길 수 있음 → status enum 확장 마이그레이션 `0009` 필요. **공개 뷰(`listing_prices_public`)는 이미 `status='ok'`만 노출하므로 누출 없음.** (테이블 부담 줄이려면 "이전과 상태 바뀔 때만 기록"도 가능 — 구현 판단.)
4. **이전에 가격 있던 listing이 no_offer로 바뀐 경우**: **현재가를 내리고 link-only로**(신뢰 우선 — 사라진 오퍼의 stale 가격을 보여주지 않는다). 단 이 전이는 **일일 요약에 "오퍼 사라짐" 정보로 1줄** 남겨 운영자가 확인하게 한다(알림 폭주 아님). ※ stale 가격 유지/grace 윈도우는 도입하지 않음(트러스트 우선).
5. **Discord/요약 분리**: `FETCH_FAILED`(연속 단계)는 **알림**, `OK_NO_OFFER`/커버리지 갭은 **일일 요약의 정보 항목**(실패 알림 아님). 거짓 알림 방지.

---

## 3. 테스트 (fixture 단위)
- **no-match는 비활성 안 됨**: fetch 성공 + 자격 오퍼 없음을 **N회 연속** → `fail_count`는 0 유지, listing active. (현재 버그의 회귀 방지 핵심 케이스.)
- **fetch 실패는 단계 동작**: API 오류/타임아웃/403 연속 1/2/3/5회 → 경고→알림→비노출→수동점검, fail_count 증가.
- **혼합**: 실패로 fail_count 쌓인 뒤 **성공(가격 or no_offer)** 한 번 → fail_count 0 리셋.
- **이전 가격 있던 → no_offer 전이**: 현재가 내려가고 link-only, 일일 요약에 "오퍼 사라짐" 기록.
- 기존 healthcheck/normalize/네이버 테스트 회귀 통과.
- 각 커밋 전 `lint && typecheck && test:all && build`.

---

## 4. 브랜치 & 커밋 (CLAUDE.md)
- 분기 `feature/failcount-semantics`(최신 main). main 직접 커밋·force push 금지.
- 커밋 단위:
  - `feat: classify fetch outcome (ok/no_offer/failed) in adapters`
  - `fix: increment fail_count only on fetch failures, not legitimate no-match`
  - `feat(db): 0009 add no_offer snapshot status` (no_offer 기록 채택 시)
  - `feat: surface no-offer coverage as info in daily summary (not alert)`
  - `test: fail_count semantics — no-match vs fetch failure`
  - `docs: worklog for failcount-semantics`
- 각 커밋 전후 `git diff --stat`/`git diff --check`/`git show --stat HEAD`. `docs/prompts/`·`tmp/`·시크릿 비커밋.
- 마이그레이션(0009) 도입 시 원격 적용은 기존 게이트(백업→session pooler repair/push, 적용 계획 보고 후 단일 go).
- 영어 PR(요약·이유·테스트결과) → CI green → `gh pr merge --merge --delete-branch`.
- worklog `docs/worklog/feature-failcount-semantics.md`.

---

## 5. 검증(머지 전 권장)
- **제한적 sync**(앞서처럼 소수 제품, 일부러 no-match·실패 케이스 포함)로:
  - no-match listing의 fail_count가 **안 오르는지**,
  - 실패 케이스가 단계대로 도는지,
  - 공개 뷰엔 여전히 ok만 노출되는지 확인.

---

## 6. Definition of Done
1. 정당한 no-match listing은 **fail_count가 누적되지 않고 자동 비활성되지 않음**(회귀 테스트로 보장).
2. 진짜 fetch 실패는 DESIGN §4.4 단계대로 fail_count 증가·비노출·수동점검 유지.
3. 성공한 fetch(가격/ no_offer)는 fail_count를 0으로 리셋.
4. no_offer/커버리지 갭은 **정보**로, fetch 실패는 **알림**으로 분리.
5. (채택 시) 0009 적용, 공개 뷰 누출 없음. 테스트·빌드 통과, worklog 작성.

> 이 fix가 끝나면 **일일 cron 스케줄링이 안전**해지고(정상 listing 자동 비활성 위험 제거), 그 cron이 돌기 시작하면 **가격 히스토리 자산**이 쌓인다(차트/최저가 뱃지의 전제). 스케줄링 자체는 별도 단계.

---

## 7. 막히면
- 어댑터가 "성공인데 오퍼 없음"과 "fetch 실패"를 코드상 구분하기 어려우면(예외만 던지는 구조): 결과 객체/outcome enum 도입을 먼저 하고 보고.
- no_offer 기록 방식(매번 vs 전이 시만, status 확장 vs 미기록)이 모호하면 옵션과 트레이드오프 보고 후 결정.
- 자동 비활성 로직이 fail_count 외 다른 신호도 본다면(예: is_active 직접 조작) 그 지점 보고.
