# Claude Code 작업 프롬프트 — needsInspection(이종 세트 의심 등)을 link_only가 아니라 inspection(O/X)으로 라우팅

> 요구: link_only에 올라오는 **"이종 세트 의심 → 검수 필요"** 건(예: 랑콤 제니피끄 얼티미트 세럼 @naver "id-anchored 묶음", VDL 커버스테인 하이커버 쿠션 @oliveyoung "올리브영 이종 세트")은 **inspection 탭으로 보내** 운영자가 *세트가 아니면 확인 후 가격을 넣어 O* 할 수 있게.
> 현재: 매처가 `needsInspection: true`(naver.ts 이종 앵커 세트 ~423, OY 이종 세트 ~909, OY 저신뢰 밴드 ~914)를 반환하지만, **PriceOffer로 전파되지 않아** run.ts에서 `no_offer`로 처리 → `linkOnlyCandidates`로만 감(run.ts ~322). inspection 분기 없음.
> 베이스: 최신 `main`. 분기 `feature/route-needsinspection`. 대상: `crawler/adapters/index.ts`(PriceOffer 타입), `crawler/adapters/naver.ts`(fetchOffer: naver+OY 경로), `crawler/run.ts`(no_offer 분기 라우팅), `crawler/sheets/inspection.ts`(추정가 빈칸 허용).

## 변경
1. **플래그 전파**: PriceOffer에 `needsInspection?: boolean` (+ 가능하면 `inspectionEstimatedPrice?: number | null`) 추가. naver/OY `fetchOffer`가 매처 결과의 `needsInspection`를 그대로 offer에 실어 반환(매칭가 없으니 `outcome`은 기존대로 no_offer류지만 플래그는 보존). 가격 힌트가 있으면(OY 저신뢰 밴드의 lprice, 앵커 가격 등) `inspectionEstimatedPrice`에 담고, 이종 세트처럼 단가 산출 불가하면 `null`.
2. **run.ts 라우팅**(no_offer 분기 ~301):
   - `offer.needsInspection === true`면 → **`inspectionCandidates`에 push**(linkOnly로 보내지 **않음**):
     - `estimated_price` = `offer.inspectionEstimatedPrice ?? null`(빈칸 가능 — 운영자가 단품 확인 후 입력),
     - `reason` = 매처 사유(예: "이종 세트 의심 — 단품 맞으면 가격 확인 후 O"),
     - `source` = mallName/store, `seller`, `product_key`, `product_name`, `link`.
   - 그 외 no_offer(앵커 미스+폴백 없음, 쿠팡 검색 미노출 등) → 기존대로 `linkOnlyCandidates`.
   - 즉 **needsInspection ↔ link_only는 상호배타**(중복 표기 금지).
3. **inspection 탭/적용**: 추정가 **빈칸 허용**. 운영자가 단품이라 판단하면 가격을 넣고 `승인=O` → 기존 `approvalOverrides`가 price override로 적용해 노출. `X`면 숨김 유지. (빈칸+O는 가격 없으니 무시 — 가격 입력 필요.)

## 테스트
- naver 이종 앵커 세트(제니피끄) → inspection 탭에 행 생성(사유·source·링크, estimated 빈칸), **link_only엔 없음**.
- OY 이종 세트(VDL) → inspection 탭, link_only 제외.
- OY 저신뢰 밴드(가격 있음) → inspection 탭에 estimated=lprice로.
- 앵커 미스+폴백 없음(세라믹 선쿠션 등) → 기존대로 link_only(회귀).
- 운영자 O(가격 입력) → 다음 sync에 노출; X → 숨김. `test:all`·typecheck·build·lint green.

## 적용
- `feature/route-needsinspection`: `feat(crawler): route needsInspection (suspected set / low-confidence) to inspection O/X instead of link_only`, `test`, `docs: worklog`. 영어 PR → CI → merge → `crawler:sync` → 제니피끄·VDL이 inspection 탭으로 가고 link_only에서 빠지는지 확인.

## 막히면
- `inspectionEstimatedPrice` 추출이 애매하면 우선 estimated 빈칸으로 inspection에 올리고(운영자 입력), 가격 힌트는 후속.
- inspection 탭 키(product_key+seller)·upsert·O/X 보존 로직은 기존 그대로 재사용.
