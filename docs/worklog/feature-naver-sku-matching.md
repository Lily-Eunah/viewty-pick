# fix/naver-sku-matching — Naver 단품 SKU 매칭 정확성 (P0)

- **일자**: 2026-06-16
- **베이스**: `main` → 분기 `fix/naver-sku-matching`
- **근거**: `docs/worklog/price-integrity-audit.md` (가격 무결성 audit)
- **범위**: 수집 단계 매칭 정확성(P0). 웹 표시 레이어(mock 제거·다중팩 표시·정렬)는 별도 PR.

## 배경 (audit 확정 근본원인)
Naver Shopping API 매칭(`pickOfficialOffer`)이 큐레이션한 **단품**이 아니라 검색 상위의
**선물세트·기획·더블팩·2종세트·1+1/리필·세럼+디바이스 세트**를 채택 → 세트가를 단품가처럼 노출.
`packageExtractor`는 세트 구성을 오해석(증정 "7ml*2"를 수량으로, 더블/리필 미인식).

## 핵심 결정: productId 앵커링(§1a)은 **불가** → 단품 분류로 폴백(§1b)
라이브 검증 결과:
- 큐레이션 `brand.naver.com/{store}/products/{N}` 번호(예: 랑콤 10791745136)는 **Shopping API 결과 링크에 등장하지 않음** (브랜드스토어 채널상품번호 ↔ 쇼핑 mall상품 링크는 **다른 네임스페이스**).
- 활성 naver+OY listing 72건 중 **45건이 `naver.me`/`oy.run` 단축링크** → 애초에 productId 추출 불가. `naver.me`는 `channelProductNo`(또 다른 네임스페이스)로 resolve됨.
→ 앵커링은 **거의 항상 매칭 실패**로 빠질 것. prompt §6의 폴백 지침대로 **단품 분류 + 단품 우선**을 1순위 해법으로 채택. (추측 앵커 미구현.)

## 변경 사항

### 1. `crawler/core/packageExtractor.ts` — 증정/샘플 클로즈 제거
- `stripPromoGifts()` 신설 + `cleanTitleText()`에서 호출. `(+...증정/샘플/미니/쇼핑백/덤/마스크...)` 괄호·`+증정` 꼬리 제거.
- 효과: "30ml 기획 (+7ml*2)" → 단품 30ml(수량 1)로 정규화. 증정을 수량으로 세지 않음. `normalize`도 동일 이득(같은 추출기 사용).
- bare 가산형 "50ml+50ml"(실 묶음)는 보존.

### 2. `crawler/adapters/naver.ts` — 단품 vs 세트 분류 + 단품 우선 선택
- `classifyOfferComposition(title)` 신설: 순수 비단위 사은품(쇼핑백/파우치 등) 제거 후 잔여 `+`(1+1·리필·세럼+디바이스·이종세트), `×N`, `N개/팩(N≥2)`, 세트 키워드(선물세트/기획세트/더블/N종/패키지/한정/리필/세트) → **set**, 그 외 **single**.
- `pickOfficialOffer()`: 공식몰 + 제목유사도≥0.5 통과 후 **single만** 비교. 단품 중 **DB 용량 일치 단품 우선**, 없으면 관련도 최상위 단품. 단품이 없고 세트만 있으면 **matched=null(no_offer)** → 세트가를 단품가로 노출하지 않음(trust-first: 틀린 값보다 무가격).
- 용량은 여전히 hard-reject 아님(§1b): 단품 후보 중 용량 일치를 **선호**할 뿐, 미일치 시 단품 채택은 유지(기존 계약/테스트 보존).

### 3. `crawler/run.ts` — 관측/신선도 (DoD#5)
- listing 업데이트 시 `last_crawled_at` 기록(기존엔 전 건 NULL).
- `crawl_runs.started_at`를 epoch 숫자 → **ISO 문자열**로 수정(숫자라 적재 실패 → crawl_runs 0건이던 원인).

## 라이브 검증 (새 매처 dry-run, 읽기 전용)
| 제품 | 이전 저장값 | 새 매처 결과 | 실값 대조 |
|---|---|---|---|
| 유세린 에피셀린 세럼 30ml | 105,600 (2종세트) | **60,900** (유세린공식스토어, 용량일치 단품) | ✅ 일치 |
| 토리든 다이브인 포맨 200ml | 네이버 19,700 / OY 38,000(더블) | **19,700** 단품 / OY 더블은 **제외** | ✅ |
| 비플레인 라하 토너 265ml | 16,800 | **16,800** 단품 | ✅ |
| 랑콤 제니피끄 50ml | 170,000 (50ml 선물세트) | **제외(no_offer)** — 공식 단품 미노출 | ✅ 틀린값 제거 |
| 바이오힐보 NAD 세럼 30ml | 99,500 (세럼+디바이스) | **제외(no_offer)** | ✅ 틀린값 제거 |

> 효과: 프리미엄·세트 위주 상품은 **무가격(no_offer)** 으로 떨어질 수 있음(의도된 trust-first). 단품이 명확한 상품은 정확한 단품가로 수렴.

## 테스트
- `npm run test:all` 전체 통과. 신규: `classifyOfferComposition`(단품/세트/증정/1+1/리필/N개/세럼+디바이스), `pickOfficialOffer`(세트 제외·단품 우선·용량 우선), `packageExtractor`(증정 클로즈 제거 2건).
- `typecheck` 통과.

## 의도적 미수행 / 한계
- **productId 앵커링 미구현**: 네임스페이스 불일치로 불가(위 §결정). 향후 `naver.me`/`oy.run` resolve + 채널상품번호 매핑 테이블이 생기면 재검토.
- **retailer_allowlist 시드 미적용**: 현재 0건이며 브랜드명-포함 fallback으로 동작(라이브 확인). OY via 네이버도 어댑터의 `'올리브영'` 기본값으로 동작(랑콤 OY no_offer는 실제로 Naver상 OY offer 부재 → 정상). ⚠️ `matchesOfficialMall`은 allowlist 항목이 있으면 **브랜드 fallback을 무시**하므로, **검증되지 않은 mallName 시드는 해당 브랜드 매칭을 깨뜨린다.** → 운영자 확인된 정확 mallName으로만 채울 것(별도 작업).
- **재수집(원격 쓰기)은 게이트**: 본 PR은 코드/테스트만. 제한 sync → 검증 → 전체 재수집은 운영자 승인 후.

## 제한 재수집 검증 (2026-06-16, 프로덕션 Supabase 쓰기)
백업: `backups/2026-06-16T08-27-00-056Z` (445 snapshots / 48 current_prices). append-only·가역.
`--only=<6 ground-truth keys> --skip-import --no-notify` 로 6개만 재수집.

| 제품 | 이전(틀림) | 재수집 후 | 실값 | 판정 |
|---|---|---|---|---|
| 라하 토너 #69 | 67,800 등 혼재 | **16,800**(네이버 단품) | 16,800 | ✅ |
| 토리든 포맨 #74 | OY 38,000(더블) | **19,700** 네이버 / 19,930 쿠팡, OY 제외 | 19,700 | ✅ |
| 랑콤 #84 | 170,000(선물세트) | **무가격**(세트 제외) | 세트 282,200 | ✅ 틀린값 제거 |
| 바이오힐보 #86 | 99,500/157,700(세트) | **무가격**(디바이스 세트 제외) | 단품(저가) | ✅ 틀린값 제거 |
| 유세린 #85 | 105,600(2종세트) | **무가격** | 60,900 | ⚠️ false exclusion |
| 후시다딘 #30 | 쿠팡 48,160(5팩) | 쿠팡 48,160(5팩) | 단품 | ⚠️ 쿠팡 multipack(범위 외) |

**검증 중 발견 + 조치**
- **false inclusion 수정**: `[슈링크홈디바이스] …세럼 30ml 기획`(세럼+디바이스)가 단품 157,700으로 통과 → `SET_KEYWORDS`에 `디바이스|기기` 추가(별도 커밋). 재수집 후 #86 무가격 확인.
- **false exclusion = DB 상품명 오타(매처 아님)**: #85 "하이**아르**론"(실제 "하이**알루**론"), #86 네이버 "**엔에이디**"(실제 "**NAD**"). 어댑터가 오타명으로 검색 → 정답 단품이 결과에 안 뜸(더블팩만 떠서 정상 제외). 정타 검색 시 60,900 매칭됨(dry-run 확인). → **시트(원천) 상품명 수정 필요.** 전체 sync는 시트를 재import하므로 시트 교정 전엔 해당 제품 무가격 유지.
- **쿠팡 multipack(#30 48,160=5팩)**: 쿠팡 어댑터는 시트 URL의 productId로 앵커링 → 그 URL이 5팩 상품을 가리킴. 네이버 매처 범위 밖(쿠팡/시트 데이터 이슈).

**결정(운영자)**: 전체 sync **보류**(시트 오타 교정 먼저), 웹 반영(deploy) **보류**. → 아래 TODO로 인계.

## 2-tier 매처 (tier-1 링크-id 앵커, 2026-06-16)
실험(`docs/worklog/naver-id-anchor-experiment.md`): `item.productId == 큐레이션 N` 0/40, 그러나 `item.link → /products/{N}` **60%**. → 링크 경유 앵커링 도입.
- **Tier-1 (`pickAnchoredOffer`)**: 큐레이션 URL의 채널상품번호 N(`resolveCuratedProductNo`, naver.me는 리다이렉트 1회·캐시·전역 캡)로 검색 결과의 `link`를 매칭 → **운영자 정확 SKU**. 단품이면 채택, 세트면 제외(`anchorWasSet`) + 시트정리 신호.
- **Tier-2 (폴백)**: 앵커 미스(~40%) 시 기존 공식몰+단품우선+변형/폼+벌크 제목매칭.
- `searchNaverShopping` display 40→100(앵커 hit·후보 폭 ↑). OY는 oy.run URL이라 N 없음 → tier-2.
- 맵 재실행(read-only) before/after: **OK 54 유지(회귀 없음)** — naver OK 이동은 전부 ANCHOR_SET(큐레이션 URL=세트, 의도)이고 display=100+앵커로 단품 신규매칭이 상쇄. 피지오겔 #77은 앵커로 정답 SKU 복구. **시트 URL=세트 13건** 정리 리스트 산출(catalog-match-map.md).
- 테스트: `productNoFrom`, `pickAnchoredOffer`(단품 채택/세트 제외/미스). test:all·typecheck·build green. DB 무변경.

## anchor-only 정책 + 멀티쿼리 recall (2026-06-16, 운영자 결정)
**결정**: 네이버 가격 소스는 **N-앵커로 확정된 큐레이션 단품만**. 앵커 미스 → **링크만(no_offer, fail_count 미증가)**. fuzzy 제목/변형 가격매칭은 **가격 소스에서 제거**(이름 비슷한 다른 제품가 노출 방지).
- `matchNaverOffer` = anchor-only: `buildAnchorQueries`(brand+name, brand+첫토큰, **brand+폼명사** 예 "유세린 세럼")로 멀티쿼리 recall → `pickAnchoredOffer`. 앵커 없으면 no_offer(링크만). `pickOfficialOffer`/`hasFormConflict`는 **OY-strict 대안용**으로 export 유지하되 가격 경로 미사용.
- **OY(oy.run, N 없음)**: anchorProductNo=null → 즉시 링크만(검색 안 함). 가격은 manual_override 있을 때만(권장안). ⚠️ **대안(엄격 OY 매칭)은 운영자 확인 대기**.
- 맵 재실행 결과: **네이버 가격 15건 전부 앵커 단품(fuzzy 0)**. 유세린 #85 recall로 60,900 회복. 커버리지 OK 54→37(naver 20→15, OY 12→0), fully link-only 16건(다수 시트정리로 회복 가능). 상세·OY 트레이드오프: `catalog-match-map.md`.
- 테스트: `buildAnchorQueries`(폼명사 recall), `pickAnchoredOffer`(단품/세트/미스). test:all·typecheck·build·lint green. DB 무변경.
- **후속(웹)**: 링크만 행 증가 → tier-4 link-only UI 필요(가격 없는 네이버/OY를 "보기" 링크로). 별도 웹 PR.

## 정책 확정: 세트 포함(개당가) + OY 4-tier (2026-06-16, 운영자 결정)
"세트 제외" 폐기 → **앵커된 SKU는 단품/동질묶음 모두 가격 수집, 개당가(effective)로**. 증정은 미반영(라벨만). 이종 2제품 세트만 검수.
- `packageExtractor`: 동질묶음 수량 파싱 강화 — 1+1/2+1(N+N), 본품+리필(→2), 더블기획/팩/구성(→2), ×N, N개입. **증정/여행용/미니/샘플 클로즈 미반영**("세럼30ml + 토너20ml 증정"→30ml 1개; "(+세럼20ml+크림1ml)"→본품만). **이종 플래그**: ≥2 distinct volume / N종 / 디바이스·기기 → `heterogeneous`(무가격 검수). "(더블/대용량)"은 모호 → 단품 보수처리.
- `pickAnchoredOffer`: 앵커=항상 가격(단품/묶음); `heterogeneous`만 `needsInspection`(무가격).
- **OY 4-tier**: `pickOliveYoungOffer` — mallName='올리브영'(정확) 느슨 매칭(엄격 변형토큰 미적용, 폼충돌·저유사도·이종만 배제), 묶음 개당가 포함, 모호→검수. `matchOliveYoungOffer`로 OY 어댑터 배선(matchNaverOffer 대체). Tier1 hidden(affiliate_url 無)·T2 가격·T3 manual_override·T4 링크만.
- 맵 재실행: **가격 OK 37→78**(세트포함+OY 회복). INSPECT 3(아벤느·바이오힐보 디바이스·블라이드 모호). ⚠️ 느슨 OY 잔여 오매칭 2건(#34 조선미녀 다른단품·#76 닥터지 토너+올인원) → manual_override 권고. 상세 catalog-match-map.md.
- 테스트: packageExtractor(1+1/리필/더블/증정/이종/N종/디바이스), pickAnchoredOffer(묶음 가격·이종 검수), normalize 회귀. test:all·typecheck·build·lint green. DB 무변경.

## OY 신뢰 밴드 (auto-price vs hold, 2026-06-16)
느슨 OY가 같은 브랜드 다른 제품/세트를 조용히 auto-price하던 것(#34 맑은쌀, #76 세트) 방지. `pickOliveYoungOffer`에 밴드:
- **auto-price(Tier2)**: 유사도 ≥ 0.6 **AND** `distinctiveTokens`(브랜드·카테고리·PROMO_WORDS 제외) 중 하나 이상 OY 제목에 존재.
- **hold+검수(needsInspection)**: 0.4–0.6 / 핵심토큰 부재 / top-2 근소경합(<0.1, 다른 가격) / 이종. <0.4 → Tier4 링크만. **드롭 없음**.
- 결과: #34 조선미녀 틀린 25,300 차단(검수), #86·#88 hold. 가격 OK 78→76(과도 hold 없음, 둘 다 타당). 잔여 #76(증정 기획 동일라인 세트)는 밴드 미차단 → manual_override 권고(2-form 룰은 동의어 과도hold라 미채택).
- 테스트: `distinctiveTokens`, OY 밴드(다른제품 hold·정상 auto-price·근소경합 hold). test:all·typecheck·build·lint green. DB 무변경.

## OY recall(+올리브영) + gift-strip 선채점 (2026-06-16)
두 진단으로 검증된 OY 정확도 fix:
- **1a**: `matchOliveYoungOffer` 쿼리에 `brand+name+올리브영` 추가(mallName 필터 유지). 올리브영 자기 단품 recall.
- **1b**: `pickOliveYoungOffer` 점수·`hasFormConflict`를 `stripPromoGifts(title)` 기준으로 → 증정("(+올인원크림)")이 다른 제품 위장 차단.
- **1c(카테고리 폼충돌) 미채택**: #76 OY 단품이 오일컷 변형(진정≠) → held가 안전 + 혼합토큰 모호/정상클렌저 과잉배제 위험. wrong 가격은 1a+1b로 0.
- 맵 재실행: **#34 조선미녀 정답 14,400 자동 매칭**(was wrong 25,300), **#76 닥터지 wrong 31,000 제거→held**, #78 온그리디언츠 recall 이득. OK 76→77, 정상 단품 손실 0.
- 테스트: gift-strip 선채점(토너+올인원크림 증정→form conflict→held). test:all·typecheck·build·lint green. DB 무변경.

## 전체 재수집 (프로덕션 Supabase 쓰기, 2026-06-16)
백업: `backups/2026-06-16T14-45-41-677Z`. 브랜치 `fix/naver-sku-matching`에서 실행(필수).
- **시트 재import**: 45 products / 138 listings, orphan 3 products·6 listings 비활성, dup-URL 0. ⚠️ 2 errors = **badge 시트가 유세린/바이오힐보 신규명(하이알루론·NAD) 미반영** → 배지 2건 skip(가격 무관, 운영자 배지행 수정 필요). ⚠️ 넘버즈인 쿠팡 URL 여전히 short-link(미수정) → data_error 유지. 제품명 정정으로 신규 행 #286(유세린 하이알루론)·#287(바이오힐보 NAD) 생성(구 #85/#86 비활성).
- **제한 sanity(6종) → 클린**: 유세린 60,900(naver)·OY 39,900 / 조선미녀 **14,400(정답, was wrong 25,300)** / 라하 13,800·16,800·OY 1+1 eff 12,000 / 토리든 19,930 / 닥터지 16,990(쿠팡 단품; OY 토너 held) / 바이오힐보 held. **틀린 가격 0.**
- **전체 sync**: crawl_run #4 completed(total 138 / ok 77 / warn 14 / fail 34 — fail 다수는 zigzag/ably 무어댑터). **priced 40/45 products, no-price 5 / priced listing 63.** `last_crawled_at` 138/138·`crawl_runs` 기록됨(ISO fix 동작).
- **wrong-price 스캔(>90k) 클린**: #95 아르마니 113,050만 = 앵커된 큐레이션 "리필위크 세트"(시트 URL이 세트 → 단품 원하면 URL 교체). 교차상품/fuzzy 오류 0.
- ⚠️ **웹 미반영**: run.ts revalidate가 stub + `REVALIDATE_SECRET` 미설정 → 풀sync의 revalidate는 no-op. viewtypick.com 갱신엔 `cf:deploy`(또는 ISR 윈도우) 필요 — **deploy는 운영자 결정 대기**(브랜치 vs main 배포 유의: 매처 변경은 crawler 전용이라 웹 렌더 무영향, main 배포만으로도 데이터 반영 가능).

## 남은 TODO
- [ ] **(운영자, 전체 sync 전 선행) 시트 상품명 오타 교정**: #85 "하이아르론"→"하이알루론", #86 "엔에이디"→"NAD"(또는 검색 매칭되는 표기). 다른 제품에도 유사 오타 가능 → 전체 sync 시 false-exclusion 분포로 추가 발견.
- [ ] **(게이트, 보류 중) 전체 재수집**: 시트 교정 후 `npm run crawler:sync`(전체). priced vs no_offer 분포 + false exclusion/inclusion 점검 보고.
- [ ] **(게이트, 보류 중) 웹 반영**: revalidate가 stub이고 `REVALIDATE_SECRET` 미설정 → 자동 갱신 안 됨. `cf:deploy` 재배포 또는 revalidate 배선 필요. 데이터 확정 후 진행.
- [ ] (운영자) 검증된 공식 mallName으로 `retailer_allowlist` 채우기(precision; ⚠️ 잘못된 값은 매칭을 깨뜨림).
- [ ] 쿠팡 multipack(#30 5팩 등): 쿠팡 단품 표시/개당가 또는 시트 URL 단품 교체 검토(네이버 매처 범위 외).
- [ ] 별도 PR: 웹 mock 제거(별점/previousPrice/20%·하락), 다중팩 개당가 표시, null가격 정렬 뒤로, current_prices 정리.
- [ ] (보류) push + 영어 PR(ground-truth 표 + 분포) → 운영자 리뷰/CI 후 merge. **merge는 이 작업에 미포함.**
</content>
