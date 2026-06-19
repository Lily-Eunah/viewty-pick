# Claude Code 작업 프롬프트 — 시트 구조 셋업 (카테고리 2tier · product_key 매칭 · name 동기화)

> 목적: PR #27(2tier 카테고리 + key-우선 import)에 맞춰 **운영자 Google 시트 구조**를 갖춘다.
> 이후 운영자가 제품별 소분류 + product_key만 복붙하면 신규 소분류 활성 + 배지-skip 완전 차단.
> **라이브 운영자 시트 변경** → 백업 선행, 추가형(기존 데이터 비파괴), 드롭다운 제거.
> 베이스: 최신 `main`(#27 머지 후). 분기 `chore/sheet-2tier-setup`. 크레덴셜은 로컬 `.env`(GOOGLE_SERVICE_ACCOUNT 등), **비노출**.

## 0. 선행
- **현재 시트 전체 백업/export**(values dump) — 위치 보고. 구조 변경 전 필수.
- 실제 탭/헤더를 **먼저 점검**(`crawler/sheets/setup_headers.ts`·`validate.ts` 스키마 + 라이브 시트 fetch) → 추측 말고 현 컬럼에 맞춰 추가.

## 1. 구조 변경 (추가형 — 기존 데이터/행 보존)
- **products**: 소분류명을 넣는 `category` 컬럼 확보(plain text). **드롭다운 검증 제거.**
- **product_links / badges (그리고 overrides)**:
  - **`product_key` 컬럼 추가**(운영자 복붙용). 기존 매칭 컬럼(product_name)은 **유지**(import는 key 우선·name 폴백이라 점진 이행 가능).
  - **제품명 표시 컬럼 = name-sync 수식**: `=IFERROR(VLOOKUP($<product_key>, products!<key>:<name>, <idx>, FALSE), "")` → products.name과 자동 동기화(수동 재입력 X). (수식은 평가값으로 import됨 — 매칭은 어차피 key라 수식 실패해도 안전.)
  - 드롭다운 제거.
- **`_categories` 참조 탭 신설**: 6 대분류 / 소분류 목록(복붙 소스). DB 시드와 일치:
  ```
  선케어        | 선크림 · 선스틱 · 선쿠션
  스킨케어      | 스킨/토너 · 로션 · 에센스/세럼/앰플 · 올인원 · 크림
  클렌징        | 클렌징폼/젤 · 오일/밤 · 워터/밀크
  마스크팩      | 시트팩 · 패드
  바디케어      | 샤워/입욕 · 바디로션/크림
  베이스 메이크업 | 쿠션
  ```

## 2. 스크립트화
- 위를 idempotent **셋업 스크립트**로(`scripts/ops/setup-sheet-2tier.ts` 또는 `setup_headers` 확장, `npm run sheets:setup-2tier` 류). 재실행해도 중복 컬럼/탭 안 만들고, 기존 데이터 안 덮게.
- 기존 `migrate-sheet-dropdowns-brand.ts` 패턴 참고.

## 3. 운영자 입력 절차 (스크립트 후 — 문서로 안내)
- 제품별 **소분류**를 `_categories`에서 복붙해 products.category에 입력.
- product_links/badges/overrides 행에 **product_key** 입력(제품명은 수식 자동).
- `npm run sheets:import` → dedup/reconcile, **중복 0**, 배지-skip 0, 신규 소분류 매핑 확인.
- 데이터 바뀌면 revalidate 또는 `cf:deploy`로 웹 반영.

## 검증 / DoD
1. 시트 백업 완료(보고).
2. product_links/badges/overrides에 product_key 컬럼 + name-sync 수식, products 소분류 컬럼, `_categories` 탭, 드롭다운 제거 — **기존 데이터 무손실**.
3. 스크립트 idempotent(재실행 안전). 운영자 입력 절차 문서화(worklog).
4. (입력 후) `sheets:import`에서 배지-skip 0 · 신규 소분류 귀속 확인.
- 마이그레이션/코드 변경 시 typecheck/build green, 영어 PR, `git diff --check`, 시크릿·`docs/prompts`·`tmp` 비커밋.

## 막히면
- 시트 API 권한/크레덴셜 없으면 멈추고 보고(추측·강행 금지). 라이브 시트 쓰기 전 백업 안 됐으면 중단.
- 수식 컬럼이 import 매칭과 충돌하면 매칭은 key, 표시만 수식 원칙 재확인.
- 헤더/탭 명이 스키마와 다르면 라이브 기준으로 맞추고 보고.
