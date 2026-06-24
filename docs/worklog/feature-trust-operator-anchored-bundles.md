# feature/trust-operator-anchored-bundles

## 목표
운영자가 직접 넣은 앵커 링크(id-anchored / 큐레이트 SKU)는 신뢰한다. "이종 세트처럼
보인다"는 이유로 **link_only로 떨구지 않는다** — 가능하면 본품가를 계산해 inspection
(O/X)에 미리 채워 넣고, 정말 모호하면 inspection(빈칸/앵커가)으로 보낸다. link_only는
*가격을 아예 못 얻는* 경우(앵커 미스 + 오퍼 없음)만.

### 고친 두 케이스
- naver "[6월] 제니피끄 세럼 115ml 세트 **(+로션, 세럼)**" → 로션·세럼은 **증정**.
  이전: heterogeneous(SET word) → needsInspection **빈칸**. 이제: 증정 strip + 본품
  115ml에 번들가 전체 귀속(보수적 ml당) → inspection 추정가 = 본품가.
- oliveyoung "VDL 커버 스테인 하이커버 쿠션 기획 **(본품+리필)**" → 같은 제품 **동종 번들**.
  이전: 용량 없는 본품+리필이 단품(qty 1)으로 읽혀 풀 번들가로 자동 노출. 이제:
  동종 번들 ×2로 인식 → inspection 추정가 = lprice/2 (per-unit).

## 주요 변경

### crawler/adapters/naver.ts
- `homogeneousBundleQty(title)` (신규, export): 용량이 없어 per-unit을 못 뽑는 **동종**
  번들의 개수(본품+리필=2, 1+1/2+1, N개/팩/병/입/매, ×N). bare "N종"·이종 세트·단품은 null.
- `priceGiftBundleOnMain(title, mainVolumeMl, name)` (신규, export): 큐레이트 본품(DB
  용량)이 제목에 있고 폼 일치 + 디바이스 아님 + 나머지 용량이 모두 본품보다 작거나
  무용량(증정) + 본품 용량 1회만 등장(동등 2nd main이면 null) + 증정/번들 맥락 → 본품
  식별. (#47 minor add-on을 *증정이 다른 품목*인 경우로 확장.)
- `pickAnchoredOffer` 재작성 — heterogeneous-LOOKING 앵커 SKU는 절대 link_only 금지:
  - (a) 본품 + 소량 부스트(작은 용량 add-on) → 기존대로 본품 자동 가격(matched).
  - (b) `priceGiftBundleOnMain` 식별 → inspection, 추정가 = 번들가 전체(본품 귀속, 보수적).
  - (c) 본품 식별 불가(진짜 다중-main) → inspection, 추정가 = 앵커가(힌트).
  - 비-heterogeneous인데 무용량 동종 번들(본품+리필 등) → inspection, 추정가 = lprice/qty.
- `pickOliveYoungOffer` — `mainVolumeMl` 옵션 인자 추가. auto-price 직전, 채택 후보가
  무용량 동종 번들이면 inspection(추정가 = lprice/qty)으로 우회(VDL). 용량 있는 번들은
  기존대로 per-unit 자동 가격. `matchOliveYoungOffer`가 `product.volume_ml` 전달.

### crawler/sheets/inspection.ts
- `upsertInspection`이 `pendingItems`(blank 승인 행) 반환. 이미 O/X 찍힌 건은 시트에는
  보존되지만 Discord 검수 대기 목록엔 다시 안 뜬다.

### crawler/run.ts
- Discord 검수 대기 목록을 `res.pendingItems`로 구성(제품·추정가·출처·사유·링크). 기존
  `inspectionCandidates` 전체가 아니라 미검수(blank)만 노출 → O/X 재노출 방지.

## 라우팅 (#50 갭)
- 앵커 이종 / OY 이종은 `needsInspection`로 inspection 전파(양 adapter 모두 propagate 확인).
  link_only는 앵커 미스 + 오퍼 없음(쿠팡 productId 미노출, OY 오퍼 미발견) 전용으로 유지.
- `routeNoOffer`의 data_error → 항상 link_only 회귀 테스트 green(변경 없음).

## 테스트 (모두 통과)
- naver.test.ts: `homogeneousBundleQty` / `priceGiftBundleOnMain` 단위, 제니피끄 증정→
  inspection(추정가=본품가), VDL 동종 번들→inspection(lprice/2), 본품 식별 불가 2종
  동등→inspection(추정가=앵커가), OY VDL 동종 번들→inspection. 기존 §C 소량 부스트
  자동가격·이종 needsInspection 회귀 모두 유지.
- inspection.test.ts: pending(Discord) 목록 = blank 승인만 → 이미 O 찍은 건 재노출 안 됨.
- `test:all` / `typecheck` / `lint`(기존 warning 3건만) / `build` 모두 green.

## 보수성 / 리스크
- 운영자 링크 신뢰 = 운영자가 올바른 링크를 넣는다는 전제. 번들가→본품 귀속이라 ml당이
  약간↑(보수적) → *가짜 최저가* 위험 낮음. 식별 불확실 시 조용히 떨구지 않고 inspection으로.

## 남은 TODO
- merge 후 `crawler:sync` → 제니피끄 115ml·VDL이 inspection에 본품가로 잡히고 link_only에서
  빠지는지, O 후 노출/보존 확인.
