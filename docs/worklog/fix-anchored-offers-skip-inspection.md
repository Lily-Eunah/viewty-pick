# fix/anchored-offers-skip-inspection

## 문제 (운영자 보고)
1. goodsNo 앵커된 "비벨벳 커버쿠션 본품+리필"이 **inspection으로 빠짐**. 앵커=운영자가 검토해 넣은 SKU라 그냥 노출돼야 함.
2. inspection 행의 **제목/예측 개수·용량·단위·구성/추정가격이 모두 비어 있음**.

## 원인
1. OY "본품+리필"(용량 없는 동종번들)은 `pickOliveYoungOffer`의 `homogeneousBundleQty` 분기에서 **no_offer 검수**로 감(loose 매칭 가정). goodsNo 앵커돼도 그 분기를 탐. 또 priced로 매칭됐어도 LLM이 medium/per-unit불가로 보면 4.2c가 inspectionWarning→검수로 강등.
2. no_offer→`routeNoOffer` 경로가 prefill 컬럼(title/pred)을 안 채움(PR #74 prefill은 priced-warning 경로에만).

## 수정
- **앵커=노출**: `OfferMatchResult.anchored` / `PriceOffer.anchored` 추가.
  - `pickOliveYoungOffer`: goodsNo 일치 시 유사도/밴드/세트 판정 **스킵하고 그대로 채택**(matched, anchored:true). 개수/용량은 run.ts LLM+normalize가 산출.
  - 네이버 Tier-1(id-anchored) 반환 `anchored:true`, 쿠팡 productId 정확매칭 `anchored:true`.
  - `run.ts` 4.2c: `offer.anchored`면 LLM 불확실(needsInspection)이어도 **inspectionWarning 미설정 → 검수 강등 안 함 → 노출**.
- **no_offer 검수행 prefill**: `routeNoOffer`가 `offer.suspectedTitle` + `offer.parsedPackage`(개수/용량/단위/구성)로 prefill. run.ts §B verify는 자동적용 안 돼도 `offer.parsedPackage=verify`를 붙여 prefill 제공. OY 동종번들 no_offer 반환에 `suspectedTitle`/`suspectedPrice` 추가.

## 동작
- 비벨벳(goodsNo 앵커) → OY 매처가 그대로 채택(anchored) → 노출(검수 X). 개수는 LLM "본품+리필"→2(high) 또는 보수적 1.
- 비-앵커 검수행 → 제목+LLM 예측 prefill 채워짐(운영자 O/수정+O).

## 테스트
- `test:naver`/`oliveyoung`/`coupang`/`routenooffer`(prefill 케이스 추가)/`parsepackage` ✅, `test:all` exit 0, `tsc` ✅.
