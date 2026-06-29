# feature/product-recommendation-features

## 구현 기능 요약
운영자가 `products` 시트의 `features` 셀에 직접 작성한 상세 제품 특성을 **화면용 추천 사유로 요약·정규화**하고, 원문은 별도 컬럼에 백업.

- `features`: 쉼표 구분 짧은 명사구 4~6개로 통일(기존 2~8행 톤). `prod.features.split(',')`로 칩 렌더링 + `description`으로 사용 → 그대로 "제품 추천 이유"로 노출.
- `features_detail` (신규): 운영자 상세 원문 write-once 백업. 표시에는 쓰지 않음.

### 정규화 규칙
- 순서: 제형/규격 → 핵심 성분·기능 → 효과·사용감 → 추천 피부타입 → 인기·세그먼트 태그
- 인기·세그먼트 태그 유지: `올영 인기`, `남성 인기/추천`, `백화점 Top`, `더마/온라인 브랜드 TOP`, `온가족 사용`
- 긍정 추천 이유만: `민감 피부 주의`, `비추천`, `호불호` 등 주의·부정 표현은 요약에서 제외(원문 detail에 보존)
- 대상: products 9~102행(직접 작성분 94개). 2~8행(기존 Claude 생성, 이미 목표 문체)은 미변경, `features_detail` 공란.

## 주요 변경 파일
- `lib/types.ts` — `Product.features_detail?: string | null` 추가(optional, 레거시 mock 호환)
- `crawler/sheets/validate.ts` — `simpleProductRowSchema`에 `features_detail` optional 필드
- `crawler/sheets/setup_headers.ts` — products 헤더 끝에 `features_detail`(N열) append. naver_prev와 동일하게 **끝에 고정**(row1만 덮어쓰므로 중간 삽입 시 기존 셀 밀림)
- `crawler/sheets/import.ts` — Supabase/mock 양 경로 products upsert에 `features_detail` 반영
- `supabase/migrations/0020_product_features_detail.sql` — `products.features_detail text` additive nullable 컬럼. anon은 `select *`라 view/grant 변경 불필요
- `docs/features-normalization.md` — 행별 원본↔요약 정규화 표(검토/추후 재편집 소스)

## 시트 반영 (완료)
- 일회성 스크립트로 라이브 `products` 탭에 반영: `features_detail`(N) = 각 행의 **기존 features 값(원문)**, `features`(H) = 요약본.
- 매칭: (brand|name) 기준, 94/94 매칭 후 batchUpdate(헤더 1 + 94×2 = 189 셀 range).
- 검증: 헤더 N=`features_detail`, 2·8행 features 유지+detail 공란, 9·20행 요약/원문 분리 확인.
- 스크립트는 일회성이라 커밋하지 않고 삭제(`scripts/ops/_apply-features-tmp.ts`, `_verify-features-tmp.ts`).

## 테스트 결과
- 관련 tsx 테스트 통과: `test:schemav2`, `test:keymatch`, `test:sheets`, `test:inspection`, `test:linkonly` 모두 PASS.
- 변경 파일 타입 클린(`tsc --noEmit`에 본 변경 관련 에러 없음). 기존 무관 에러 2건: `normalize.test.ts:368`, `scripts/ops/_test-sync-live.ts:7`.

## 남은 이슈 / TODO
- **마이그레이션 0020 prod 적용 필요** (현재는 시트만 반영됨). 미적용 시 `features_detail`은 upsert에서 무시되거나 에러 → 적용 후 `crawler:sync`/`sheets:import`.
- **`sheets:headers` 실행 필요**: HEADERS에 `features_detail` 추가분을 라이브 시트 헤더에 일치시키기(이미 스크립트로 N1을 써둬서 값은 일치하나, 표준 경로로도 멱등 보장).
- 화면 노출 변경은 불필요(요약이 곧 기존 `features` 경로로 노출). `features_detail`을 상세 토글 등으로 보여주려면 별도 작업.
- 신규 제품 추가 시: 운영자는 상세 원문을 `features_detail`이 아닌 `features`에 적되, 추후 같은 방식으로 요약하거나 작성 가이드 정립 필요(문체 가이드는 docs/features-normalization.md 참고).
