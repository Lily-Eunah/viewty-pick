# Claude Code 작업 프롬프트 — OY 신뢰 밴드 가드 (auto-price vs hold+검수)

> 목적: 느슨 OY 매칭이 **같은 브랜드 다른 제품/세트를 조용히 auto-price**하는 것(#34 맑은쌀, #76 세트)을 막는다.
> 느슨함은 유지하되 **auto-price 기준만 높이고**, 미달은 *드롭이 아니라* **hold+검수 알림(Tier 3/4)**로 보낸다(정상 제품 탈락 없음).
> 적용: **(b) 신뢰 밴드** + 그 "high" 기준에 **(a) 핵심 제품명 토큰 존재** 결합. 대상: `pickOliveYoungOffer`만(브랜드스토어 N 앵커는 불변).
>
> 베이스: `fix/naver-sku-matching`.

## 1. `pickOliveYoungOffer` 변경 — 신뢰 밴드
후보: `mallName='올리브영'` + form-conflict 제외(현행 유지). 그 위에 밴드:

- **HIGH → auto-price (Tier 2)**: `유사도 ≥ HIGH(예 0.6)` **AND 핵심 토큰 존재**.
  - **핵심 토큰**: 큐레이션 제품명에서 브랜드·카테고리어(선크림/토너/세럼/크림/클렌징/쿠션…)·홍보어(증정/기획/단독/세일…)를 뺀 **distinctive 토큰**(예: `스테이프레쉬`, `포맨`, `3번`). 그 토큰이 OY 제목에 **있어야** HIGH. (홍보문구는 토큰을 *더하지* 빼지 않으니 promo 노이즈엔 강건 — 엄격 변형매칭과 다름.)
- **그 외 → hold + 검수(`needsInspection`)**: 유사도 미달 / 핵심 토큰 부재 / **OY 후보 복수 경합(top-2 유사도차 작음, 예 <0.1)** / 이종(heterogeneous). → auto-price 안 함, Discord·검수 큐 알림, Tier 3(manual_override)/Tier 4(link-only).
- 동질 묶음(1+1·N팩·리필)은 HIGH면 그대로 개당가 수집(세트 포함 정책 유지). 증정은 미반영.

## 2. 검증 (read-only map before/after)
- **#34 조선미녀**(맑은쌀): 스테이프레쉬 토큰 부재 → **hold(검수)**, *틀린 25,300 auto-price 안 됨*.
- **#76 닥터지**: 세트/저신뢰 → hold.
- **정상 OY는 그대로 priced**(과도 hold 없는지 — OY priced 수 before/after 비교). hold된 것 = manual_override 후보 목록.
- 브랜드스토어 앵커·쿠팡 영향 없음. `test:all`·typecheck·build·lint green.

## 3. 테스트
- 맑은쌀(스테이프레쉬 큐레이션) → 핵심 토큰 부재 → needsInspection(no price).
- 스테이프레쉬 본품(토큰 존재 + 고유사도) → priced.
- OY 후보 2개 근소 경합 → needsInspection.
- 이종/세트 → needsInspection. 정상 단품 → priced(회귀).

## 4. 브랜치 & 커밋
- `fix/naver-sku-matching`: `feat: oy confidence band (core-token + similarity → auto-price else inspect)`, `test: oy confidence guard`, `docs: map re-run`.
- `git diff --check`, 시크릿/`docs/prompts`/`tmp`/`UI_DESIGN.md` 비커밋. **DB 쓰기 없음**.

## 5. DoD
1. OY auto-price = 고유사도 AND 핵심 토큰 존재일 때만. 미달 → hold+검수(드롭 아님).
2. #34·#76 hold 확인(틀린 가격 미발생), 정상 OY 과도 hold 없음(before/after).
3. 테스트/빌드 green, hold 목록 = manual_override 후보.

## 6. 막히면
- 핵심 토큰 추출이 애매한 제품(짧은 이름 등)은 보수적으로 hold+보고(억지 auto-price 금지).
- HIGH 임계로 정상 OY가 대거 hold되면 임계 후보 몇 개로 측정해 보고(과도 hold 경계).
