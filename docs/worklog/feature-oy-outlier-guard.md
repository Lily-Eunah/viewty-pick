# feature/oy-outlier-guard — OliveYoung cross-seller price-outlier rejection

## 목적
OliveYoung(네이버 경유) 오퍼 선택 시, **키워드 기반 제외 없이** 순수 가격
outlier와 "단품" 표기로 단품을 자동 채택한다. 디바이스/번들 키워드로는 아무것도
제외하지 않는다(디바이스가 정품 구성일 수 있으므로 과제외 방지).

예) 바이오힐보 NAD: OY 후보 157,700(`[슈링크홈디바이스]…기획`=디바이스 번들) vs
39,000(`…세럼 30ml [단품/기획]`=단품) → 기존엔 "모호"로 둘 다 보류. 개선 후
**39,000 단품 자동 채택**.

올리브영(OY) 경로(`pickOliveYoungOffer`/`matchOliveYoungOffer`)에만 적용.
네이버 브랜드스토어/쿠팡 앵커 로직(`matchNaverOffer`/`pickAnchoredOffer`)은 무변.

## 구현 (crawler/adapters/naver.ts)
`pickOliveYoungOffer`에 밴드 체크 **이전** 단계로 다후보 디스앰비규에이션을 삽입.
스코어링/폼충돌 필터/정렬은 기존 그대로, 이후 후보가 2개 이상일 때:

1. **"단품" 문구 우선** — title(원문)에 `단품`이 있는 후보가 일부만 존재하면 그
   후보들로 한정. (바이오힐보 `[단품/기획]` 39,000)
2. **가격 outlier 제외** — 참조가 대비 `[ref/2.5, ref×2.5]` 밖 후보 제거.
   - 참조 우선순위: ① 주입된 동일제품 타판매처 매칭가(`referencePrice` 파라미터,
     run.ts 향후 주입용) → ② 없으면 네이버 검색결과 개별몰 가격 **분포 중앙값**.
   - ②는 분포가 충분할 때만(개별몰 오퍼 ≥ `OY_MIN_DISTRIBUTION`=4) 신뢰. 빈약하면
     스킵(중앙값≈후보 자신 → 신호 없음) → 1번(단품)만 적용. ("참조 빈약 → 보수적")
   - in-band 후보가 ≥1개 남고 일부가 제거될 때만 prune.
3. **동일 제품명 후보 중 최저가 채택** — 디스앰비규에이션 후, 밴드를 각자 통과하는
   후보(sim≥0.6 + 코어토큰 + 비-heterogeneous) 중 **가장 싼 것**을 채택. 같은 제품이면
   최저가가 곧 최선의 가격이므로 모호 보류 없이 최저가 노출(몰바니 18,900, 토리든
   19,700). 밴드를 통과하는 후보가 하나도 없으면 hold/inspection(heterogeneous/저sim/
   코어토큰 부재).

**키워드(디바이스/번들) 제외 없음**: 디바이스/번들은 ①단품 규칙 또는 ②순수 가격
outlier로만 떨어진다. 동종 1+1·증정 기획 gift-strip/개당가, OY 신뢰밴드(sim≥0.6 +
코어토큰), heterogeneous→inspection 등 **기존 가드는 모두 유지**.

신규 상수/헬퍼: `OY_OUTLIER_RATIO`(2.5), `OY_MIN_DISTRIBUTION`(4),
`medianPrice`, `priceInBand`. `pickOliveYoungOffer` 시그니처에 선택적
`referencePrice?: number | null` 추가.

## 주요 변경 파일
- `crawler/adapters/naver.ts` — OY 구간(상수/헬퍼 + `pickOliveYoungOffer` 본문).
- `crawler/adapters/__tests__/naver.test.ts` — 신규 5 테스트.

## 테스트
신규 케이스(모두 통과):
- `단품` 문구 우선: 디바이스 기획 157,700 vs `[단품/기획]` 39,000 → 39,000 (분포
  빈약 → 단품 규칙으로만).
- 가격 outlier 제외(키워드/단품 없음): 분포 33k~41k 중앙값 대비 157,700을 outlier로
  제거 → 39,000 채택.
- 주입 참조가(① 타판매처): ref 38,000 → 157,700 제거 → 39,000.
- 키워드만으로는 제외 안 함: in-band 디바이스 단일 후보는 키워드로 컷되지 않고 기존
  heterogeneous 가드(inspection)로만 처리.
- 동일 제품명 근접 2후보 → 최저가 채택: 몰바니 18,900/28,000 → 18,900,
  토리든 19,700/22,000 → 19,700.

기존 회귀 보존: 조선미녀 맑은쌀 hold(저sim), 스테이프레쉬 auto-price, 닥터지 토너세트
form-conflict hold — 전부 그대로 PASS.

게이트: `test:all`·`typecheck`·`lint`(신규 파일 무결, 기존 `.open-next` 생성물
경고만)·`build` 전부 green. DB 쓰기 없음.

## 정책 결정 (동일 제품명 → 최저가)
운영자 결정: 제품명이 동일한 후보가 여럿이면 **최저가를 채택**한다(모호 보류 X).
초기 구현은 트러스트-퍼스트로 근접 2후보를 hold했으나, 운영자 지시로 같은 제품의
근접 가격은 최저가가 곧 최선의 가격이라는 판단에 따라 밴드 통과 후보 중 최저가 채택으로
변경. 식별 안전장치(sim≥0.6 + 코어토큰 + 비-heterogeneous)는 유지되어 다른 제품이
싸다는 이유로 잘못 채택되지 않는다.

## 남은 이슈 / TODO
- 참조 우선순위 ①(타판매처 매칭가)는 파라미터만 제공. 실제 cross-seller 가격 주입은
  run.ts에서 별도 배선 필요(현재는 ② 검색 중앙값 폴백). 어댑터는 listing 단위
  실행이라 동일 product의 다른 셀러 결과를 모으는 조정 레이어가 필요.
- 머지 후 다음 `crawler:sync`에서 바이오힐보 등 자동 반영. 즉시 회수 필요 시 그 전
  manual_override=39,000.
- outlier 임계(2.5×)는 보수적 시작값. 운영 데이터로 정상 후보가 잘리지 않는지 모니터.
