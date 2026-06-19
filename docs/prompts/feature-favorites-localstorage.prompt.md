# Claude Code 작업 프롬프트 — 즐겨찾기(관심상품) localStorage 기반 (/wishlist + 하트 토글)

> 목적: 제품 카드·상세에 하트 토글, 하단 탭 "관심상품"에서 즐겨찾기 목록. 로그인 없이 **localStorage**로.
> 현재: `/wishlist` 라우트 없음. `BottomTabBar` 관심상품 탭은 `handleUnderConstruction` alert + `opacity-60`. ProductCard에 하트 없음.
> 참고: 이건 **실제 Next 앱**이라 localStorage 사용 정상(클라이언트 컴포넌트 한정). 카탈로그가 작아 위시리스트 데이터는 전체 제품을 받아 slug로 필터하면 됨.
> 베이스: 최신 `main`. 분기 `feature/favorites`. 대상: `lib/favorites`(신규 훅), `components/product/ProductCard.tsx`·`ProductListCard.tsx`·`app/p/[slug]/page.tsx`(하트), `app/wishlist/page.tsx`(신규), `components/layout/BottomTabBar.tsx`.

## 1. 저장소·훅
- `useFavorites()` 훅: localStorage 키 `viewtypick:favorites` = **slug 배열**(추가 순서 보존 → 최근 추가가 위로).
- API: `isFavorite(slug)`, `toggle(slug)`, `favorites: string[]`. 상태는 React state로 동기화.
- **SSR 안전**: 마운트 후 `useEffect`에서 localStorage 읽기(초기 렌더는 비어있는 기준 → hydration mismatch 방지, 마운트 플래그 사용). storage 이벤트로 탭 간 동기화(선택).

## 2. 하트 토글(클라이언트 컴포넌트)
- `FavoriteButton({slug})`: 비활성=outline 하트, 활성=채워진 하트. 클릭 시 `toggle` + `e.stopPropagation()/preventDefault()`(카드 링크 이동 방지). `aria-label`("관심상품 추가/해제").
- ProductCard·ProductListCard 우상단, 상세 페이지 제목 옆에 배치.
- 마운트 전(초기)엔 outline로 렌더 후 마운트되면 실제 상태 반영.

## 3. /wishlist 페이지
- 서버 컴포넌트가 `getProducts()`(노출 가능 제품) 전체를 받아 클라이언트 `<WishlistClient products=... />`에 전달.
- 클라이언트가 localStorage 즐겨찾기 slug로 **필터**해 카드 렌더(현재 가격·이미지·점수 그대로). 추가 순서 역순(최근 먼저).
- 즐겨찾기 중 **현재 노출 불가(링크 없어 숨김)된 제품은 제외**. 존재하지 않는 slug도 스킵.
- **빈 상태**: "관심상품이 없어요" + 둘러보기(홈/카테고리) CTA.
- `activeTab="wishlist"`.

## 4. BottomTabBar
- 관심상품 탭의 `handleUnderConstruction`·`opacity-60` **제거** → 실제 `/wishlist` 링크.

## 테스트
- 하트 클릭 → localStorage에 slug 추가/제거, 카드 링크 이동 안 됨(stopPropagation), 새로고침 후 유지.
- /wishlist가 즐겨찾기 제품만, 최근 추가 순. 빈 상태 안내.
- 숨김/없는 slug 안전 스킵. hydration 경고 없음.
- 관심상품 탭이 alert 없이 /wishlist 이동. `test:all`·typecheck·build·lint green.

## 적용
- `feature/favorites`: `feat(web): localStorage favorites — heart toggle + /wishlist`, `test`, `docs: worklog`. 영어 PR → CI → merge → `cf:deploy` → 라이브 하트·위시리스트 확인. (데이터 변경 아님 → sync 불필요.)

## 막히면
- hydration 이슈는 "마운트 전 항상 outline, useEffect 후 실제 상태" 패턴으로. 위시리스트 데이터는 전체 제품 임베드 후 클라 필터(별도 API 불필요).
