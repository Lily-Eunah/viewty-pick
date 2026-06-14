# Live Parse Validation — Naver / Coupang (feature/pipeline-mvp)

Date: 2026-06-14  
Scope: 실제 DB 링크에 직접 접속해 가져온 응답으로 "정답" 추론 후
`parseNaverPageContent` / `parseCoupangItem` / `normalizePrice` 출력과 대조.  
Mode: `CRAWLER_MODE=live`, `VIEWTYPICK_MOCK_MODE=false`. Supabase 읽기 전용.

> 이 검증은 네트워크·실키 의존이라 CI 단위 테스트와 분리(`scripts/live-check/`).
> 정상 응답은 토큰 제거 후 fixture로 저장(gitignore).

---

## 0. 요약 (한 줄)

- **쿠팡 어댑터는 현재 코드로 실데이터에서 동작 불가** — 3개의 독립 버그 확인(HMAC 포맷, 존재하지 않는 엔드포인트, 가격 필드명 불일치). 모두 재현·원인 규명·수정안 확보.
- **네이버 실페이지 크롤은 robots.txt로 전면 차단** — `brand.naver.com`이 `User-agent: * Disallow: /`. 정책(로봇 존중)상 크롤 불가 → **검증 불가(설계 충돌)**, 추측 금지.
- **normalize 게이트는 실데이터에서 정확히 동작** — 5개 번들 실질개당가, 60ml vs 50ml 용량 불일치 → `parse_confidence=low` 비교 제외, 배송 라벨 분리 모두 확인.

---

## 1. 대상 링크 (DB, 읽기 전용)

활성 listings 54건 중 네이버(seller_id=4) 14건, 쿠팡(seller_id=3) 17건. URL 중복 제거 후 샘플.

> **부수 발견 (seller_id 매핑)**: 실제 DB는 `coupang=3, naver=4`.
> 그러나 `healthcheck.ts` Rule(네이버 allowlist)과 구 코드가 **naver를 `seller_id===3`으로 하드코딩** → 현재 네이버엔 allowlist 가드가 안 걸리고 쿠팡에 잘못 걸림. **버그.**

---

## 2. 쿠팡 — 실 API 조회 결과

### 2.1 링크 구조
DB의 쿠팡 `url`은 전부 `link.coupang.com/a/xxxx` **파트너스 딥링크**. `/vp/products/` 패턴 없음.
→ `extractCoupangProductId()`가 **전부 null** → 어댑터 즉시 throw.
딥링크는 302로 `www.coupang.com/vp/products/<id>`로 리다이렉트되므로 **리다이렉트 해석으로 productId 확보 가능**.

### 2.2 비교표 (실 응답 vs 현재 파서)

| link_key | 추론 정답(실 API) | `parseCoupangItem` 출력 | 일치 | 비고 |
|---|---|---|---|---|
| LINK_COUPANG_1 | productPrice=25,000 / isRocket=true / 50ml | salePrice=**null**, inStock=**false**, 로켓배송 ✓, vol=50 ✓ | ❌ | 가격·재고 실패. + search가 **엉뚱한 제품**(노엘로힐스) 반환(exact match 실패) |
| LINK_COUPANG_2 | productPrice=48,160 / **50ml 5개 번들** / isRocket=true | salePrice=**null**, inStock=**false**, 로켓배송 ✓, vol=50 ✓ | ❌ | 가격 실패. 실제는 5개 번들 |
| LINK_COUPANG_3 | productPrice=16,760 / isRocket=true | salePrice=**null**, inStock=**false**, 로켓배송 ✓, vol=null | ❌ | 가격 실패 |

### 2.3 확인된 버그 (원인 + 수정안)

1. **HMAC datetime 포맷 오류** → 모든 실호출 `401 "HMAC format is invalid"`.
   - 원인: `coupang.ts`가 `toISOString().replace(/[-T:.Z]/g,'').slice(2,14)`로 `yyMMddHHmmss` 생성 (리터럴 `T`/`Z` 제거).
   - 쿠팡 규격: `yyMMdd'T'HHmmss'Z'` (GMT). 예 `260614T143043Z`.
   - **수정안**: datetime를 `260614T143043Z` 형태로 생성(아래 코드). 수정 후 deeplink 엔드포인트 `200 OK` 확인.

2. **존재하지 않는 엔드포인트** → `GET /openapi/v1/products/{productId}` = `404 PRECONDITION_FAILED` ("No exactly matching API specification").
   - 쿠팡 파트너스 API에 **productId로 가격을 주는 단건 조회 엔드포인트가 없음**.
   - 가격을 주는 유일 경로 = `GET /openapi/v1/products/search?keyword=...` (시간당 10회).
   - **수정안**: 어댑터를 검색 기반으로 변경 — 딥링크 리다이렉트로 얻은 productId로 검색 결과를 **exact productId 필터**, 없으면 비교 제외(추측 금지). 또는 운영자가 시트에 productId/가격을 직접 입력(manual_overrides).

3. **가격 필드명 불일치** → 실 응답은 `productPrice`인데 파서는 `item.price`를 읽음 → `salePrice=null`, 그 여파로 `inStock=false`.
   - 실 검색 응답 필드: `productId, productName, productPrice, productImage, productUrl, categoryName, rank, isRocket, isFreeShipping`.
   - 없는 필드: `price, basePrice, soldOut, couponPrice, vendorItemId, lowestPrice`.
   - **수정안**: `CoupangApiItem`/`parseCoupangItem`을 실제 스키마로 재매핑. `salePrice=productPrice`, `regularPrice=null`, 재고는 별도 신호 없음→`true` 가정, `isFreeShipping`도 배송 라벨에 반영.

4. **매칭 신뢰도** → LINK_COUPANG_1은 검색 결과에 목표 productId가 없어 rank-1(다른 브랜드)로 대체됨. 이름 불일치는 normalize의 용량 게이트로는 못 걸러짐(용량이 같으면 통과).
   - **수정안**: exact productId 매칭 실패 시 **비교 제외 + 알림**. healthcheck에 상품명 유사도 체크 추가(현재 미구현).

### 2.4 수정안 코드 스니펫
```ts
// datetime (FIX)
function coupangDatetime(): string {
  const iso = new Date().toISOString();           // 2026-06-14T14:30:43.123Z
  return iso.slice(2,4)+iso.slice(5,7)+iso.slice(8,10)
       + 'T'+iso.slice(11,13)+iso.slice(14,16)+iso.slice(17,19)+'Z'; // 260614T143043Z
}
// field mapping (FIX): productPrice → salePrice; search endpoint instead of products/{id}
```

---

## 3. 네이버 — 실페이지 크롤 결과

### 3.1 robots.txt 검증 (실측)
| host | robots 결과 | 조치 |
|---|---|---|
| `brand.naver.com` (공식 브랜드스토어, 4/5건) | **BLOCKED** — `User-agent: * Disallow: /` (ClaudeBot도 명시 Disallow) | **크롤 안 함** |
| `naver.me` (단축링크) | robots 404 → 형식상 allow | 실 콘텐츠는 `brandconnect.naver.com`(제휴 링크)로 리다이렉트 → 어댑터 URL 검증이 거부 |

### 3.2 결론: 검증 불가 (설계 충돌)
- `parseNaverPageContent`는 **저장된 HTML이 있어야** 검증 가능하나, robots가 전면 금지 → 정책(로봇 존중)상 HTML을 가져올 수 없음.
- 어댑터의 `checkRobotsTxt()`는 **올바르게 차단**함(즉 라이브 실행 시 모든 brand.naver.com URL에서 "robots disallows" throw).
- 따라서 **"공식 브랜드스토어 Playwright 크롤" 전략 자체가 brand.naver.com robots와 충돌**. 운영자 결정 필요(§5).
- 파서 로직 자체는 fixture 단위 테스트 20건으로 커버됨(별도, 통과). 라이브 정답 대조는 **불가**로 보고(추측하지 않음).

---

## 4. normalize 정합성 (실 쿠팡 데이터 통과)

`productPrice→salePrice` 매핑을 적용한(=쿠팡 수정 가정) 실데이터로 검증:

| 케이스(실 제목) | base | effective | total_ml | per-ml | promo | confidence | 게이트 |
|---|---|---|---|---|---|---|---|
| 후시다인 …50ml, **5개** (48,160) | 48,160 | **9,632** | 250 | 192.64 | bundle | high | 정상 비교 |
| 스타라이크 …(16,760) | 16,760 | 16,760 | 50 | 335.2 | none | high | 정상 비교 |
| **[1+1] 몽디에스 …60ml** (33,000), DB 50ml | 33,000 | 33,000 | 50 | 660 | none | **low** | **비교 제외(용량 불일치)** ✅ |

- **번들 실질개당가**(5개→총액/5) 실데이터에서 정확.
- **용량 불일치 게이트** 동작: 60ml 제목 vs 50ml DB → `parse_confidence=low` → 제외.
- **배송 라벨 분리**: 전 건 `shipping_note=로켓배송`만, base/effective/per-ml 어디에도 미반영.
- **갭**: 쿠팡 `parseCoupangItem`은 제목의 `[1+1]`을 프로모션으로 감지하지 않음(쿠폰가 필드만 처리). 위 케이스는 용량 게이트가 우연히 방어했으나, **50ml [1+1]이면 1+1이 누락**되어 effective=base가 됨 → 쿠팡 제목 프로모션 정규식 추가 권장.

---

## 5. 운영자 결정 필요 / 후속 TODO

1. **네이버 수집 전략 재결정 (중요)**: `brand.naver.com` robots 전면 금지와 "공식스토어 Playwright 크롤" 정책이 충돌.
   - 선택지: ① 네이버 쇼핑 검색 API(`lprice`) 복귀(이전 구현 존재), ② 네이버 커머스/제휴(브랜드커넥트) API, ③ 수동 입력(manual_overrides). robots 우회는 정책상 불가.
2. **쿠팡 어댑터 재작성**: HMAC 포맷 수정 + `products/search` 기반 + `productPrice` 매핑 + productId exact 매칭 + 매칭 실패 비교 제외. (별도 PR 권장)
3. **seller_id 하드코딩 수정**: `healthcheck.ts`의 네이버 `seller_id===3` → DB 실제값(naver=4). 상수/조회로 대체.
4. **상품명 유사도 체크**: healthcheck에 미구현 — 쿠팡 search 오매칭 방지 위해 필요.
5. **쿠팡 제목 프로모션 파싱**: `[1+1]`, `N개`, 기획 등 productName 정규식 추가.

---

## 6. 검증 불가 항목 / 시크릿 처리

- **네이버 라이브 파서 대조**: robots 차단으로 불가(상기). 추측 정답 생성 안 함.
- 시크릿: `.env`만 사용, 로그/커밋/아티팩트에 키 노출 없음. 아티팩트는 `productUrl`(제휴 토큰)·이미지 blob 제거 후 저장, `artifacts/`·`expectations/`는 gitignore.
- 쿠팡 API 호출: 검증 총 3건 검색(시간당 10회 한도 내), 운영 스로틀(360s)은 유지.
