# Claude Code 작업 프롬프트 — 네이버·쿠팡 실링크 파싱 라이브 검증

> 이 파일을 Claude Code 세션에 붙여넣어 작업을 지시한다.
> 목적: DB에 등록된 **실제 네이버·쿠팡 링크에 직접 접속**해 페이지/응답을 가져오고,
> 그 결과로부터 "정답(ground truth)"을 추론한 뒤, 기존 파서(`parseNaverPageContent`,
> `parseCoupangItem`)가 같은 값을 내는지 비교·검증하고 결과를 정리한다.

---

## 0. 먼저 읽어라

- `crawler/adapters/naver.ts` — `parseNaverPageContent()` 순수 함수, 크롤 흐름, robots/지연 로직
- `crawler/adapters/coupang.ts` — `parseCoupangItem()`, HMAC 서명, `MIN_CALL_INTERVAL_MS`(360s)
- `crawler/core/normalize.ts` — 기본가/혜택가/ml당, parse_confidence, volume_mismatch
- 기존 단위 테스트(naver 20 / coupang 17 / normalize 17) — fixture 구조 파악
- `DESIGN.md` §4.1 수집 정책·§4.3 가격 모델, `CLAUDE.md` 작업 규칙

핵심: 이건 **네트워크·실키 의존 라이브 검증**이다. 기존 fixture 단위 테스트(CI용)와 **분리**한다. 검증 못 하면 추측하지 말고 "검증 불가 + 사유"로 보고한다.

---

## 1. 사전 조건 (없으면 멈추고 보고)

- **Supabase 읽기 접근**: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (listings/products 읽기).
- **쿠팡**: `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`.
- **네이버**: 키 불필요(공식 URL 직접 크롤). `CRAWLER_USER_AGENT`, Playwright chromium 설치(`npx playwright install --with-deps chromium`).
- 위 중 빠진 게 있으면 **그 판매처 검증은 skip**하고 사유를 결과에 명시. 시크릿은 절대 코드/로그/커밋에 노출 금지.

---

## 2. 작업 절차

### 2.1 대상 링크 추출 (DB, 읽기 전용)
- `listings`에서 `is_active=true`이고 `seller`가 네이버/쿠팡인 행을 조회, `products`와 조인해 `product_key`, `volume_ml`, `url`, `store_name`, `crawl_method`를 가져온다.
- **샘플 수 제한**: 네이버 최대 5건, 쿠팡 **최대 3건**(시간당 10회 제한 — 요청 간 360s 지연 그대로 준수). 다양성 위해 단품/프로모션 의심 건을 섞어 선택.
- DB에는 쓰지 않는다(읽기 전용).

### 2.2 네이버 — 실페이지 크롤 & 추론
각 URL에 대해:
1. **robots.txt 확인 후** 허용된 경우만 진행. 요청 간 2~5초 랜덤 지연.
2. Playwright로 렌더 → ① 렌더된 HTML, ② 전체 페이지 스크린샷을 `scripts/live-check/artifacts/naver/<link_key>/`에 저장(원본 이미지·리뷰 본문 복제 금지, 가격/프로모션/제목 영역 위주).
3. **Claude가 페이지를 직접 보고 정답을 추론**한다: 판매가, 정가, 프로모션(1+1/2+1/N개입/기획 여부), 제목상 용량, 배송 라벨, 스토어명, 품절 여부 → `scripts/live-check/expectations/naver.json`에 기록.
4. 저장한 HTML을 `parseNaverPageContent()`에 입력 → 산출값과 추론한 정답을 비교.

### 2.3 쿠팡 — 실 API 조회 & 추론
각 상품에 대해:
1. HMAC 서명으로 Partners API 단건 조회(**360s 간격 엄수**, 3건이면 총 ~12분). 원시 JSON 응답을 `scripts/live-check/artifacts/coupang/<link_key>.json`에 저장.
2. **Claude가 응답 JSON을 보고 정답 추론**: 가격, 로켓 여부, 상품명, 재고 → `scripts/live-check/expectations/coupang.json`.
3. 저장한 JSON을 `parseCoupangItem()`에 입력 → 비교.

### 2.4 normalize 통과 검증
- 2.2/2.3의 파서 출력을 `normalize.ts`에 넣어 `base_unit_price`/`effective_unit_price`/`unit_price`(ml당)/`parse_confidence`/`volume_mismatch`/배송 라벨이 기대대로 나오는지 확인.
- 특히: 조건부 혜택(쿠폰/멤버십/앱)이 기본가·혜택가에 **안 섞였는지**, 용량 불일치 시 `parse_confidence=low`로 게이트되는지.

### 2.5 라이브 검증 스크립트
- 위 흐름을 `scripts/live-check/`에 실행 가능한 스크립트로 작성(`tsx`로 실행, 예 `npm run live-check:naver` / `live-check:coupang`).
- **CI 단위 테스트에 넣지 말 것**(네트워크·실키 의존). 별도 스크립트로 수동 실행.
- 부수 효과: 정상 응답은 fixture로 떠 두면 기존 단위 테스트 보강에 쓸 수 있으나, **개인정보·저작물은 제외**하고 가격/프로모션/용량 관련 최소 영역만.

---

## 3. 결과 정리 (이 형식으로 보고)

링크별로 표를 만든다:

| 판매처 | product_key | 항목 | 추론한 정답 | 파서 출력 | 일치 | 비고 |
|---|---|---|---|---|---|---|
| naver | ... | 판매가 | 18,900 | 18,900 | ✅ | |
| naver | ... | 프로모션 | 1+1 | none | ❌ | 셀렉터 누락 의심 |
| naver | ... | 용량 | 50ml | 50ml | ✅ | |

그리고 요약으로:
- 판매처별 통과/실패 건수, 가장 흔한 실패 유형(셀렉터 누락, 프로모션 패턴 미매칭, 용량 파싱 실패 등).
- **셀렉터/정규식 수정 제안** — 어떤 케이스에서 어떤 패턴을 추가해야 하는지 구체적으로.
- 검증 불가(네트워크 차단·키 없음·robots 불허) 항목과 사유.
- normalize 단계에서 정책 위반(조건부 혜택 혼입, 게이트 미작동) 발견 시 강조.

---

## 4. 작업 규칙 (CLAUDE.md 준수)

- 브랜치: `feature/pipeline-mvp`에 이어가거나 `test/live-parse-check` 신규 분기. `main` 직접 커밋·force push·원격 push 금지.
- 커밋: `test: add live parse validation for naver/coupang` 등 의미 단위. fixture 추가는 별도 커밋.
- 파일 무결성: 커밋 전 `git diff --stat`·`git diff --check`로 잘림/0바이트 확인, 커밋 후 `git show --stat HEAD` 재확인.
- 시크릿·스크린샷에 개인정보/계정정보 포함 금지. `.env`·아티팩트는 `.gitignore` 확인.
- 라이브 결과(스크린샷·HTML 덤프 등 대용량/저작물)는 기본적으로 커밋하지 않는다 — 필요한 최소 fixture만 검토 후 커밋.

---

## 5. Definition of Done

1. `scripts/live-check/`에 네이버·쿠팡 라이브 검증 스크립트가 있고 실제 실행됨.
2. 네이버 ≤5건·쿠팡 ≤3건의 실링크에 대해 추론 정답 vs 파서 출력 비교표가 채워짐.
3. 실패 케이스마다 원인 추정 + 셀렉터/정규식 수정 제안이 정리됨.
4. normalize 정책 정합성(조건부 혜택 분리·용량 게이트) 확인 결과 포함.
5. 검증 불가 항목과 사유 명시. 시크릿·개인정보 노출 없음.

---

## 6. 막히면

- DB에 네이버/쿠팡 링크가 없으면: 몇 건이라도 시트→import로 넣을지, 아니면 사용자가 URL을 직접 제공할지 물어본다.
- 네트워크/Playwright가 환경에서 막히면: 추측 말고 "환경 제약으로 검증 불가"로 보고하고 대안(사용자가 HTML/JSON 덤프 제공) 제안.
- 쿠팡 360s 간격 때문에 시간이 오래 걸리면: 건수를 줄이고 그 사실을 명시.
