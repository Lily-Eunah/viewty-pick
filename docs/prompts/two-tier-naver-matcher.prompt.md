# Claude Code 작업 프롬프트 — 2-tier 네이버 매처 (링크-id 앵커 + 제목/변형 폴백)

> 목적: 매칭의 최종형. **tier-1 링크-id 앵커**(큐레이션 N과 일치하는 결과 채택 = 정확한 큐레이션 SKU)로
> 변형/교차상품/세트 오매칭을 근본 제거하고, 앵커 미스(40%)는 **tier-2 제목/변형/벌크 폴백**으로.
> 이 PR이 앞선 B(잔여 오매칭 수정)를 **흡수**한다(폴백 = B).
> 근거: `docs/worklog/naver-id-anchor-experiment.md` (직접 0% / 링크 60%).
>
> 베이스: `fix/naver-sku-matching` 브랜치(계속).

---

## 0. 실험 결론 (확정)
- `item.productId == N` 직접 일치 0/40. **`item.link` 해석 → `/products/{N}` 60%**(brand/smartstore 67%, naver.me 46%). 링크 경유 앵커링 viable.
- 링크 hit 중 ~13/24가 **큐레이션 URL 자체가 세트/다중팩 페이지** → 앵커는 그 세트를 정확히 반환(→ set-classification이 per-unit/제외) + **시트 URL 정리 신호**.

## 1. 2-tier 매칭

### Tier 1 — 링크-id 앵커
1. **큐레이션 N 추출**: `brand.naver.com|smartstore.../products/{N}` 직접; `naver.me` → 리다이렉트 1회 해석해 N 추출(결과 **캐시**해 재해석 방지).
2. 검색 결과에서 **`link` 해석 → `/products/{N}` 인 항목**을 찾음.
   - **redirect 비용 관리**: 모든 항목을 풀지 말고, brand/title 그럴듯한 **후보로 prefilter → 상위 K개만 해석 → N 일치 시 중단**. 해석 횟수 캡.
3. 앵커 항목 발견 → **그게 큐레이션 SKU**. `classifyOfferComposition` 적용:
   - 단품 → 채택(정확).
   - 세트/다중팩 → per-unit 또는 제외(trust-first) + **시트-URL-정리 신호**로 기록.

### Tier 2 — 폴백 (앵커 미스, ~40%)
- N이 결과에 안 뜨는 경우(랑콤/유세린/토리든 등): **현행 official-mall + 단품 우선 + 제목/변형 토큰 매칭 + 벌크 제외**(= 기존 B 내용).
- 변형 토큰 필수 일치(클리어/퍼플/번호/포맨 등), 벌크/케이스 제외, 확신 못 하면 no_offer.

## 2. 회귀·검증 (read-only 맵)
- **catalog-match-map 재실행**(read-only) before/after:
  - 앵커가 정확 SKU를 잡는지(피지오겔 #77 → 올바른 200ml 로션, 닥터지 변형 해결).
  - 기존 OK 미감소(폴백이 정상 단품 안 떨어뜨림).
  - 세트로 앵커된 listing 목록 = **시트 URL 정리 대상**(메디큐브/라운드랩/인터미션/닥터지/이즈앤트리 등).
- before/after 분포(OK/no_offer/set/anchor-hit/fallback) 제시.

## 3. 테스트
- tier-1: N 추출(brand/smartstore 직접, naver.me 해석+캐시), 링크 해석 N 일치 채택, 세트 앵커 → 제외/per-unit.
- redirect 캡/캐시 동작(과다 호출 방지).
- tier-2: 변형 구분·벌크 제외·단품 우선(B 회귀).
- 기존 normalize/coupang/oliveyoung/publicprices 회귀 통과. `test:all`·typecheck·build green.

## 4. 브랜치 & 커밋 (CLAUDE.md)
- `fix/naver-sku-matching` 커밋:
  - `feat: tier-1 link-id anchoring (resolve curated N, match result link)`
  - `feat: cap/cache redirect resolution for naver.me anchoring`
  - `fix: tier-2 fallback variant disambiguation + bulk exclusion` (B 흡수)
  - `test: two-tier matcher (anchor, set-anchor, fallback, regression)`
  - `docs: catalog-match-map re-run + set-URL cleanup list`
- 각 커밋 전후 `git diff --stat`/`git diff --check`/`git show --stat HEAD`. 시크릿·`docs/prompts`·`tmp`·`UI_DESIGN.md` 비커밋.
- **DB 쓰기 없음**(검증은 read-only 맵). 라이브 호출 레이트리밋 준수.

## 5. Definition of Done
1. tier-1 링크-id 앵커 동작(정확 SKU 채택, 세트 앵커 → 제외/per-unit + 시트 신호).
2. tier-2 폴백(변형/벌크/단품 우선)으로 앵커 미스 처리(B 흡수).
3. redirect 해석 캡·캐시로 비용 관리.
4. **map 재실행 before/after**: 앵커 정확·기존 OK 미감소·시트 URL 정리 리스트 산출.
5. test/typecheck/build green, worklog. DB 무변경.

## 6. 막히면
- 링크 해석이 차단/과다 비용이면 → 캡을 낮추고 그 범위에서의 hit-rate 보고(전량 해석 강행 금지).
- 앵커가 세트로 떨어지는 listing이 많으면 → 시트 정리 신호로 보고(앵커 자체는 정상 — 세트를 단품가로 쓰지만 않으면 됨).
- 폴백이 변형 구분에 실패하는 라인은 보수적으로 no_offer + 보고.

---

## 다음 (이 매처 후)
1. **시트 정리(A)**: 맵의 세트-URL 신호 + 오타 + 데모 → `sheets:import`.
2. **full sync + 웹 반영**(recollect 프롬프트) → 검증(틀린 가격 0, OK 분포 유지) → push/PR/merge.
3. **올영 18건(구조적 미수집)**: manual_override vs link-only 별도 결정.
