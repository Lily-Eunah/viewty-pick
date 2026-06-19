# Claude Code 작업 프롬프트 — 용량 불일치 priced+alert 정책 + gift-strip 확장(작은 부스트=증정)

> 목적: ① 앵커로 URL이 맞은 오퍼는 **용량이 달라도 base 가격은 가져와 노출**하고(ml당은 신뢰 시만), 불일치는 **알람**만. ② 작은 부스트/부속(예: 아벤느 +10ml)은 **증정으로 처리**해 단품가로 인정.
> 베이스: 최신 `main`. 분기 `feature/volume-alert-giftstrip`. 대상: `crawler/core/healthcheck.ts`, `crawler/core/normalize.ts`, `crawler/core/packageExtractor.ts`, notify.

## 변경 1 — 네이버/쿠팡: 앵커되면 무조건 가격 채택, 이상하면 hold가 아니라 **warning** (운영자 규칙)
> 정책: "링크가 있고 productId가 앵커되면 **세트/번들/ml 달라도 가격은 가져온다.** 단, *다른 게 섞인 세트/번들*이거나 *ml이 이상*하거나 *타 플랫폼 대비 가격이 너무 다르면* **warning만** 보내 검토하게 한다. 맞는 URL이면 유지, 틀리면 운영자가 URL 바꾸고 재sync."
- **앵커(productId 일치)된 오퍼는 항상 base 가격 저장·노출** — 현재의 "heterogeneous 세트 → hold(가격 없음)"·"용량불일치 → warning 숨김"을 **노출+warning**으로 완화.
  - status는 **노출되는 값**(예: `ok`)으로 두고, 아래 조건이면 `unit_price_reliable=false` + **운영자 warning(검토 큐)**:
    1. 다른 제품이 섞인 세트/번들(이종),
    2. 용량 불일치(수집 Xml ≠ 등록 Yml),
    3. **타 플랫폼/검색분포 대비 가격 outlier**(예: 중앙값의 2.5배 초과 등).
  - **ml당(unit_price)은 용량 신뢰 시에만** 채우고 불일치면 null(웹은 reliable일 때만 ml당 표시). base 가격은 항상 노출.
- **비앵커(productId 못 찾음/퍼지)** 는 기존대로 보수적(가격 안 만듦) — 이 완화는 "productId로 확정된" 오퍼에만.
- ±50% 가격 점프 등 기존 룰은 warning으로 유지.

## 변경 2 — gift-strip 확장: 작은 부스트/부속 = 증정
- `stripPromoGifts`/heterogeneous 판정에서, **본품 외 부속이 "작은 증정"이면 세트가 아니라 증정으로 처리**(가격=본품, 수량 미반영):
  - 신호: 용량이 본품 대비 작음(예: ≤15ml 또는 본품의 ~1/3 이하) **또는** 증정/부스트/미니/샘플/체험/트라이얼 라벨.
  - 예: 아벤느 히알루론 B3 세럼 + **부스트 10ml** → 10ml를 증정으로 보고 **세럼 단품가로 인정**(현재는 이종 2-제품 세트로 보류 중).
- **진짜 이종 세트(서로 다른 본품 2개가 대등, 예: 세럼30+크림30)** 는 계속 보류/검수. 즉 "작은 부속"만 증정 처리, 대등한 이종은 아님.
- 제니피끄(115ml가 등록 50ml와 다른 제품 의심)는 이 룰로 자동 통과시키지 말고 — 용량 불일치 알람(변경1)으로 노출+검수.

## 테스트
- 앵커된 용량불일치(엑설런트 1+1, 멜라TXA 40 vs 50 등) → base 가격 노출 + ml당 null + 알람. 통째 숨김 아님.
- 비앵커 퍼지 건은 가격 노출 안 함(회귀).
- 아벤느 B3(+부스트 10ml) → 단품가로 매칭(이종 보류 해제).
- 세럼30+크림30 같은 대등 이종은 여전히 보류.
- `test:all`·typecheck·build green.

## 브랜치 & 적용
- `feature/volume-alert-giftstrip`: `feat: anchored volume-mismatch → priced+alert (ml당 only if reliable)`, `feat: gift-strip small boosters (treat as 증정, not set)`, `test`, `docs: worklog`.
- 영어 PR → CI → merge → `crawler:sync` → `cf:deploy`.

## 막히면
- "작은 부속" 임계(≤15ml/본품 1/3)는 보수적으로, 정당한 이종 세트를 증정으로 오인하지 않게 테스트로 검증.
- priced로 노출시키는 신규 상태가 public view 필터(status='ok'&high)와 맞물리는지 확인(노출되도록).
