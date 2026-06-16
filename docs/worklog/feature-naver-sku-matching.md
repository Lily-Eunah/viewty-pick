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

## 남은 TODO
- [ ] (운영자) 검증된 공식 mallName으로 `retailer_allowlist` 채우기.
- [ ] (게이트) `--only` 제한 재수집으로 운영 DB ground-truth 재검증 후 전체 재수집.
- [ ] 별도 PR: 웹 mock 제거(별점/previousPrice/20%·하락), 다중팩 개당가 표시, null가격 정렬 뒤로, current_prices 정리.
</content>
