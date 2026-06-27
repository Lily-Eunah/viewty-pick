# feature/llm-verify-inspection

## 목표 (B)
세트/저신뢰로 inspection 갈 후보(특히 **어댑터 휴리스틱 세트** = OY 이종세트/저밴드)를 **LLM이 한 번 더 검증** → LLM confidence **high**면 inspection 대신 가격 자동 반영. 검수 backlog↓. `LLM_TITLE_PARSE=on`에서만.

## 구현
- `naver.ts pickOliveYoungOffer`: needsInspection 반환(이종세트·저밴드)에 **`suspectedTitle`(후보 제목) + `suspectedPrice`(후보 lprice)** 추가. 단, **이종세트의 운영자 hint `inspectionEstimatedPrice`는 null 유지**(세트가는 per-unit 아님 — 기존 불변식/테스트 보존). suspectedPrice는 §B 검증-구제용 raw 가격.
- `OfferMatchResult`/`PriceOffer`: `suspectedTitle`·`suspectedPrice` 필드. `oliveyoung.ts` no_offer 반환에 전달.
- `parsePackage.ts`: `canAutoApplyVerify(r)` = `method==='llm' && confidence==='high' && !needsInspection && !heterogeneous` (순수, 테스트).
- `run.ts` (4.2a, outcome 분기 전): no_offer + needsInspection + suspectedTitle + 가격이 있으면 `parsePackage`로 1회 검증. `canAutoApplyVerify`면 → `salePrice=suspectedPrice`, `outcome='ok'`, `parsedPackage=verify`, `sourceText=suspectedTitle` 로 **priced 경로로 승격**(이후 normalize/healthcheck 정상). 아니면 그대로 no_offer→inspection.

## 동작
- OY가 "이종세트/저신뢰"로 판단해 검수로 보내려던 것을, LLM이 high-confidence 단품/번들로 보면 **그 가격을 자동 노출**. 그 외(medium/low/이종/환각)는 검수 유지.
- 캐시 덕에 verify는 제목당 1회(이후 0콜). off면 전부 기존 거동.

## 테스트
- `canAutoApplyVerify`(high→true, medium/이종/검수/regex→false) ✅, `test:all` exit 0 ✅, `tsc` ✅. (이종세트 hint=null 불변식 유지 확인.)
