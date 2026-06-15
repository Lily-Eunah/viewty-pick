# Worklog: feature/pipeline-mvp

Branch: `feature/pipeline-mvp`  
Date: 2026-06-14  
Author: eun_ah.yang

---

## 구현 기능 요약

### 1. 배송비 스키마 마이그레이션
- `supabase/migrations/0004_add_shipping_fields.sql`
- `price_snapshots`에 `shipping_fee INT NULL`, `shipping_note TEXT NULL` 추가
- 배송비는 가격 계산에 포함하지 않고 라벨 전용(`shipping_note`)으로만 저장

### 2. PriceOffer 인터페이스 확장 (`crawler/adapters/index.ts`)
- `parsedVolumeRaw?: number | null` — 어댑터가 페이지/제목에서 추출한 ml (용량 불일치 검증용)
- `shippingNote?: string | null` — 배송 라벨 (무료배송/로켓배송/3,000원 등)

### 3. 가격 정규화 재작성 (`crawler/core/normalize.ts`)
- **2트랙 계산**: `base_unit_price`(단품 기본가) / `effective_unit_price`(1+1·2+1·수량할인 실질 개당가)
- **ml당 가격**: `unit_price = effective_unit_price / volume_ml`
- **조건부 혜택(coupon/membership/app_only/card_discount)**: 기본가·혜택가에 반영하지 않음
- **용량 불일치 감지**: `parsedVolumeRaw` 또는 제목에서 파싱한 ml이 `products.volume_ml`과 다르면
  - `volume_mismatch = true`
  - `parse_confidence = 'low'` → healthcheck에서 비교 제외
- `NormalizedPrice` 인터페이스에 `volume_mismatch`, `volume_mismatch_detail`, `shipping_note` 추가
- `applyManualOverrides`: active manual_overrides가 크롤링 결과 덮어쓰기

### 4. 헬스체크 재작성 (`crawler/core/healthcheck.ts`)
- `NormalizedPrice` 타입 직접 수용 (이전: partial inline type)
- Rule 5 추가: `volume_mismatch=true` → `status=failed`
- Rule 6 추가: `parse_confidence=low` → `status=warning` (비교 제외)
- `handleConsecutiveFailures`: 불필요한 `_previousSnapshot` 파라미터 제거

### 5. Naver 어댑터 재작성 (`crawler/adapters/naver.ts`)
- **기존 방식(Naver Shopping 검색 API)에서 Playwright 크롤 어댑터로 전환**
- 공식 브랜드스토어/스마트스토어 URL을 직접 크롤
- `robots.txt` 확인 후 크롤 진행 (거부 시 예외)
- 요청 간 랜덤 2~5초 지연
- `parseNaverPageContent()` 순수 함수 분리 → 단위 테스트 가능
- 프로모션 감지: 1+1 / 2+1 / N개 M% 할인 / 쿠폰(라벨) / 멤버십(라벨) / 앱전용(라벨)
- 배송 라벨 파싱: 무료배송 / 조건부 무료 / 금액
- 용량 추출: 제목에서 ml 파싱 → `parsedVolumeRaw`
- `retailer_allowlist` 스토어명 검증 (스토어명 불일치 → healthcheck에서 flagging)

### 6. Coupang 어댑터 재작성 (`crawler/adapters/coupang.ts`)
- **Coupang Partners API 단건 조회 구현**
- HMAC-SHA256 서명: `datetime(yyMMddHHmmss) + method + path + queryString`
- `MIN_CALL_INTERVAL_MS` (기본 360,000ms = 6분): 시간당 10회 제한 준수
- URL에서 productId 추출 (`extractCoupangProductId`)
- 쿠폰가(couponPrice)는 조건부 혜택 라벨로만 처리 — 기본가 미반영
- 로켓배송 → `shippingNote='로켓배송'`
- `parseCoupangItem()` 순수 함수 분리 → 단위 테스트 가능

---

## 주요 변경 파일

| 파일 | 변경 내용 |
|---|---|
| `supabase/migrations/0004_add_shipping_fields.sql` | NEW — 배송비 필드 추가 마이그레이션 |
| `lib/types.ts` | PriceSnapshot에 shipping_fee/note 추가 |
| `crawler/adapters/index.ts` | PriceOffer에 parsedVolumeRaw/shippingNote 추가 |
| `crawler/adapters/naver.ts` | API → Playwright 크롤 어댑터로 전체 재작성 |
| `crawler/adapters/coupang.ts` | HMAC 서명 + 단건 API 조회 구현 |
| `crawler/core/normalize.ts` | 용량 불일치 → parse_confidence=low, 조건부 혜택 분리 |
| `crawler/core/healthcheck.ts` | NormalizedPrice 타입 수용, volume_mismatch Rule 추가 |
| `crawler/core/packageExtractor.test.ts` | 픽스처 product volume 60ml로 보정 |
| `crawler/naver/test.ts` | PriceSnapshot shipping fields 추가 |
| `crawler/run.ts` | snapshot에 shipping 필드 추가, handleConsecutiveFailures 서명 수정 |
| `package.json` | test:normalize/healthcheck/naver/coupang/all 스크립트 추가 |
| `crawler/core/__tests__/normalize.test.ts` | NEW — 17개 케이스 |
| `crawler/core/__tests__/healthcheck.test.ts` | NEW — 11개 케이스 |
| `crawler/adapters/__tests__/naver.test.ts` | NEW — 20개 케이스 |
| `crawler/adapters/__tests__/coupang.test.ts` | NEW — 17개 케이스 |
| `docs/worklog/feature-pipeline-mvp.md` | NEW — 본 문서 |

---

## 테스트 결과

```
npm run test:normalize      → 17/17 PASSED
npm run test:healthcheck    → 11/11 PASSED
npm run test:naver          → 20/20 PASSED
npm run test:coupang        → 17/17 PASSED
npm run package:extract:test → 12/12 PASSED
npm run typecheck           → 0 errors
npm run lint                → 0 errors (1 pre-existing warning in ProductImage.tsx)
npm run build               → success
```

---

## 남은 이슈 / TODO

- **Naver 셀렉터 검증**: 실제 Naver Smart Store / Brand Store 페이지에서 셀렉터 동작 확인 필요. 현재 구현은 공통 패턴 기반이며 Naver가 React 앱 구조를 변경하면 업데이트 필요.
- **Coupang API 엔드포인트 검증**: Partners API 키 발급 후 실제 응답 스키마와 URL 확인 필요.
- **Discord notify 연동**: `healthcheck`가 반환하는 `volume_mismatch` / `parse_confidence=low` 플래그를 `crawler/core/notify.ts`에 연결하는 작업은 이번 범위 밖(Phase 1.7).
- **run.ts 오케스트레이션**: score, revalidate, notify 통합은 Phase 1.8 (이번 범위 밖).
- **oliveyoung 어댑터**: PriceSnapshot에 shipping_fee/note 필드 추가 필요 (oliveyoung.ts 내 snapshot 생성 코드 확인).
