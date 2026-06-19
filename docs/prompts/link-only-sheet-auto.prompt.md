# Claude Code 작업 프롬프트 — link_only 시트 탭 자동 유지 (가격 못 가져온 링크 정리)

> 목적: 크롤 대상(naver/coupang/oliveyoung) 중 **가격을 못 가져온 link-only 링크**(no_offer / 폴백 실패 / 이종세트 보류 등)를 매 `crawler:sync`마다 **`link_only` 시트 탭에 자동 정리**. 운영자가 원인을 보고 액션(쿠팡 URL 교체, 네이버/올영 확인)을 취하게.
> 참고: inspection 탭(=가격은 있으나 warning, O/X)과는 별개 — 여기는 **가격 자체가 없는** 링크.
> 베이스: 최신 `main`. 분기 `feature/link-only-sheet`. 대상: `crawler/run.ts`(크롤 결과 집계 + 시트 write), 시트 `link_only` 탭(이미 생성됨). inspection 탭 write 로직 재사용.

## link_only 탭 컬럼 (이미 운영자 시트에 존재)
`판매처 | 브랜드 | 제품명 | productId | 원인 | 권장 액션 | URL | 상태 | 갱신일`

## 자동 채움 규칙 (매 sync)
- 대상: **크롤 대상 판매처(어댑터 있음: naver/coupang/oliveyoung)** 중, 이번 run에서 **가격 스냅샷이 ok/warning이 아닌** 링크(no_offer / data_error / 폴백 실패 / 이종세트 hold).
  - **zigzag/ably(어댑터 없음)는 제외** — 의도된 link-only지 매칭 실패가 아님.
- 각 링크를 `product_key + seller`(또는 link_key) 키로 **upsert**: 원인/권장액션/URL/상태/갱신일 최신화.
- **원인(cause)** 자동 분류:
  - coupang: `productId가 Partners 검색 top-N에 없음(검색 전용 API)`
  - oliveyoung: 이종세트면 `올리브영 오퍼가 이종 세트 → 검수 보류`, 아니면 `네이버 검색에 올리브영 단품 오퍼 미발견(Tier 3/4)`
  - naver: 이종세트면 `id-anchored이나 묶음(이종 세트) → 검수 필요`, anchor miss면 `anchor miss + 공식몰/카탈로그 폴백 없음`
- **권장 액션**: coupang `검색 상위 쿠팡 URL로 교체` / oliveyoung `올리브영 단품 판매·URL 확인` / naver `공식몰 단품 URL 확인·교체 또는 세트 분리`.
- 어댑터/룰에서 이미 아는 outcome·사유를 그대로 매핑(새 추론 로직 만들지 말 것). 분류 근거는 crawl 단계의 outcome/로그 사유.

## 해결된 항목 정리
- 다음 sync에서 그 링크가 **ok/warning으로 가격이 잡히면** link_only 탭에서 **행 제거**(또는 상태='해결'). 즉 미해결만 남게.

## (선택) Discord 연계
- 요약에 `가격 미매칭 link-only: N건` + link_only 탭 안내. inspection(N건)과 구분 표기.

## 테스트
- no_offer/폴백실패 링크가 link_only 탭에 기록(원인·액션 채워짐). zigzag/ably는 기록 안 됨.
- 다음 sync에 가격이 잡힌 링크는 탭에서 제거. 키 충돌·중복 0.
- inspection 탭(O/X)·기존 동작 회귀 0. `test:all`·typecheck·build·lint green.

## 적용
- `feature/link-only-sheet`: `feat: auto-maintain link_only sheet for unmatched (no-price) crawl-target links`, `test`, `docs: worklog`. 영어 PR → CI → merge → `crawler:sync`로 탭 자동 채움 확인.
- 시트 write는 서비스계정(기존 inspection/freeze write-back과 동일 권한). 시크릿·`docs/prompts`·`tmp` 비커밋.

## 막히면
- inspection 탭 write 헬퍼를 일반화해 link_only에도 재사용. 원인 분류가 어댑터 outcome로 안 떨어지면, 우선 seller별 기본 사유만 넣고 세부는 후속.
