# feature/search — 검색 기능 (실시간 클라이언트 필터)

## 구현한 기능 요약
하단 탭 "검색"과 홈 상단 SearchBar를 실제 동작시킴. 카탈로그가 작아(수십 개)
서버 라운드트립 없이 **클라이언트 실시간 필터**로 구현.

- **라우트 `/search`** (신규, 서버 컴포넌트): `getProducts()`(노출 가능 제품 = 목록과 동일
  집합) + `getCategories()`로 slug→카테고리명 맵을 만들어 `SearchClient`에 `SearchableProduct[]`
  전달. `activeTab="search"`. noindex는 루트 layout `generateMetadata`에서 사이트 전역 상속.
- **실시간 필터**: `name + brand + 카테고리명 + features 토큰`을 **대소문자 무시·trim·부분일치**로
  필터. 입력 즉시 갱신. 결과는 PR #49 규칙(`byPriceThenScore` = 가격 없는 제품 맨 아래, 그 다음
  ViewtyScore)으로 정렬.
- **추천 키워드 칩**(브랜드·카테고리): 랭킹 ① prefix > infix, ② coverage(연관 제품 수), ③ 짧은
  순. 중복 제거, 상위 6개. 탭 → 입력/필터.
- **추천 제품(바로가기)**: name/brand 매칭만, 랭킹 ① 매칭 강도(prefix>infix), ② 가격 있는 것
  먼저, ③ ViewtyScore. 상위 5개. 탭 → `/p/[slug]`.
- **빈(쿼리 없음) 상태**: 최근 검색어(localStorage `viewtypick:recent-searches`, 상위 8, 삭제
  가능) + 인기 카테고리 칩. 검색 실행(엔터/키워드/제품 클릭) 시 최근 검색어 저장(중복 제거·최신 앞).
- **결과 0**: "검색 결과가 없어요" + 카테고리로 이동 CTA.
- **홈 SearchBar**: 클릭 시 `router.push('/search')` (기존 alert 제거).
- **BottomTabBar**: 검색 탭 `handleUnderConstruction`·`opacity-60` 제거 → 실제 `/search` 링크.

## 하이드레이션
최근 검색어는 `useSyncExternalStore`로 읽음 — 첫 클라이언트 렌더가 서버 스냅샷(빈 배열)과
일치하고 마운트 후 동기화되므로 hydration 경고 없음. 동시에 effect 내 동기 setState
(`react-hooks/set-state-in-effect`)도 회피.

## 주요 변경 파일
- `app/search/page.tsx` (신규) — 서버 컴포넌트, 데이터 fetch + 카테고리명 맵
- `components/search/SearchClient.tsx` (신규) — 입력·추천·결과·최근검색 UI
- `lib/search.ts` (신규) — 순수 검색 헬퍼(필터/추천/랭킹/최근검색) + 단위 테스트 대상
- `lib/__tests__/search.test.ts` (신규) — `test:search` (→ `test:all`)
- `components/layout/BottomTabBar.tsx` — 검색 탭 실제 링크화
- `components/home/HomeInteractiveSection.tsx` — SearchBar → /search 라우팅

## 곁다리(별도 commit): 사전 존재 lint 오류 수정
react-hooks 플러그인 7.1.1 도입으로 `main`에서 이미 빨간 lint를 초래하던 오류들을 정리(이 기능과
무관, CI 게이트 통과 목적):
- `lib/hooks/useSelectedSkinType.ts` (신규) — 홈/카테고리가 공유하던 피부타입 localStorage
  로직을 `useSyncExternalStore` 훅으로 통합(중복 제거 + `set-state-in-effect` 해소).
- `components/home/HomeInteractiveSection.tsx`, `components/product/CategoryProductList.tsx` —
  위 훅 사용. 최근 본 상품의 1회성 로드 setState는 의도된 패턴이라 주석과 함께 룰 disable.
- `HomeInteractiveSection`의 `any` 매핑을 `StoredViewedProduct` 타입으로 교체(이 과정에서 누락돼
  있던 `category` 필드도 보강).
- `eslint.config.mjs` — `.wrangler/**`(gitignore된 빌드/임시 산출물) lint 무시 추가.

## 테스트 결과
- `npm run test:search`, `npm run test:all` — ALL PASSED
- `npx tsc --noEmit` — 0 errors
- `npm run lint` — 0 errors (사전 존재 경고 1건: ops 스크립트 미사용 import, 무관)
- `npm run build` — Compiled successfully, `/search` 라우트(ƒ, dynamic) 등록
- dev 런타임 스모크: `/search` 200(빈 상태), `/search?q=토` 200(결과/바로가기/칩 SSR 렌더), 홈 200

## 남은 이슈 / TODO
- (선택) 한글 초성 검색(ㅌㄴ→토너)은 후속. MVP는 substring으로 충분.
- merge 후 `cf:deploy`로 라이브 확인. 데이터 변경 아님 → sync 불필요.
- 사전 존재 경고(`scripts/ops/migrate-sheet-dropdowns-brand.ts` 미사용 `Sheets`)는 별도 정리 대상.
