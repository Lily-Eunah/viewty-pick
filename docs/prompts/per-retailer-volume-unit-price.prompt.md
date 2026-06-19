# Claude Code 작업 프롬프트 — 판매처별 용량차 허용: 거부/null 대신 "그 용량으로 ml당 비교"

> 배경: 화장품은 같은 제품을 판매처마다 다른 ml로 파는 경우가 많음(네이버 100ml / 올리브영 80ml / 쿠팡 120ml…). 지금은 **trust-first 가정**으로 (a) 매처 `passesStrictIdentity`가 **용량≠DB면 거부**(naver.ts ~544), (b) normalize가 **용량 mismatch면 `unit_price=null`+`unit_price_reliable=false`**(normalize.ts ~183–219) → 다른 용량 판매처가 가격에서 빠지거나 warning이 됨.
> **운영자 결정: 같은 제품(identity 통과)이면 용량이 달라도 처리한다. 용량이 읽히면 그 용량으로, 안 읽히면 DB 용량으로 가정해 ml당 계산하고 자동 노출. inspection 보류 없음.** (파싱이 틀려 ml당이 틀리는 위험은 감수.)
> 베이스: 최신 `main`. 분기 `feature/per-retailer-volume`. 대상: `crawler/adapters/naver.ts`(매처 용량 거부), `crawler/core/normalize.ts`(용량 mismatch 처리), `lib/queries`·제품 페이지(판매처별 용량 표시·ml당 랭킹).

## 변경 1 — 매처: 용량차로 거부하지 않기
- `passesStrictIdentity`에서 **`volume ${parsedVol}ml ≠ DB ${volumeMl}ml` 거부(reject) 제거**. identity 게이트(sim≥임계 + distinctive 토큰 + `hasFormConflict` 없음 + 이종세트 아님)는 **그대로 유지** — "같은 제품"인지는 identity가 보증.
- `chooseFallback`의 "용량 정확일치 우선" 정렬은 **유지 가능**(같은 용량이 여럿이면 그걸 우선) — 단 다른 용량을 **버리지는 않음**.
- OY 경로(`matchOliveYoungOffer`)·공식몰/카탈로그 폴백 모두 동일하게: 용량차로 제외 금지.

## 변경 2 — normalize: 용량차 = mismatch(불신) 아님, 그냥 그 용량으로 ml당
- 파싱된 용량(parsedVolumeRaw / title ext)이 DB와 달라도 **`volume_mismatch`로 막지 말 것**:
  - 용량이 **읽히면** `volume_ml = 파싱값`으로 `unit_price` 계산 + **`unit_price_reliable = true`**.
  - 용량이 **안 읽히면** 기존대로 `volume_ml = product.volume_ml`(가정) + `unit_price_reliable = true`.
  - 즉 **용량 출처(파싱/가정)와 무관하게 ml당을 계산하고 reliable로** 둔다. (다른 reliability 사유 — match 미검증 등 — 가 있으면 그건 유지.)
- `volume_mismatch_detail`은 **정보성 로그/필드로 강등**(노출 차단 용도로 쓰지 않음). 가능하면 "판매처 용량 100ml(DB 50ml와 다름)" 식으로 운영자 참고만.

## 변경 3 — 표시·랭킹: 판매처별 용량 + ml당 기준
- 제품 페이지 판매처 행에 **각 판매처의 용량을 표시**(예: "올리브영 80ml · ml당 225원"). 용량이 판매처마다 다를 수 있음을 사용자가 알 수 있게.
- **"최저가" 헤드라인/정렬은 용량이 다를 때 `unit_price`(ml당) 기준**으로(총가만으로 비교하면 작은 용량이 싸 보이는 착시). 총가도 함께 표기하되, 대표/랭킹은 ml당.
- 대표 용량은 DB `volume_ml`(헤드라인 라벨), 판매처별 용량은 각 listing의 실제 용량.

## 테스트
- 같은 제품(identity 통과) + 올리브영 80ml / 네이버 100ml → **둘 다 노출**, 각자 용량으로 ml당, 둘 다 reliable, 랭킹은 ml당.
- 용량 제목에 없는 오퍼 → DB 용량으로 ml당(reliable), 노출.
- identity 실패(다른 제품) → 여전히 제외(회귀).
- 이종세트·form conflict는 여전히 제외(회귀).
- `unit_price_reliable=false`로 가던 "용량 mismatch" 케이스가 이제 reliable+ok로 노출되는지. `test:all`·typecheck·build·lint green.

## 적용
- `feature/per-retailer-volume`: `feat: allow per-retailer volume — compute unit price from each listing's size instead of rejecting volume mismatch`, `test`, `docs: worklog`. 영어 PR → CI → merge → `crawler:sync` → 용량 다른 판매처가 ml당으로 비교·노출되는지 확인 → `cf:deploy`.

## 주의/리스크 (정직하게)
- 이 변경의 안전성은 **전적으로 identity 게이트**에 의존(같은 제품 보증). identity가 약하면 다른 제품/사이즈가 섞일 수 있음 — 최근 강화한 brand/identity 유지가 전제.
- 용량 파싱 오류 시 ml당이 틀릴 수 있음(운영자 수용). `volume_mismatch_detail` 로그를 남겨 사후 점검 가능하게.
- 기존 "volume alert"(용량 불일치 알림) 로직이 있으면, 차단이 아니라 **정보성**으로만 동작하도록 정리.
