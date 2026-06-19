# Claude Code 작업 프롬프트 — 전체 카탈로그 매칭 맵 (READ-ONLY 진단)

> 목적: 수정된 매처(`fix/naver-sku-matching`)를 **전 카탈로그에 read-only로** 돌려, 제품·판매처별
> 매칭 결과를 분류하고 **시트에서 고쳐야 할 것(오타·다중팩 URL·allowlist·데모 제품)을 한 장으로** 만든다.
> full 쓰기 sync 전에 데이터 수정 범위를 한 번에 확정하는 게 목표. **DB·시트·코드(기능) 변경 없음.**
>
> 베이스: `fix/naver-sku-matching` 브랜치(새 매처 사용). 진단 스크립트/리포트만 추가 가능.

---

## 0. 안전 원칙
- **READ-ONLY.** `crawler:sync`·`sheets:import`·DB write 금지. `price_snapshots`/`current_prices`/`last_crawled_at` 변경 없음.
- 라이브 조회만(네이버 검색 API·쿠팡 검색 API·올영 via 네이버), 레이트리밋 준수(쿠팡 50/min). 시크릿 비노출.
- 반드시 **`fix/naver-sku-matching` 브랜치**에서(새 매처). `git rev-parse --abbrev-ref HEAD` 확인.

## 1. 진단 방법
- **실제 매처 함수를 그대로 호출**한다 — `pickOfficialOffer` / `classifyOfferComposition` 등. **재구현 금지**(맵이 실제 동작과 달라지면 무의미). live-check 하니스 패턴 재사용.
- 활성 listing 전수(naver / coupang / oliveyoung-via-naver)에 대해:
  1. 라이브 검색 실행 → 후보 목록 확보.
  2. 매처 적용 → **선택된 오퍼(또는 no_offer)** + **분류(단품/세트/번들/다중팩)** 기록.
  3. **후보 진단**: "정상 단품이 후보에 존재했는가?" — 존재하는데 선택 안 됐으면 findability/이름 문제, 후보에 단품 자체가 없으면 미입점/세트only.

## 2. 분류 (각 listing을 하나로)
| 분류 | 의미 | 후속 |
|---|---|---|
| ✅ OK 단품 | 단품 매칭, 값 정상 | 없음 |
| ⚠️ 이름 오타/불일치 | 검색은 됐는데 제목 유사도 미달(정상 단품이 후보에 있음에도 미매칭) | **시트 제품명 수정** (예상 단품 제목 제시) |
| ⚠️ 큐레이션 URL = 다중팩/세트 | listing.url이 단품 아닌 팩/세트를 가리킴(예: 후시다딘 쿠팡 5팩) | **시트 URL을 단품으로 교체** |
| ⛔ no_offer (정당) | 단품이 진짜 없음(세트only/미입점) | 없음(의도된 trust-first) |
| ⚠️ allowlist 갭 | 올영 등 mallName 미등록으로 매칭 실패 | **allowlist 입력(운영자 확인 mallName)** |
| 🔎 데모/오큐레이션 의심 | 어느 판매처에도 정상 단품 없음 / MVP 큐레이션과 불일치(고가 백화점 등) | **카탈로그 정리(제거 검토)** |

## 3. 힌트 제공 (운영자 수정 쉽게)
- **오타 의심**: 검색 결과의 **가장 가까운 실제 제목**을 같이 표기 → "현재명 vs 실제명"으로 수정값 추론(예: `하이아르론` → `하이알루론`). 가능하면 완화 쿼리로 단품이 잡히는지 read-only 확인.
- **다중팩 URL**: listing.url이 가리키는 게 N팩/세트임을 명시.
- **allowlist**: 어떤 브랜드의 올영이 mallName 미등록으로 빠지는지.

## 4. 산출물 (리포트만, 쓰기 없음)
- **per-listing 표**: 제품 | 판매처 | listing.url | 검색 후보 요약 | 매처 결과(선택/ no_offer) | 분류 | 수정 제안.
- **운영자 수정 리스트(카테고리별)**:
  1. 시트 제품명 오타 → 수정값
  2. 큐레이션 URL 다중팩 → 단품 URL 교체 대상
  3. allowlist 입력 필요 mallName
  4. 정당한 no_offer(수정 불필요)
  5. 데모/오큐레이션 정리 후보
- **요약 분포**: OK / 오타 / URL / no_offer(정당) / allowlist / 데모 건수.
- `docs/worklog/catalog-match-map.md`에 기록.

## 5. 제약
- DB·시트·`crawler:sync`·`sheets:import` 절대 실행/변경 금지(순수 진단).
- 진단 스크립트(`scripts/ops/catalog-match-map.ts` 등)와 리포트만 커밋 가능(기능/데이터 무변경). `git diff --check`.
- 시크릿·개인정보 비노출.

## 6. 막히면
- 매처 함수를 직접 호출하기 어려우면(결합도) 그 사실 보고 — **재구현으로 우회 금지**(실제 동작과 괴리 위험).
- 레이트리밋으로 전수가 길면 판매처/제품 배치로 나눠 돌리고 진행 상황 보고.
- "정상 단품 존재 여부" 판정이 모호한 케이스는 *모호*로 표시(억지 분류 금지).

---

## 다음 단계 (이 맵 이후)
1. 운영자: 맵의 수정 리스트대로 **시트 정리**(오타·URL·데모) → `sheets:import`.
2. **전체 sync + 웹 반영**(recollect 프롬프트) → 검증 → push/PR/merge.
이 맵이 "시트에서 뭘 고칠지"를 한 번에 확정해, full 쓰기 sync 반복을 피한다.
