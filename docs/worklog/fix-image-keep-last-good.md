# fix/image-keep-last-good

쿠팡 이미지 해석이 (일시적으로) 실패해도 `products.image_url`을 빈값으로 덮어쓰지 않고 **직전 성공 이미지(last-good)를 유지**하도록 변경. 동시에 워크플로의 **중복 import**를 제거해 쿠팡 rate limit 초과의 근본 원인을 차단.

## 배경 / 사고
- 증상: 사이트 제품 이미지가 한꺼번에 대거 소실.
- 추적: DB의 import run이 **1분 간격 쌍**으로 들어옴 = 단일 워크플로 1회 실행이 import를 **두 번** 수행.
  - `.github/workflows/crawl.yml`에 `Run Google Sheets Import`(=`sheets:import`) 스텝이 있고,
  - 다음 스텝 `Run Crawler`(=`crawler:sync` → `crawler/run.ts` Step 1)도 **내부에서 또 import**.
- 결과: 워크플로 1회 = import 2회 → 쿠팡 이미지 해석 ~34건 × 2 = ~68건/2분 → **Coupang Partners 50/분 초과** → 해석 전부 실패(`null`).
- 치명타: import가 매 run **해석 결과로 image_url을 무조건 덮어씀**. 해석값이 `''`(미해석)이면 `resolveImageUrl`이 `null` 반환 → 좋은 이미지가 영구 삭제. 즉 *일시적* 실패가 *영구* 데이터 손실로 전환.
  - (쿠팡 API 자체는 정상 = rate limit에 의한 일시적 실패였음.)

## 변경

### 0. 워크플로 중복 import 제거 (근본 원인)
- `.github/workflows/crawl.yml`: **`Run Google Sheets Import` 스텝 삭제**.
  - `crawler:sync`(run.ts Step 1)가 이미 `runSheetImport()`를 실행하므로 import는 1회만 수행됨 → 쿠팡 호출 절반 → rate limit 여유.
  - import에 필요한 `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_SHEETS_SPREADSHEET_ID` 시크릿을 남은 `Run Crawler` 스텝 env로 이동(여기서 import가 돌므로 필수).
  - 결과: 워크플로 1회 실행 = import 1회 = 쿠팡 이미지 해석 1패스.

### 1. 해석 실패 시 기존 이미지 유지 (방어)
- `crawler/sheets/import.ts` `resolveImageUrl`:
  - 시그니처에 `previousImageUrl`(현재 DB image_url) 추가, 반환을 `{ image, keptPrevious }`로 변경.
  - 규칙:
    1. 시트 셀 **빈값** → `null` (운영자가 의도적으로 지움 — 그대로 비움).
    2. **일반 이미지 URL(.jpg 등)** → 그대로 통과.
    3. **쿠팡 제품 URL, 해석 성공** → 해석된 productImage로 갱신.
    4. **쿠팡 제품 URL, 해석 실패(`''`)** → `previousImageUrl`이 있으면 **그 값을 유지(`keptPrevious=true`)**, 없으면 `null`.
  - Supabase 경로: products upsert 전에 `products(product_key, image_url)`를 한 번 읽어 `prevImageByKey` 맵 구성 → 각 행에 직전값 전달. Mock 경로: 기존 `existing.image_url` 사용.
  - 유지 건수 로그: `[Sheet Import] Coupang image unresolved, kept previous: N`.
- 1차 단순 규칙: "쿠팡 URL & 해석 실패 → 직전값 유지". 운영자가 쿠팡 URL을 **다른 제품 것으로 교체했는데 같은 run에서 재해석도 실패**하는 좁은 stale 케이스는 감수(다음 성공 run이 교정). "직전 해석에 쓰인 시트 URL 저장 후 비교"는 과한 복잡도라 보류.

## 주요 변경 파일
- `.github/workflows/crawl.yml` — 중복 import 스텝 제거 + Google 시크릿 이동.
- `crawler/sheets/import.ts` — `resolveImageUrl` last-good 유지 + 양 경로(prev 조회/전달, 로그).
- `crawler/sheets/__tests__/imageKeep.test.ts` — 신규 순수 로직 테스트.
- `package.json` — `test:imagekeep` 추가 + `test:all`에 편입.

## 테스트
- `crawler/sheets/__tests__/imageKeep.test.ts`:
  - 쿠팡 URL 해석 실패 + 직전 이미지 있음 → **직전값 유지**(keptPrevious).
  - 해석 성공 → 새 값 사용.
  - 시트 셀 비움 → 직전값 있어도 `null`(운영자 의도).
  - 일반 .jpg → 그대로.
  - 해석 실패 + 직전값 없음/공백 → `null`.
  - **회귀: 전 제품 해석 실패(rate limit 시뮬) → 모든 이미지 보존**(이번 사고 재발 방지).
- `npm run test:imagekeep` / `test:all` / `typecheck` / `build` green. lint: 무관 파일 기존 warning 3건(0 errors).

## 운영 메모 (코드 아님)
- 워크플로 수정 후 1회 실행 = import 1회. **수동으로도 연속 2번 돌리지 말 것**(쿠팡 rate limit).
- merge 후 `crawler:sync` **1회** 실행 → 미해석 이미지가 직전값으로 보존되는지(빈값 안 됨) 확인.

## TODO (선택, 후속)
- `resolveProductImages`에 429 backoff/재시도를 둬 부분 실패 자체를 더 줄이면 견고.
