# feature/favorites — localStorage-based Favorites (/wishlist + Heart Toggle)

- **일자**: 2026-06-19
- **요약**: 로그인 없이 브라우저 `localStorage`를 사용하여 제품 찜하기(즐겨찾기) 기능을 구현하고, 하트 토글 및 전용 `/wishlist` 관심상품 탭 페이지를 추가했습니다.

## 변경 (코드)

### [1] 공통 훅 및 저장소
- `lib/favorites.ts` [NEW]:
  - `useFavorites()` 커스텀 훅 구현.
  - 키: `viewtypick:favorites` (제품 slug 배열).
  - React 18+의 `useSyncExternalStore`를 도입하여 마운트 전 SSR 단계와 마운트 후 클라이언트의 Hydration 일관성 유지(Hydration mismatch 해결 및 `react-hooks/set-state-in-effect` 린트 에러 차단).
  - `storage` 이벤트 리스너를 연동하여 멀티 탭/윈도우 간 관심상품 상태를 자동 동기화하며, 동일 탭 내 인스턴스 동기화를 위해 커스텀 이벤트를 디스패치합니다.
  - 찜하기 추가 시 배열 맨 앞으로 추가(prepend)하여 최신 추가 순서가 최상단에 노출되도록 보장합니다.

### [2] 하트 토글 버튼
- `components/product/FavoriteButton.tsx` [NEW]:
  - 찜하기 활성/비활성 여부를 판별하여 하트 아이콘(outline/fill)을 렌더링하는 클라이언트 컴포넌트.
  - 클릭 이벤트 시 `e.stopPropagation()` 및 `e.preventDefault()`를 호출해 카드 링크 이동을 완전히 방지합니다.
  - Hydration 시점 이전(마운트 전)에는 기본 outline 하트를 보여주어 UI 흔들림이 없도록 조치했습니다.

### [3] 상품 카드 및 상세 페이지 연동
- `components/product/ProductCard.tsx` [MODIFY]:
  - 카드 우측 상단에 절대 좌표로 `FavoriteButton`을 추가했습니다.
  - HTML 중첩 오류(버튼 내 링크) 방지를 위해 카드의 `Link` 컴포넌트와 `FavoriteButton`을 동등 형제 레벨로 나누고 `relative` 컨테이너로 감싸 렌더링합니다.
- `components/product/ProductListCard.tsx` [MODIFY]:
  - 리스트 카드 우측 상단에 `FavoriteButton`을 연동하고, 우측 세부 영역에 `pr-10`을 부여하여 긴 타이틀이나 배지가 하트 버튼과 겹치지 않게 레이아웃을 고정했습니다.
- `app/p/[slug]/page.tsx` [MODIFY]:
  - 상품 상세 페이지의 브랜드/제품명 헤더 영역 우측에 `FavoriteButton`을 배치하여 상세 페이지에서도 즉시 찜하기가 가능하도록 개선했습니다.

### [4] /wishlist 페이지 구현
- `app/wishlist/page.tsx` [NEW]:
  - 서버 측에서 전체 활성 상품 데이터를 `getProducts()`로 조회하여 클라이언트 사이드 `WishlistClient`로 전달합니다.
- `components/product/WishlistClient.tsx` [NEW]:
  - `useFavorites()`로 찜한 slug 목록을 읽어와서 제품 목록을 필터링 및 찜한 시간 역순(최근 찜한 순)으로 정렬합니다.
  - 현재 시트상 노출 불가능한 상품(displayed seller가 없거나 삭제된 상품 등)은 자동 제외됩니다.
  - **빈 상태**: 찜한 상품이 없는 경우, "관심상품이 없어요" 안내 및 홈으로 갈 수 있는 CTA 버튼을 배치했습니다.
  - 레이아웃은 `<AppShell activeTab="wishlist">`를 사용하여 기존 탭바와 유기적으로 결합됩니다.

### [5] 네비게이션 및 헤더 개선
- `components/layout/BottomTabBar.tsx` [MODIFY]:
  - 관심상품 탭의 `handleUnderConstruction` 임시 경고와 `opacity-60` 비활성 스타일을 제거하고 실제 `/wishlist`로 라우팅되도록 설정했습니다.
- `components/layout/Header.tsx` [MODIFY]:
  - 메인 헤더 우측 상단 하트 버튼의 임시 경고를 제거하고 `/wishlist` 페이지로 바로 연결되는 `Link` 컴포넌트로 대체했습니다.

## 테스트
- **TypeScript & Lint**: `npm run typecheck` 및 `npm run lint` 모두 에러 없이 통과(그린).
- **Production Build**: `npm run build`를 통해 빌드가 정상 동작하며 `/wishlist` 라우트가 성공적으로 정적 빌드되는 것을 확인했습니다.
- **Unit/Integration Tests**: `npm run test:all`을 수행하여 기존의 19개 이상 테스트 스위트가 모두 정상 작동하는 것을 확인했습니다.
