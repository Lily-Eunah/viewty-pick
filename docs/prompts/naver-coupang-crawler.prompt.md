# Claude Code 작업 프롬프트 — 네이버·쿠팡 가격 수집 어댑터 구현

> 이 파일을 Claude Code 세션에 붙여넣어 작업을 지시한다.
> 대상 범위: DESIGN.md §4 / IMPLEMENTATION.md Phase 1 중 **네이버·쿠팡 어댑터 + 공통 normalize**.

---

## 0. 먼저 읽어라

작업 전 아래 문서를 읽고 맥락을 파악한다. 충돌 시 권위 순서는 IMPLEMENTATION.md §0을 따른다.

- `README.md` — 서비스 정의·판매처 정책
- `DESIGN.md` — §2 아키텍처, §4 가격 수집 파이프라인, §5 데이터 모델, §8 Viewty Score
- `docs/IMPLEMENTATION.md` — §4 스키마, §6 파이프라인, §7 Phase 1
- `CLAUDE.md` — **작업 규칙(브랜치·커밋·파일 무결성·worklog)은 반드시 준수**

핵심 한 줄: ViewtyPick은 *검증된 판매처 기준 최저가*를 보여주는 화장품 큐레이션 서비스다. **잘못된 최저가 1건이 서비스 신뢰를 깬다** — 불확실한 가격은 노출하지 않는다(DESIGN 원칙 #4).

---

## 1. 이번 작업에서 확정된 정책 (재논의 금지)

아래는 운영자가 확정한 결정이다. 그대로 구현한다.

### 1.1 네이버 = 크롤 어댑터 (검색 API 아님)
- 시트 `product_links.url`에 입력된 **공식 브랜드스토어 상품 URL**을 Playwright로 직접 크롤링한다.
- 검색 API(쇼핑 검색)는 **가격 소스로 쓰지 않는다.** 추후 신상품 발견·교차검증 보조 용도로만 고려(이번 범위 밖).
- URL을 운영자가 직접 골랐으므로 공식 스토어 보장은 입력 단계에서 끝난다. `retailer_allowlist`는 **스토어명 일치 가드**로만 사용(크롤한 store_name이 allowlist와 다르면 비교 제외 + 알림).
- smartstore/브랜드스토어는 JS 렌더이므로 Playwright 필수. **robots.txt를 코드에서 확인·존중**하고, 요청 간 2~5초 랜덤 지연, 가격 외 콘텐츠(이미지 원본·리뷰)는 복제하지 않는다.

### 1.2 쿠팡 = 파트너스 API 어댑터
- 쿠팡 파트너스 API 단건 조회. **검색 API 시간당 10회·상품 10개 제한** → 50~100제품을 청크로 나눠 하루에 분산 호출(요청 간 지연). 단건 분산 스케줄을 1순위로 구현한다.
- 응답에 프로모션·용량 정보가 거의 없다 → 기본가 = 판매가, 용량은 `products.volume_ml` 사용, 로켓배송 여부는 라벨로.

### 1.3 용량 모델 = 용량별 별도 제품
- 50ml / 150ml 등은 **각각 다른 product row(다른 slug)**. `products.volume_ml`은 단품 단일값 그대로 둔다.
- 단, "50ml+50ml 더블기획"처럼 *같은 단품의 묶음*은 같은 제품이며 `total_ml`을 배수로 계산한다.
- 크롤한 제목에서 파싱한 용량이 `products.volume_ml`과 다르면(= 진짜 다른 사이즈로 바꿔치기 의심) **비교 제외 + Discord 알림**.

### 1.4 배송비 = 라벨로만 표시
- 배송비는 조건부 비용이므로 **기본가·혜택가·ml당 가격·JSON-LD 어디에도 포함하지 않는다.**
- listing 라벨로만 저장·표시: `무료배송` / `3,000원` / `로켓배송` / `조건부 무료` 등. 파싱 불안정 시 라벨 비움.

### 1.5 가격 표시·정규화 정책 (DESIGN §4.3 그대로)
- **2트랙**: `base_unit_price`(조건 없는 1개가) / `effective_unit_price`(1+1·2+1·수량할인 실질 개당가). 비교용 `unit_price`(= price / total_ml) 정규화.
- 자동 계산 **포함**: 즉시 세일가, 1+1, 2+1, N개 M% 할인, N개 총액 할인, 명확한 번들가.
- 자동 계산 **제외 → 조건부 혜택 라벨로만**: 로그인/앱/첫구매/장바구니 쿠폰, 멤버십가, 카드 청구할인, 포인트, 정기배송.
- 파싱 실패·모호 → `promo_type=unknown`, `parse_confidence=low` → **비교 제외 + 검수 알림**.
- 증정품은 가격 미반영, `promo_text`로만.

---

## 2. 구현 순서 (이 순서대로)

normalize가 두 어댑터의 출력 계약이므로 **먼저 고정**한다.

1. **스키마 마이그레이션** — `supabase/migrations/`에 배송비 필드 추가.
   - `price_snapshots`에 `shipping_fee int null`, `shipping_note text null` 추가(또는 listings에 정적 배송정책이면 listings, 시점별 변동이면 price_snapshots — 변동 가능성 고려해 price_snapshots 권장).
2. **`crawler/core/normalize.ts`** — 프로모션 정규식 추출 → `quantity`/`total_ml`/기본가/혜택가/ml당 계산. `manual_overrides` active 적용. 파싱 실패 시 `parse_confidence=low`. 용량 대조 로직 포함.
   - 입력 계약(어댑터 출력) 타입을 `crawler/` 또는 `lib/types.ts`에 명시: `PriceOffer { regularPrice, salePrice, promoTextRaw, parsedVolumeRaw?, shippingNote?, storeName?, inStock }`.
3. **`crawler/adapters/naver.ts`** — Playwright로 공식 URL 크롤 → 판매가·프로모션 영역·제목 용량·배송 라벨·스토어명 추출 → `PriceOffer` 반환. 셀렉터는 어댑터 코드에 보관(DESIGN §6 판단).
4. **`crawler/adapters/coupang.ts`** — 파트너스 API 단건 조회, 시간당 10회 분산 스케줄, 딥링크/가격 파싱 → `PriceOffer`.
5. **`crawler/core/healthcheck.ts` 연동 지점** — 이번 범위에선 normalize가 내는 플래그(용량 불일치, parse_confidence=low, allowlist 불일치, 이상치 ±50%·1,000원 미만·1+1가>기본가, 프로모션 전이)를 healthcheck가 받을 수 있게 인터페이스만 맞춘다.

> Discord notify·score·revalidate·run.ts 오케스트레이션은 이번 범위 밖. 단 normalize/adapter가 그쪽이 소비할 데이터·플래그를 올바르게 채워야 한다.

---

## 3. 테스트 (필수)

- **어댑터 단위 테스트**: 고정 fixture로 회귀 방지.
  - naver: 저장한 HTML 샘플(단품 / 1+1 / 2+1 / N개입 / 더블기획 / 용량불일치 케이스).
  - coupang: 고정 API 응답 JSON.
- **normalize 단위 테스트**: 1+1·2+1·수량할인·번들 계산식 검증(DESIGN §4.3 예시 값 그대로), parse_confidence=low 게이트, 용량 대조 플래그, 조건부 혜택(쿠폰/멤버십)이 기본가·혜택가에 안 섞이는지.
- **이상치 게이트**: 의도적 불량 데이터(1,000원 미만, 1+1가>기본가, ±50% 변동)가 비교 제외되는지.
- 각 커밋 전 `npm run lint && npm run typecheck && npm run build` 통과 확인. 검증 실패 상태로 커밋 금지.

---

## 4. 작업 규칙 (CLAUDE.md 준수 — 어김 금지)

- **브랜치**: `feature/pipeline-mvp`에서 작업. `main` 직접 커밋·force push 금지.
- **커밋**: 의미 단위로 분리. Conventional Commits(`feat:`, `fix:`, `refactor:`, `test:`, `chore:`). 예: `feat: add price normalization (base/effective/per-ml)`, `feat: naver official-store crawler adapter`, `feat: coupang partners api adapter`.
- **파일 무결성(중요)**: mount 이슈로 파일이 잘려 push된 전례가 있다. 커밋 전 `git diff --stat`·`git diff --check`로 잘림/0바이트 확인, 커밋 후 `git show --stat HEAD` 재확인. 잘림 발견 시 수정 후 amend.
- **worklog**: 머지 전 `docs/worklog/feature-pipeline-mvp.md` 작성 — 구현 기능 요약, 주요 변경 파일, 테스트 결과, 남은 TODO.
- **PR**: title·description은 영어. 변경 요약·이유·테스트 방법/결과 포함.
- **금지**: `git reset --hard`, `git clean -fd`, 원격 push(사용자 요청 전까지).

---

## 5. Definition of Done

1. `feature/pipeline-mvp`에 배송비 마이그레이션·normalize·naver.ts·coupang.ts가 추가되고 빌드·타입체크·린트 통과.
2. fixture 기반 단위 테스트가 1+1/2+1/수량할인/번들/용량불일치/이상치 케이스를 커버하고 모두 통과.
3. 기본가/혜택가/ml당 가격이 DESIGN §4.3 계산식대로 산출되고, 조건부 혜택·parse_confidence=low·용량불일치·이상치가 비교에서 제외된다.
4. 배송비가 라벨로만 저장되고 최저가 계산에 미반영됨을 테스트로 확인.
5. `docs/worklog/feature-pipeline-mvp.md` 작성 완료.

---

## 6. 막히면 물어볼 것 (그 외엔 위 정책대로 진행)

- 쿠팡 파트너스 API 키/엔드포인트 스펙이 불명확할 때.
- 네이버 공식 스토어 페이지 구조가 fixture로 확보 안 될 때(샘플 HTML 요청).
- 스키마 변경이 §1.4 외 추가로 필요해질 때.
