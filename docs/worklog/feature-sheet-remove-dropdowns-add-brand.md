# feature/sheet-remove-dropdowns-add-brand

## 구현 기능 요약
제품 카탈로그 입력용 Google Sheet를 복사·붙여넣기 친화적으로 개선했다.

1. **드롭다운(데이터 유효성 검사) 전체 제거** — `category`, `product_name`,
   `badge_type`, `seller`, `override_type`, `skin_types` 힌트 등 모든 탭의 유효성
   검사를 제거하여 셀에 자유롭게 붙여넣기가 가능하도록 했다.
2. **`product_links`에 `brand` 컬럼 추가** — `product_name`(A) 우측(B)에 삽입하여
   `products` 탭과 동일하게 name·brand를 함께 볼 수 있게 했다.
3. **`products` → `product_links` 자동 입력** — `product_links!A2`, `B2`에
   `ARRAYFORMULA`를 설정하여 `products`의 name(B열)·brand(C열)를 행 위치 기준으로
   자동 미러링한다. `products`에 행을 추가하면 `product_links`에 자동 반영된다.
   판매처 링크 컬럼(oliveyoung·coupang·naver·zigzag·ably)만 직접 입력한다.

## 주요 변경 파일
- `crawler/sheets/reseed_sheets.ts`
  - `product_links` 헤더에 `brand` 추가.
  - `setupValidation()`(드롭다운 설정) 제거.
  - `writeProductLinks()` 추가: 판매처 링크는 C2에, name·brand는 A2/B2 ARRAYFORMULA로 기록.
- `crawler/sheets/setup_headers.ts`
  - `product_links` 헤더에 `brand` 추가.
- `scripts/ops/migrate-sheet-dropdowns-brand.ts` (신규)
  - 라이브 시트에 비파괴적으로 적용하는 1회성 마이그레이션:
    모든 탭 유효성 검사 제거 → `product_links`에 `brand` 컬럼 삽입 →
    헤더 갱신 → A2/B2 ARRAYFORMULA 자동 입력 설정.
  - 기존 링크 데이터는 보존(컬럼만 우측 시프트).
- `package.json`
  - `sheets:migrate-dropdowns-brand` npm 스크립트 추가.

## 테스트 결과
- `tsx crawler/sheets/__tests__/dedup.test.ts` → **ALL PASSED** (9/9).
- 변경한 TS 파일 타입체크(`tsc --noEmit --strict`) → **통과(0 errors)**.
- 라이브 시트 검증:
  - `product_links` 헤더 = `product_name | brand | oliveyoung | coupang | naver | zigzag | ably` ✓
  - name·brand 자동 입력 45행, `products` 45행과 정렬 일치 ✓
  - 샘플 범위 내 잔여 데이터 유효성 검사 셀 0개(드롭다운 제거 확인) ✓
  - 마이그레이션 전 `product_links` 백업(FORMULA 렌더) 보관.
- `import.ts`는 헤더명 기준 파싱이므로 `brand` 컬럼 추가는 영향 없음
  (`productLinksWideRowSchema`가 미사용 키를 무시).

## 남은 이슈 / TODO
- **미러링은 행 위치 기준**이다. `products`와 `product_links`의 행 순서가
  어긋나면 링크가 엉뚱한 제품에 매칭된다. 제품 추가·삭제 시 두 탭의 행 순서를
  반드시 동일하게 유지할 것.
- 자동 입력 컬럼(A·B)은 수식이므로 직접 입력/붙여넣기하면 안 된다.
  편집은 `products` 탭에서 한다.
- **Git 커밋 미수행**: 작업 환경(Claude Desktop mount)에서 git index 손상 및
  파일 CRLF/truncation 이슈가 확인되어, 손상된 커밋을 push할 위험이 있어 커밋을
  보류했다. 로컬(비-mount) 환경에서 아래 절차로 커밋·push 권장.
- 임시 스크래치 파일 삭제 필요: `_inspect_tmp.mjs`, `_deltest.txt`,
  `scripts/ops/_check_alignment.ts` (mount 권한 문제로 세션 중 삭제 불가).

## 로컬 커밋 절차(권장)
```
git checkout -b feature/sheet-remove-dropdowns-add-brand
git add crawler/sheets/reseed_sheets.ts crawler/sheets/setup_headers.ts \
        scripts/ops/migrate-sheet-dropdowns-brand.ts package.json \
        docs/worklog/feature-sheet-remove-dropdowns-add-brand.md
git commit -m "feat: remove sheet dropdowns, add brand column with products autofill"
# 스크래치 파일 정리
rm -f _inspect_tmp.mjs _deltest.txt scripts/ops/_check_alignment.ts
```
