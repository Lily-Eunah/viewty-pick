# feature/link-only-sheet

## 목표
크롤 대상(naver/coupang/oliveyoung) 중 **가격을 못 가져온 link-only 링크**(no_offer /
data_error / 이종세트 보류)를 매 `crawler:sync`마다 **`link_only` 시트 탭에 자동 정리**.
운영자가 원인을 보고 액션(쿠팡 URL 교체, 네이버/올영 단품 확인)을 취하게 한다.

inspection 탭(=가격은 있으나 warning, O/X 검수)과 별개 — 여기는 **가격 자체가 없는** 링크.

## 구현 요약
- 신규 모듈 `crawler/sheets/linkOnly.ts` (inspection.ts의 service-account write 패턴 재사용)
  - `LINK_ONLY_HEADERS`: `판매처 | 브랜드 | 제품명 | productId | 원인 | 권장 액션 | URL | 상태 | 갱신일`
    (productId 컬럼에는 안정 식별자인 `product_key`를 기록 — upsert 키와 동일)
  - `classifyLinkOnly(seller, outcome, sourceText)` — **순수 함수**. 어댑터가 이미 결정한
    outcome + reason(sourceText)을 그대로 매핑(새 추론 없음). 이종세트 vs 단순 miss는
    어댑터가 내보내는 reason 마커(`heterogeneous`/`세트`/`이종`)로만 구분.
    - coupang: `no_offer` → `productId가 Partners 검색 top-N에 없음` / 액션 `검색 상위 쿠팡 URL로 교체`;
      `data_error`(short-link) → `제품 상세 URL 아님` / 액션 `제품 상세 URL(/vp/products/{id})로 교체`
    - oliveyoung: 이종세트 → `올리브영 오퍼가 이종 세트 → 검수 보류` / 아니면 `네이버 검색에 올리브영 단품 오퍼 미발견(Tier 3/4)`; 액션 `올리브영 단품 판매·URL 확인`
    - naver: 이종세트 → `id-anchored이나 묶음(이종 세트) → 검수 필요` / anchor miss → `anchor miss + 공식몰/카탈로그 폴백 없음`; 액션 `공식몰 단품 URL 확인·교체 또는 세트 분리`
  - `buildLinkOnlyRows(items, today)` — `product_key+seller`로 dedupe(last wins),
    상태=`미해결`·갱신일 스탬프, 빈 키 skip.
  - `upsertLinkOnly(items)` — **매 sync 전체 재생성**(clear+update). 가격이 잡혀 current에서
    빠진 링크는 자동으로 행에서 사라짐 → 미해결만 남음. (운영자 sticky 상태 없음 → 재생성이 단순/안전.)
- `crawler/run.ts`
  - 크롤 루프 `no_offer || data_error` 분기에서 link-only 후보 수집(`linkOnlyCandidates`).
    어댑터가 있는 seller만 루프 본문에 도달하므로 **zigzag/ably는 자동 제외**(매칭 실패 아닌
    의도된 link-only). `failed`/skip(쿠팡 키없음·rate cap)은 수집 대상 아님.
  - Step 8.6에서 `upsertLinkOnly` 호출(best-effort, mock-skip, 실행 차단 안 함).
- `crawler/core/notify.ts` — 일일 요약에 `🔗 가격 미매칭 link-only: N건` 라인 추가
  (inspection N건과 구분).
- `crawler/sheets/setup_headers.ts` — `link_only` 탭 헤더 등록(`sheets:headers`로 유지).

## 주요 변경 파일
- `crawler/sheets/linkOnly.ts` (신규)
- `crawler/sheets/__tests__/linkOnly.test.ts` (신규)
- `crawler/run.ts`
- `crawler/core/notify.ts`
- `crawler/sheets/setup_headers.ts`
- `package.json` (`test:linkonly` + `test:all`에 추가)

## 테스트 결과
- `test:linkonly` (신규, 12 케이스): classifyLinkOnly(셀러별 이종세트/miss/data_error),
  buildLinkOnlyRows(dedupe·상태/날짜 스탬프·빈키 skip·전체 재생성으로 해결 링크 drop) — ALL PASSED.
- `test:summary` / `test:inspection` 회귀 0 — ALL PASSED.
- `npm run typecheck` clean, `npm run build` 성공, `npm run lint` 신규 경고 0
  (기존 `scripts/ops/migrate-sheet-dropdowns-brand.ts` 경고만 잔존).
- Live sync는 미실행(로컬에서 crawler:sync/test 금지 규칙 준수) — merge 후 CI/운영자 `crawler:sync`로
  탭 자동 채움 확인 예정.

## 남은 이슈 / TODO
- merge 후 `crawler:sync`로 link_only 탭 실제 채움 확인(원인·액션·URL). 탭이 없으면 `sheets:headers` 먼저.
- (후속) oliveyoung 'no curator affiliate_url'(tier 1, 의도된 숨김)도 현재 no_offer로 수집됨 —
  노이즈로 판단되면 별도 cause 분기 또는 제외 검토.
