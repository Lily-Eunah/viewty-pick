# fix/ui-back-nav-and-minor-filter

두 개의 소소한 내비게이션 UX 버그 수정.

## 이슈 1 — 외부 진입 페이지에서 이전 버튼이 죽는 문제

**증상**: Threads 광고 링크로 `/c/suncare`에 직접 진입하면 헤더의 이전 버튼이
아무 동작을 안 하거나(인앱 히스토리 없음) 외부 사이트로 튕겨나감.

**원인**: `Header`의 뒤로가기 핸들러가 무조건 `router.back()` 호출
(`components/layout/Header.tsx`). 외부에서 직접 진입한 페이지는 우리 오리진 기준
이전 히스토리가 없어 dead-end.

**수정**: "인앱 히스토리가 있으면 `router.back()`, 없으면 홈(`/`)으로".
- `lib/nav/inAppNav.ts` — 클라이언트 번들의 모듈 싱글턴 `hadInAppNav`.
  풀 페이지 로드마다 false로 리셋, 첫 클라이언트 라우트 변경 후 true.
- `components/layout/NavigationTracker.tsx` — 루트 레이아웃에 1회 마운트,
  `usePathname` 변경을 감지해 `markInAppNav()`. 진입 경로와 비교(Strict Mode
  이중 호출 안전).
- `Header` 는 `getHadInAppNav()`로 분기. `showBack` 헤더를 쓰는 7개 서브페이지
  전부에 일괄 적용됨.

## 이슈 2 — 상세 갔다 오면 소카테고리 필터가 '전체'로 풀림

**증상**: 카테고리 페이지에서 소카테고리(예: 오일/밤) 선택 → 상품 상세 →
뒤로가기 하면 소카테고리가 풀리고 전체로 돌아감. (피부타입은 유지됨)

**원인**: `selectedMinor`/`sortBy`가 `CategoryProductList`의 로컬 `useState`.
상품 카드가 `<Link>` 소프트 네비게이션이라, 뒤로가기 시 컴포넌트가 재마운트되며
상태가 초기값으로 리셋. (피부타입은 localStorage 기반 `useSelectedSkinType`라
살아남는 게 대조 근거.)

**수정**: 소카테고리·정렬을 URL 쿼리(`?sub`, `?sort`)로 이관.
- `lib/hooks/useUrlParam.ts` — `useSyncExternalStore`로 `window.location.search`
  를 hydration-safe하게 읽고, 쓰기는 `window.history.replaceState`(Next 라우터와
  통합). `useSearchParams()`를 **의도적으로 피함**: 정적 프리렌더 라우트에서
  CSR bail-out을 일으켜 상품 리스트 프리렌더(SEO/LCP)를 깨뜨리기 때문.
  replaceState라 필터 변경이 히스토리를 오염시키지 않음.
- `CategoryProductList` — `useState` → `useUrlParam` 로 교체.

## 검증

- lint(변경 파일 스코프 clean; 기존 `scripts/ops/_probe_*.ts` gitignore 노이즈는
  무관) · typecheck · test:all · build 통과.
- **build 출력 확인**: `/c/[category]` 여전히 `●`(SSG, 정적 프리렌더) — Worker
  무료플랜 CPU 예산(1102) 제약 유지됨. useSyncExternalStore 방식이 dynamic
  de-opt을 일으키지 않음을 확인.
- **런타임(next dev 프리뷰)**:
  - 이슈2: `/c/cleansing-care`에서 오일/밤 클릭 → URL `?sub=cleansing-oil`
    (리로드 없음), 목록 5개 필터 → 상품 클릭 → 상세 → 뒤로가기 →
    URL·칩(오일/밤 선택)·필터 모두 복원 확인. URL 직접 로드로도 복원(공유 가능).
  - 이슈1: `/c/suncare` 풀 로드(인앱 히스토리 없음) → 이전 버튼 → 홈 이동 확인.
  - 회귀: 홈→상품A→연관상품B 인앱 이동 → 이전 버튼 → A로 복귀(홈 아님) 확인.
