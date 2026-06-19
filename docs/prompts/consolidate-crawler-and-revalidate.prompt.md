# Claude Code 작업 프롬프트 — 크롤러 브랜치 통합 + 크롤 경로로 라이브 재검증

> 목적: 네이버 Playwright 크롤러를 **정식 작업선으로 통합**하고, 검색 API가 아닌
> **실제 브랜드스토어 URL 크롤 경로**로 라이브 검증을 다시 수행한다.
> 재구현이 아니라 **이미 만들어진 코드를 올바른 베이스로 모으는 통합 작업**이다.

---

## 0. 배경 진단 (이미 확인된 사실 — 재조사 불필요)

- 세 브랜치 모두 `main`(17414bf)에서 분기.
- `main`의 `crawler/adapters/naver.ts` = **네이버 쇼핑 검색 API**(`openapi.naver.com/v1/search/shop.json`) 기반. 제목 검색이라 브랜드스토어 URL의 productId와 검색 API productId가 **네임스페이스가 달라** 매칭이 깨진다.
- **`feature/package-title-extractor`(현재 작업 브랜치)** 는 `naver.ts`를 건드리지 않아 **main의 검색 API 어댑터를 그대로 상속** → 최근 라이브 평가가 검색 API로 돈 원인.
- **`feature/pipeline-mvp`** 에 우리가 원한 구현이 전부 있음:
  - `naver.ts` = Playwright 브랜드스토어 크롤러(`chromium`, `page.goto(url)`, robots.txt 확인, 셀렉터, 순수 파서 `parseNaverPageContent`)
  - `coupang.ts` = HMAC Partners API + 레이트리밋(360s)
  - `core/normalize.ts`(2트랙 + 용량 게이트), `core/healthcheck.ts`, fixture 단위 테스트
  - `scripts/live-check/`(크롤 기반 라이브 검증, robots 준수·정답 날조 금지)
  - `supabase/migrations/0004_add_shipping_fields.sql`
  - `core/packageExtractor.ts` (← package-title-extractor와 **바이트 동일**, 충돌 없음)

**결론: 작업 베이스를 `feature/pipeline-mvp`로 잡는다. 검색 API 어댑터로 되돌아가지 않는다.**

---

## 1. 용량 불일치 정책 — 절충안 확정 (운영자 확정)

두 브랜치의 `normalize.ts`가 용량 불일치를 정반대로 처리한다. **운영자 확정안 = 절충안**으로 단일화한다.

**원칙**: 가격은 실재하므로 숨기지 않는다. 단 용량이 불확실하면 **용량에 의존하는 계산(ml당)만** 비활성화한다.

용량 불일치(제목 파싱 용량 ≠ `products.volume_ml`) **또는** 용량 미검증 상태일 때:

- `base_unit_price` / `effective_unit_price` (실제 가격) → **그대로 노출·비교**. 같은 제품 내 "기본가 최저" 비교는 용량과 무관하므로 영향 없음.
- `unit_price`(ml당) → **신뢰 불가 처리**: `unit_price=null` + `unit_price_reliable=false`(없으면 필드 추가). 다음에서 **제외**:
  - 카테고리 ml당 정렬/랭킹
  - Viewty Score 가격경쟁력의 "ml당 상위 30%" 항목 (다른 가격경쟁력 항목은 유지)
  - (JSON-LD `AggregateOffer`는 원래 base만 쓰므로 영향 없음 — DESIGN §11)
- `volume_mismatch=true` + `volume_mismatch_detail` 기록, **검수 큐/일일 요약**에 포함.
- `parse_confidence`는 **가격 자체가 정상이면 `high` 유지**(가격을 게이트하지 않는다). ml 정규화 신뢰도는 `unit_price_reliable`로 별도 표현.

> 채택: pipeline-mvp의 `volume_mismatch` 플래그 구조 + 위 절충 게이트.
> 폐기: package-title-extractor의 "제목 용량 채택 + 아무 게이트 없음".
> 폐기: 용량 불일치 시 가격까지 `parse_confidence=low`로 비교 제외하던 강한 게이트(절충안에선 가격은 유지).

---

## 1b. 용량 데이터 정정 — 선결 과제 (중요)

라이브 Supabase의 `products.volume_ml`이 신뢰 불가 상태다. LLM 시드 과정에서 **선크림 등 다수가 50ml 기본값으로 박힌** 정황(예: 몽디에스는 실제 60ml인데 DB 50ml). 따라서 §1 절충안만으로는 부족하고, **용량을 실제로 정정하는 패스가 필요**하다. 정정 전에는 ml당 비교가 대부분 비활성인 게 정상이며, base 가격 비교는 그대로 동작한다.

크롤이 이 작업의 재료를 준다 — `packageExtractor`가 브랜드스토어 제목에서 단품 용량을 추출한다. 이를 활용한 **용량 감사 → 정정 제안 → 운영자 승인 → 시트 반영** 워크플로우:

1. 라이브 검증(아래 §2.4) 중 각 네이버 listing 제목에서 추출한 단품 용량을 수집.
2. **용량 감사 리포트** 표 생성: `product | brand | DB volume_ml | 제목/크롤 추출 용량 | 출처(listing 제목) | 제안 정정값 | 신뢰도`.
   - 제목에 용량이 명확하면 정정 제안, 없으면 "수동 확인 필요"로 표시(추측 금지).
3. **DB·시트를 직접 수정하지 않는다.** 리포트를 운영자에게 제출 → 승인 후 시트 `products.volume_ml` 수정 → `sheets:import` 재실행.
4. 검증된 용량은 재플래그되지 않도록 표식을 둔다 — 시트에 `volume_verified`(bool) 컬럼 추가를 제안(없으면 `manual_overrides` 또는 메모로 대체). 미검증 용량은 §1에 따라 ml당 비교에서 자동 제외.

> 즉 §1의 `volume_mismatch` 플래그는 "노이즈"가 아니라 **용량 정정 큐의 입력**으로 쓴다.

---

## 2. 작업 절차

1. **베이스 정리**
   - `feature/pipeline-mvp`를 최신 `main`에 rebase하거나 main을 merge해 최신화(충돌 시 보고).
   - `package-title-extractor`의 고유 산출물 확인: `packageExtractor.ts`는 동일하므로 가져올 게 없고, 유일한 차이는 `normalize.ts`다. **§1 결정대로 pipeline-mvp의 normalize를 정본으로 유지**하고, package-title-extractor의 normalize 변경은 폐기(필요한 개선만 선별 반영).
   - 이후 통합 작업은 `feature/pipeline-mvp`에서 진행하거나, 명확히 하려면 `feature/crawler-consolidation` 신규 분기.

2. **현재 구현 경로 확인(증빙)**
   - `crawler/adapters/naver.ts`가 Playwright 크롤(`page.goto(listing.url)`)이고 검색 API 호출이 없음을 grep으로 증빙(`shop.json` 없음, `chromium` 있음).
   - `crawler/adapters/coupang.ts`가 HMAC 서명 + 360s 간격임을 확인.

3. **시드 데이터 정리(읽기→정리 제안서, 쓰기는 승인 후)**
   - `listings`의 네이버 14행은 **고유 URL 6개**(mongdies / dongwhafusidyne / innisfree / beautyofjoseon / numbuzin / naver.me)에 2~3중복. product_id 1~7과 29~35가 같은 URL을 가리키는 2차 시드 중복.
   - `dongwhafusidyne/products/9999261730` 은 placeholder → 실제 URL로 교체 대상.
   - **DB를 직접 수정하지 말고**, "중복/placeholder 정리안"(어떤 row를 비활성/삭제·교체할지) 표를 먼저 만들어 운영자 승인을 받는다.

4. **크롤 경로로 라이브 재검증** (`scripts/live-check/live-check-naver.ts` 사용)
   - 검색 API 매칭이 아니라 **`listings.url`(브랜드스토어 URL)을 직접 크롤**한다.
   - robots.txt 확인 → 허용 시에만, 요청 간 2~5초 지연, 네이버 ≤5건.
   - 각 URL: 렌더 HTML/스크린샷 저장(가격·프로모션·제목 영역만) → Claude가 정답 추론 → `parseNaverPageContent()` 출력과 비교 → `normalize.ts` 통과 후 base/effective/ml당/parse_confidence/volume_mismatch/배송 라벨 확인.
   - 쿠팡은 `live-check-coupang.ts`로 ≤3건(360s 간격 엄수).

5. **결과 정리** (지난 형식 유지)
   - 링크별 "추론 정답 vs 파서 출력" 비교표, 실패 원인 + 셀렉터/정규식 수정 제안, 검증 불가 항목·사유.
   - **검색 API ID 미스매칭이 사라졌는지**(크롤 경로라 productId 매칭이 더 이상 필요 없음) 명시.

---

## 3. 검증 / 작업 규칙

- 각 커밋 전 `npm run lint && npm run typecheck && npm run build` + fixture 단위 테스트 통과.
- 라이브 검증 스크립트는 CI 단위 테스트에 넣지 않는다(네트워크·실키 의존).
- CLAUDE.md 준수: `main` 직접 커밋·force push·원격 push 금지. Conventional Commits. 커밋 전후 `git diff --stat`/`git diff --check`/`git show --stat HEAD`로 파일 잘림 확인.
- 시크릿·개인정보·저작물(이미지 원본·리뷰 본문) 비커밋.
- worklog 갱신: `docs/worklog/feature-pipeline-mvp.md`(통합·재검증 결과 추가).

---

## 4. Definition of Done

1. 작업 베이스가 `feature/pipeline-mvp`(또는 그 파생)이고, naver.ts가 **Playwright 크롤 경로**임이 증빙됨(검색 API 호출 없음).
2. normalize.ts 용량 불일치 정책이 **§1 절충안**으로 단일화됨: 가격(base/effective)은 유지·노출, `unit_price`는 미검증/불일치 시 null+`unit_price_reliable=false`로 ml당 비교·Score ml항목에서 제외, `volume_mismatch` 플래그·검수 큐 기록, 가격의 `parse_confidence`는 high 유지. 단위 테스트로 검증.
3. **용량 감사 리포트**(§1b) 제출 — product별 DB 50ml vs 크롤 추출 용량 비교 + 정정 제안. DB·시트 직접 수정 없음(운영자 승인 후 반영).
4. 시드 중복/placeholder 정리안이 표로 제출됨(쓰기는 승인 후).
5. **크롤 경로**로 네이버 ≤5건·쿠팡 ≤3건 라이브 재검증 완료, 비교표·수정 제안·검증불가 사유 포함. 검색 API ID 미스매칭이 사라졌음을 명시.
6. 빌드·타입·린트·단위테스트 통과, worklog 갱신, 시크릿/저작물 비노출.

---

## 5. 막히면

- pipeline-mvp ↔ main rebase 충돌이 크면: 충돌 파일 목록과 함께 멈추고 보고.
- 네이버 robots.txt가 대상 경로를 막으면: 크롤 금지, "검증 불가 + 사유" 보고(절대 정답 날조 금지).
- 실제 브랜드스토어 URL이 부족(placeholder뿐)하면: 운영자에게 실제 URL 제공 요청.
