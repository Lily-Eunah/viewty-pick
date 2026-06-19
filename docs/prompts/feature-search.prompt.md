# Claude Code 작업 프롬프트 — 검색 기능 (/search, 실시간 필터)

> 목적: 하단 탭 "검색"과 홈 상단 SearchBar를 실제 동작시키기. 카탈로그가 작으니(수십 개) **클라이언트 실시간 필터**가 즉각적이고 단순.
> 현재: `/search` 라우트 없음. `BottomTabBar` 검색 탭은 `handleUnderConstruction` alert + `opacity-60`. `SearchBar`는 순수 표시 컴포넌트(라우팅 없음). 목록은 `getProducts`가 노출 가능 제품(링크 보유)만 반환(PR #49).
> 베이스: 최신 `main`. 분기 `feature/search`. 대상: `app/search/page.tsx`(신규), 검색 클라이언트 컴포넌트(신규), `components/layout/BottomTabBar.tsx`, `components/common/SearchBar.tsx`(라우팅 연결), 홈 `app/page.tsx`(상단 바 클릭→/search).

## 동작
1. **라우트 `/search`**: 서버 컴포넌트가 `getProducts()`(노출 가능 제품)로 목록을 가져와 클라이언트 컴포넌트 `<SearchClient products=... initialQuery=?q? />`에 전달. `activeTab="search"`.
2. **실시간 필터(클라이언트)**: 입력값으로 **name + brand + 카테고리명 + features 토큰**을 **대소문자 무시·trim·부분일치(substring)**로 필터. 입력 즉시 결과 갱신.
3. **입력 중 자동완성/추천(핵심)**: 쿼리가 있을 때 결과 그리드 위에 추천 영역 노출:
   - **추천 키워드 칩**: 입력과 매칭되는 **브랜드·카테고리명**(products에서 파생, unique). 탭하면 그 키워드로 입력/필터. **랭킹**: ① 입력으로 *시작(prefix)* 하는 것 우선 > 중간 포함, ② 연관 제품 수(coverage) 많은 순, ③ 짧은 순. 중복 제거, **상위 6개**.
   - **추천 제품(빠른 이동)**: 매칭 제품을 썸네일 + 이름 + 최저가 컴팩트 행으로, 탭하면 바로 `/p/[slug]`. **랭킹**: ① 매칭 강도(브랜드/이름이 입력으로 *시작* = 상위, *중간 포함* = 하위), ② 가격 있는 것 먼저(`hasAnyPrice`), ③ ViewtyScore 높은 순. **상위 5개**.
4. **결과 표시**: 기존 `ProductCard`(또는 `ProductListCard`) 그리드로. 결과 수 표시. 정렬은 기존 목록 규칙 재사용(가격 없는 제품은 아래 — PR #49 `byPriceThen` 동일 적용).
5. **빈 상태(쿼리 없음)**:
   - **최근 검색어**(localStorage 키 `viewtypick:recent-searches`, 상위 ~8개, 삭제 가능) + **인기 키워드/카테고리 칩**.
   - 검색 실행(엔터/제품 클릭) 시 검색어를 최근 검색어에 저장(중복 제거, 최신 앞).
   - 결과 0 → "검색 결과가 없어요" + 카테고리로 이동 제안.
5. **홈 상단 SearchBar**: `readOnly`로 두고 클릭 시 `router.push('/search')`(또는 `?q=` 프리필). `/search`에선 편집 가능한 입력이 필터를 구동.
6. **BottomTabBar**: 검색 탭의 `handleUnderConstruction`·`opacity-60` **제거** → 실제 `/search` 링크.

## 비고
- 노출 가능 제품(링크 보유)만 검색 대상(목록과 동일 집합).
- (선택) 한글 초성 검색(ㅌㄴ→토너)은 nice-to-have — MVP는 substring으로 충분, 후속.
- noindex 유지(런칭 전).

## 테스트
- "토너" 입력 → 토너류만. 브랜드("토리든")로도 매칭. 대소문자/공백 무관.
- 입력 중 추천 키워드 칩(브랜드·카테고리) + 추천 제품 상위 N 노출. 키워드 칩 탭→필터, 추천 제품 탭→상세 이동.
- 쿼리 비움 → 최근 검색어(localStorage) + 인기 키워드. 검색 실행 시 최근 검색어 저장(중복 제거·최신 앞).
- 가격 없는 제품은 결과에서도 맨 아래.
- 결과 0 → 안내.
- 검색 탭이 alert 없이 /search로 이동. hydration 경고 없음(최근 검색어는 마운트 후 읽기). `test:all`(또는 weblayer)·typecheck·build·lint green.

## 적용
- `feature/search`: `feat(web): /search live filter over name/brand/category + wire search tab`, `test`, `docs: worklog`. 영어 PR → CI → merge → `cf:deploy` → 라이브 검색 확인. (데이터 변경 아님 → sync 불필요.)
