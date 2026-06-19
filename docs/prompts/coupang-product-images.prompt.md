# Claude Code 작업 프롬프트 — 쿠팡 어댑터 PR 머지 + 제품 이미지 표시

> Part A: 쿠팡 가격 어댑터 PR(#21)을 머지한다.
> Part B: 신규 브랜치에서 **쿠팡 `productImage`를 제품 상세·리스트 카드 이미지로** 표시한다.
> 가격 어댑터와 이미지 표시는 **별개 기능**이므로 브랜치/PR을 분리한다(CLAUDE.md).

---

## 0. 컴플라이언스 전제 (운영자 확정)
- 쿠팡 파트너스 API의 `productImage`는 **회원이 자기 사이트에 게재하라고 제공**되는 자산 → 사용 OK. **단 쿠팡 파트너스 고지 문구**("이 페이지는 쿠팡 파트너스 활동의 일환으로 일정액의 수수료를 받습니다" 류)를 **이미지/링크가 보이는 페이지에 반드시 노출**(DESIGN §12). 누락 = 정책 위반.
- 운영자가 상세·리스트 **대표 이미지로** 쓰기로 확정(오퍼 맥락을 넘어선 사용) → 고지 문구가 컴플라이언스 앵커.
- **AI 생성 가짜 제품 이미지·상세페이지 캡처는 사용 안 함**(신뢰·저작권).

---

# Part A — PR #21 머지

- CI(`validate`) green 확인: `gh pr checks 21 --watch`.
- green이면 `gh pr merge 21 --merge --delete-branch` (원래 계획). 실패 시 멈추고 보고(머지 금지).
- `git checkout main && git pull origin main`로 최신화. (이미 머지됐으면 이 Part 스킵.)

---

# Part B — 제품 이미지 표시 (신규 브랜치)

베이스: 머지된 최신 `main`. 분기 **`feature/coupang-product-images`**.

## 1. 데이터 흐름 / 분리 원칙
- **`products.image_url`은 시트(운영자) 소유** — 크롤러가 덮어쓰지 않는다(sheet = source of truth). 운영자 입력 이미지가 **최우선**.
- 쿠팡 이미지는 **크롤러 파생 폴백**으로 별도 저장. UI에서 레이어링:
  > **표시 이미지 = `products.image_url`(운영자) → 쿠팡 `productImage`(파생) → placeholder**

## 2. 어댑터: `productImage` 캡처·영속화
- 쿠팡 검색 매칭 시 응답의 `productImage`를 가격과 함께 저장.
- 저장 위치(딥링크 캐시 패턴과 동일하게): `price_snapshots.image_url`(스냅샷별) + `listings.latest_image_url`(최신 캐시). → 마이그레이션 `0011`.

## 3. 공개 뷰 확장
- `listing_prices_public` 뷰에 **`image_url` 컬럼 추가**(안전한 표시 컬럼) → 마이그레이션 `0011`에 뷰 재정의 포함. 다른 안전-컬럼/필터/anon-grant 규약은 그대로.

## 4. 표시 이미지 해소 (리스트·상세)
- **리스트 카드**(제품당 1장): `products.image_url` 있으면 그걸, 없으면 그 제품의 **대표 쿠팡 이미지**(예: 활성 쿠팡 listing의 `image_url`), 없으면 placeholder.
  - 해소 방식은 쿼리 레이어 또는 `current_prices`에 `display_image_url` 파생 필드(선택). **`products.image_url`은 건드리지 말 것.**
- **상세**: 동일 우선순위. (원하면 판매처별 행에 각 listing 이미지도 가능하나 MVP는 대표 1장으로 충분.)

## 5. next/image & placeholder
- `next.config`의 `images.remotePatterns`에 **쿠팡 이미지 CDN 도메인** 추가(실제 productImage URL에서 호스트 확인 — 예: `*.coupangcdn.com`).
- 이미지 **hotlink**(URL 저장 → next/image 프록시). URL 만료/404/누락 시 **placeholder 폴백**(기존 `ProductImage` 컴포넌트 활용, 1:1, `#F5F3EA` 배경).

## 6. 고지 문구
- 쿠팡 이미지/링크가 보이는 **상세·리스트 페이지에 파트너스 고지 문구** 노출(컴포넌트화 권장, 푸터/이미지 근처). 이미 있으면 재사용, 없으면 추가.

## 7. 테스트
- 어댑터: `productImage` 캡처·영속화, 공개 뷰가 `image_url` 노출.
- 표시 우선순위: `products.image_url` 우선 → 쿠팡 폴백 → placeholder(빈/404 URL).
- next/image가 외부 쿠팡 도메인 렌더, 깨진 URL → placeholder.
- 고지 문구가 상세·리스트에 렌더.
- 기존 공개뷰/가격/네이버/normalize 테스트 회귀 통과.
- 각 커밋 전 `lint && typecheck && test:all && build`.

## 8. 브랜치 & 커밋 (CLAUDE.md)
- 분기 `feature/coupang-product-images`(최신 main). main 직접 커밋·force push 금지.
- 커밋 단위:
  - `feat(db): 0011 add image_url to snapshots/listings + public view`
  - `feat: capture coupang productImage in adapter`
  - `feat: product display image precedence (operator → coupang → placeholder)`
  - `feat: render product images on detail and list`
  - `chore: allow coupang image cdn in next/image remotePatterns`
  - `feat: coupang partners disclosure on image/link pages` (없을 때)
  - `test: product image precedence and placeholder fallback`
  - `docs: worklog for coupang-product-images`
- 각 커밋 전후 `git diff --stat`/`git diff --check`/`git show --stat HEAD`. `docs/prompts/`·`tmp/`·`UI_DESIGN.md`(운영자 미커밋 편집)·시크릿 비커밋.
- 마이그레이션 0011 원격 적용은 기존 게이트(백업→session pooler repair/push, 적용 계획 보고 후 단일 go).
- 영어 PR(요약·이유·테스트결과 + 컴플라이언스 노트: 파트너스 고지) → CI green → `gh pr merge --merge --delete-branch`.
- worklog `docs/worklog/feature-coupang-product-images.md`.

## 9. Definition of Done
1. 상세·리스트에 제품 이미지 렌더: **운영자 이미지 우선 → 쿠팡 productImage 폴백 → placeholder**.
2. `products.image_url`(시트 소유)은 크롤러가 덮어쓰지 않음(분리 유지).
3. 쿠팡 `productImage`가 어댑터에서 캡처·영속화되고 공개 뷰로 노출.
4. next/image 도메인 허용 + 깨진 URL placeholder 폴백.
5. **파트너스 고지 문구**가 이미지/링크 페이지에 노출.
6. 마이그레이션 0011 원격 적용(게이트), 테스트·빌드·CI 통과, worklog 작성.

## 10. 막히면
- 쿠팡 이미지 CDN 호스트가 불명확 → 실제 productImage URL에서 확인 후 remotePatterns 반영(추측 금지).
- `products.image_url` 자동 채움 vs UI 폴백 중 택일이 모호 → **UI 폴백(products는 안 건드림) 권장**, 결정 보고.
- 고지 문구 위치/문구가 모호 → DESIGN §12 기준으로 제안 후 확인.
- 0011 외 추가 스키마 필요 시 멈추고 보고.
