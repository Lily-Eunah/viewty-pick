# Claude Code 작업 프롬프트 — 잔여 오매칭 제거 (식별 강화 · 벌크 제외)

> 목적: 0.5 유사도 임계로 빠져나가는 **교차상품/벌크 오매칭**을 없앤다. 잘못된 가격은
> no price보다 나쁘다(trust-first) → 확신 못 하면 **no_offer**. full sync **전에** 처리.
> 근거: `docs/worklog/catalog-match-map.md` caveat #3.
>
> 베이스: 같은 `fix/naver-sku-matching` 브랜치(매처 일관). 신규 커밋.

---

## 0. 확정된 증상 (map)
- **닥터지 #76/#256** → 같은 라인의 *다른 SKU* "레드 블레미쉬 수딩 크림"(27,600/38,000)을 매칭 — 큐레이션은 "레드 블레미쉬 **클리어** 수딩 크림". 변형명 구분 실패.
- **일리윤 #91 쿠팡 81,840** → 벌크/케이스(대량) 추정.
- 원인: title 유사도 0.5 임계가 낮아 **동일 라인 다른 변형/벌크**가 통과.

## 1. 수정

### 1a. 식별 강화 (단순 임계 인상 아님)
- 임계만 전역으로 올리면 정상 단품도 탈락하니, **구분 토큰 기반**으로:
  - 큐레이션 제품명의 **핵심 변형 토큰**(예: `클리어`, `퍼플`, `3번`, `포맨`, 번호/색/라인)을 후보 제목이 **포함하는지 필수 검사**.
  - 토큰셋 유사도 + 필수 변형 토큰 일치를 함께 요구 → 같은 라인 다른 변형 배제.
- 확신 못 하면 채택 금지 → **no_offer**(잘못된 가격 금지).

### 1b. 벌크/케이스 제외
- 세트/번들 분류(`classifyOfferComposition`)에 **벌크/대량 패턴** 추가: `대용량`,`업소용`,`box`,`박스`,`케이스`,`대량`, 큰 수량(예: `30개`,`12개입` 등 과다), 비정상 고가(같은 단품 대비 배수) → 단품 아님으로 분류 → 제외.

### 1c. 회귀 방지 (필수)
- **catalog-match-map 재실행(read-only)** 후 비교: 닥터지/일리윤이 *정상 또는 no_offer*가 되고, **기존 OK 58건이 줄지 않는지**(정상 단품이 새로 탈락하지 않는지) 확인. 분포 before/after 제시.

## 2. 테스트
- 식별 강화: "레드 블레미쉬 클리어 수딩 크림" 큐레이션 → "레드 블레미쉬 수딩 크림"(다른 변형) 후보 **제외**, 정확 변형은 매칭.
- 벌크 제외: 대용량/케이스/과다수량/이상고가 → 제외.
- 회귀: 기존 OK 케이스(유세린 60,900·라하 16,800 등) 유지.
- `test:all`·typecheck·build green.

## 3. 브랜치 & 커밋 (CLAUDE.md)
- `fix/naver-sku-matching`에 커밋:
  - `fix: require variant tokens to disambiguate same-line SKUs`
  - `fix: classify bulk/case offers as non-single (exclude)`
  - `test: variant disambiguation + bulk exclusion`
  - `docs: catalog-match-map re-run (before/after distribution)`
- 각 커밋 전후 `git diff --stat`/`git diff --check`/`git show --stat HEAD`. 시크릿·`docs/prompts`·`tmp`·`UI_DESIGN.md` 비커밋.
- **DB 쓰기 없음**(검증은 read-only 맵 재실행). 라이브 조회 레이트리밋 준수.

## 4. Definition of Done
1. 닥터지/일리윤(및 동류) 오매칭 제거 — 정상 매칭 또는 no_offer.
2. 변형 토큰 구분 + 벌크 제외 구현·테스트.
3. **map 재실행 before/after**로 기존 OK 미감소(회귀 없음) 확인.
4. test/typecheck/build green, worklog 갱신. DB 무변경.

## 5. 막히면
- 변형 토큰을 일반화하기 어려운 라인은 보고(과도 일반화로 정상 탈락 금지) — 모호하면 보수적으로 no_offer.
- 벌크 판정이 정상 다중팩(라하 6개 등 의도된 비교)과 충돌하면 구분 기준 보고.
- 회귀로 OK가 크게 줄면 멈추고 분포·원인 보고(임계 과도 인상 경계).

---

## 다음 (이 수정 후)
시트 정리(A) 완료 + 이 매처 수정(B) 완료 → **full sync + 웹 반영**(recollect 프롬프트) → 검증(틀린 가격 0, OK 분포 유지) → push/PR/merge.
별개로 **올영 구조적 미수집(18건)**은 manual_override(중요 제품) vs link-only 결정 필요 — 이 PR 범위 밖.
