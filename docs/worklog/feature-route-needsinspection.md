# feature/route-needsinspection — route needsInspection to inspection O/X (not link_only)

## 구현 요약
매처가 `needsInspection: true`로 표시하는 "세트 의심 / 저신뢰 밴드" 건(예: 랑콤 제니피끄
얼티미트 세럼 @naver id-anchored 이종 묶음, VDL 커버스테인 하이커버 쿠션 @oliveyoung
이종 세트, 올리브영 저신뢰 밴드)을 **link_only가 아니라 inspection(O/X) 탭**으로 라우팅한다.
운영자가 단품임을 확인하면 추정가를 입력하고 `승인=O` → 다음 sync에 노출, `X` → 숨김 유지.

이전에는 매처의 `needsInspection`가 `PriceOffer`로 전파되지 않아 run.ts에서 전부 `no_offer`
→ `link_only`로만 갔다. 이제 플래그를 offer까지 실어 보내고 run.ts에서 분기한다.

## 주요 변경 파일
- `crawler/adapters/index.ts` — `PriceOffer`에 `needsInspection?`, `inspectionEstimatedPrice?` 추가.
- `crawler/adapters/naver.ts`
  - `OfferMatchResult`에 `inspectionEstimatedPrice?` 추가.
  - `pickOliveYoungOffer`: 저신뢰 밴드 hold는 top 후보 lprice를 가격 힌트로 실어 보냄(이종
    세트는 단가 산출 불가 → `null`).
  - `NaverAdapter.fetchOffer`의 no-match(no_offer) 반환에 `needsInspection`/`inspectionEstimatedPrice` 전파.
- `crawler/adapters/oliveyoung.ts` — `OliveYoungAdapter.fetchOffer`의 no-match 반환에 동일 전파.
- `crawler/core/routeNoOffer.ts` (신규) — 순수 라우팅 결정 함수. `no_offer + needsInspection`
  → inspection 아이템, 그 외(앵커 미스/쿠팡 미노출/`data_error`) → link_only 아이템.
  두 목적지는 **상호 배타**. `data_error`는 needsInspection이라도 항상 link_only(소스 URL 문제).
- `crawler/run.ts` — no_offer 분기에서 인라인 link_only push를 `routeNoOffer()` 호출로 교체.
  `classifyLinkOnly` 직접 import 제거(이제 routeNoOffer 내부에서 사용).
- inspection 탭은 **추정가 빈칸 허용** — 기존 `inspection.ts`(`estimated_price: number | null`,
  `rowToValues` → `''`, `approvalOverrides` null 가격 skip)가 이미 지원하므로 변경 불필요.
  빈칸+O는 가격이 없어 무시(운영자가 가격 입력 필요).

## 테스트
- `crawler/core/__tests__/routeNoOffer.test.ts` (신규, `test:routenooffer`, `test:all`에 등록):
  - naver 이종 앵커 세트 → inspection(추정가 빈칸), link_only 아님.
  - OY 이종 세트 → inspection(빈칸), 링크=curator affiliate.
  - OY 저신뢰 밴드 → inspection, estimated=lprice 힌트.
  - 앵커 미스+폴백 없음 → link_only(회귀).
  - needsInspection 미설정/undefined → link_only(기본값).
  - `data_error`(+needsInspection set) → 항상 link_only.
- `crawler/adapters/__tests__/naver.test.ts` — `pickOliveYoungOffer` 저신뢰 밴드 → `inspectionEstimatedPrice = lprice`,
  N종 세트(이종) → `inspectionEstimatedPrice == null` 단언 추가.
- `npm run test:all` / `typecheck` / `lint`(기존 무관 경고 1건 외 0 error) / `build` 모두 green.

## 남은 이슈 / TODO
- merge 후 `crawler:sync` 실행 → 제니피끄·VDL이 **inspection 탭**으로 가고 **link_only에서
  빠지는지** 확인. 운영자 O(가격 입력)/X 동작 확인.
- 가격 힌트(`inspectionEstimatedPrice`)는 OY 저신뢰 밴드 lprice만 채움. naver 앵커 세트 등
  단가 산출 불가 건은 빈칸(운영자 입력) — 후속으로 힌트 소스 확장 가능.
