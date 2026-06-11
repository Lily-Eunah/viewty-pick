너는 시니어 프론트엔드 엔지니어이자 UI 디자이너야.
첨부한 ViewtyPick 모바일 UI 시안을 기준으로 실제 동작 가능한 웹서비스 MVP를 구현해줘.

이번 작업은 반드시 **Git 브랜치 전략과 의미 단위 커밋**을 지켜서 진행해줘.

---

# 0. 작업 전 Git 상태 확인

먼저 현재 프로젝트 상태를 확인해줘.

```bash
git status
git branch --show-current
git log --oneline -5
```

작업 전 `git status`가 clean인지 확인해줘.

만약 변경 중인 파일이 이미 있다면, 절대 덮어쓰지 말고 먼저 어떤 파일이 변경되어 있는지 보고해줘.
사용자 변경사항으로 보이는 파일은 건드리지 마.

---

# 1. 브랜치 생성

현재 브랜치가 `main` 또는 기존 작업 브랜치라면 아래 새 브랜치를 만들어서 작업해줘.

```bash
git checkout -b feature/viewtypick-mobile-ui-mvp
```

이미 같은 브랜치가 있으면 해당 브랜치로 이동해줘.

```bash
git checkout feature/viewtypick-mobile-ui-mvp
```

브랜치 생성/이동 후 다시 확인해줘.

```bash
git branch --show-current
```

---

# 2. 프로젝트 개요

서비스명은 **ViewtyPick / 뷰티픽**이야.

ViewtyPick은 단순 가격비교 사이트가 아니라,

**“믿고 살 수 있는 화장품 큐레이션 + 최저가 비교”**

를 핵심 가치로 하는 모바일 퍼스트 뷰티 가격비교 서비스야.

사용자는 디렉터파이 추천 제품, 화해 랭킹, 올리브영 베스트셀러 같은 신뢰 가능한 추천 출처를 기반으로 제품을 탐색하고, 여러 판매처의 가격을 비교한 뒤 최저가로 구매할 수 있어야 해.

MVP에서는 우선 **디렉터파이 추천 제품**만 제공해도 돼.

---

# 3. 구현 목표

첨부된 모바일 UI 시안과 최대한 비슷하게 아래 화면들을 구현해줘.

1. 홈
2. 카테고리 목록
3. 제품 상세
4. 검색
5. 관심상품
6. SEO 랜딩 페이지
7. 공통 컴포넌트 / 디자인 시스템

우선 실제 API 연동 없이 **mock data 기반**으로 구현해줘.
하지만 추후 API 연동이 쉽도록 데이터 구조와 컴포넌트 구조는 깔끔하게 분리해줘.

---

# 4. 기술 스택

아래 스택으로 구현해줘. (DESIGN.md·IMPLEMENTATION.md 확정 스택)

* Next.js (App Router)
* TypeScript
* Tailwind CSS
* 서버 컴포넌트 / SSG·ISR 기반 (SEO 우선 — 크롤러가 완성된 HTML 수신)
* 모바일 퍼스트 반응형 UI
* 컴포넌트 기반 구조

라우팅은 **Next.js App Router 파일 기반**으로 구성하고, 경로는 DESIGN.md §9 / IMPLEMENTATION.md §5.3 매핑표를 따른다.

```txt
app/page.tsx                      → /                         홈
app/c/[category]/page.tsx         → /c/[category]             카테고리 목록
app/p/[slug]/page.tsx             → /p/[slug]                 제품 상세
app/pick/[badge]/[category]/...   → /pick/[badge]/[category]  SEO 랜딩 (큐레이션)
app/skin/[type]/[category]/...    → /skin/[type]/[category]   SEO 랜딩 (피부 고민)

(준비 중 · Phase 5 — 탭바에 비활성 노출, 라우트 미연결)
/search      검색
/wishlist    관심상품
```

---

# 5. 디자인 방향

전체 느낌은 **무신사 뷰티 스타일의 미니멀하고 세련된 모바일 커머스 UI**에 가깝게 만들어줘.

단, 무신사 로고나 실제 화면을 복제하면 안 되고, ViewtyPick만의 오리지널 UI로 구현해줘.

## 지향할 느낌

* 모바일 앱 같은 웹 UI
* 깔끔한 흰색 카드
* 넉넉한 여백
* 큐레이션 중심
* 가격비교는 있지만 복잡하지 않게
* 신뢰감 있는 세이지그린 톤
* 할인 쇼핑몰처럼 과한 노란색 사용 금지
* 제품 이미지가 돋보이는 구조
* 하단 탭바가 있는 모바일 앱형 구조

---

# 6. 컬러 시스템

아래 컬러를 Tailwind theme 또는 CSS variables로 정의해서 사용해줘.

```css
:root {
  --primary: #6B8A47;
  --primary-dark: #4F6A34;
  --primary-light: #EDF3E6;

  --accent: #F6C915;
  --accent-light: #FFF6CF;

  --background: #F8F6EE;
  --background-warm: #EAE3C0;
  --surface: #FFFFFF;

  --price: #E05D44;
  --price-bg: #FFF0EA;

  --title: #1F241A;
  --body: #4A4A42;
  --sub: #8A8778;
  --border: #E4E0D2;
}
```

## 색상 사용 규칙

* `#6B8A47`: 브랜드, 선택 상태, 활성 탭, 필터 선택
* `#4F6A34`: 주요 CTA 버튼, 구매 버튼
* `#EDF3E6`: 추천 이유 박스, 신뢰 배지 배경
* `#F6C915`: 오늘의 최저가, 랭킹, 가격 혜택 강조
* `#FFF6CF`: 최저가 배지 배경
* `#EAE3C0`: Hero 배너, SEO 상단 배경
* `#F8F6EE`: 전체 페이지 배경
* `#FFFFFF`: 제품 카드, 상세 카드, 가격 비교 카드
* `#E05D44`: 최저가 가격, 가격 하락 표시

---

# 7. 공통 레이아웃

전체 앱은 모바일 기준으로 만들어줘.

```txt
max-width: 430px;
min-height: 100vh;
margin: 0 auto;
background: #F8F6EE;
```

데스크톱에서는 모바일 앱 프레임처럼 중앙 정렬되게 해줘.

모든 주요 페이지에는 하단 탭바가 있어야 해.

하단 탭바 메뉴:

```txt
홈
카테고리
검색
관심상품
마이
```

활성 탭은 primary 컬러로 표시해줘.

---

# 8. 화면별 구현 요구사항

## 8.1 홈

구성:

1. 상단 브랜드 헤더
2. 검색창
3. Hero 배너
4. 피부 타입 선택 칩
5. 인기 카테고리 grid
6. 디렉터파이 추천 TOP 10 가로 스크롤
7. 오늘 가격 좋은 제품 리스트

문구:

```txt
ViewtyPick
믿고 사는 뷰티 최저가
```

검색창 placeholder:

```txt
제품명, 피부타입, 카테고리 검색
```

검색창 클릭 시 `/search`로 이동.

Hero 배너:

```txt
디렉터파이 추천 선크림
최저가 한눈에 비교하기
민감성 피부도 참고하기 좋은 제품만 모았어요.
```

CTA:

```txt
추천 제품 보기
```

클릭 시 `/guide/directorpi-sunscreen`으로 이동.

피부 타입 칩:

```txt
민감성
지성
건성
수부지
복합성
여드름성
```

인기 카테고리:

```txt
선크림
토너
크림
세럼
클렌징
쿠션
```

각 카테고리 클릭 시 `/category/sunscreen` 같은 페이지로 이동.

---

## 8.2 카테고리 목록

예시 카테고리: 선크림

상단 문구:

```txt
선크림
민감한 피부도 안심하고 사용할 수 있는 디렉터파이 추천 선크림
```

필터 칩:

```txt
민감성
지성
건성
수부지
```

정렬 칩:

```txt
추천순
최저가순
가격하락순
인기순
```

제품 리스트는 모바일에서 보기 좋은 리스트형 카드로 구현해줘.

제품 카드 정보:

* 제품 이미지
* 추천 배지
* 브랜드명
* 제품명
* 피부 타입/특징
* 최저가
* 가격 하락 정보
* 관심상품 저장 아이콘

---

## 8.3 제품 상세

이 화면이 가장 중요해. 구매 전환 중심으로 구현해줘.

구성:

1. 상단 뒤로가기 / 공유 / 관심상품 아이콘
2. 큰 제품 이미지 영역
3. 추천 배지
4. 제품명
5. 용량 / SPF 등 간단 정보
6. 최저가
7. 가격 하락 배지
8. 하단 sticky CTA 버튼
9. 추천 이유 박스
10. 가격 비교 카드
11. 함께 비교하는 제품

제품명 예시:

```txt
라운드랩 자작나무 수분 선크림
```

가격 영역:

```txt
최저가
9,900원
어제보다 2,100원 저렴
```

가격은 `#E05D44`로 강하게 표시해줘.

하단 sticky CTA:

```txt
9,900원에 구매하기
```

배경은 `#4F6A34`, 텍스트는 흰색.

추천 이유 박스:

```txt
왜 추천되었나요?

✓ 민감성 피부 추천
✓ 성분 구성 우수
✓ 백탁 적음
✓ 디렉터파이 언급
```

가격 비교 카드:

```txt
쿠팡
9,900원
오늘의 최저가
구매하기

올리브영
11,900원
구매하기

컬리
12,900원
구매하기

11번가
13,500원
구매하기
```

최저가 판매처는 accent 컬러로 강조해줘.

---

## 8.4 검색

> **MVP 제외 · Phase 5.** 탭바에 "준비 중" 비활성으로만 노출한다(라우트 미연결). 아래는 Phase 5 구현 시 참고 스펙이며, MVP에서는 컴포넌트만 작성해 둔다.

구성:

1. 검색 입력창
2. 인기 검색어
3. 추천 검색 조합
4. 최근 본 제품
5. 검색 결과

인기 검색어:

```txt
민감성 선크림
지성 토너
수부지 크림
진정 세럼
비타민C 세럼
클렌징 오일
```

추천 검색 조합:

```txt
민감성 + 선크림
지성 + 토너
건성 + 크림
수부지 + 세럼
여드름성 + 진정
복합성 + 수분
```

검색어 입력 시 mock data에서 제품명, 브랜드명, 카테고리, 피부 타입을 기준으로 필터링되게 만들어줘.

---

## 8.5 관심상품

> **MVP 제외 · Phase 5.** 탭바에 "준비 중" 비활성으로만 노출한다(라우트 미연결). 아래는 Phase 5 구현 시 참고 스펙이며, MVP에서는 컴포넌트만 작성해 둔다.

구성:

```txt
관심상품
총 6개의 상품
가격 변동 알림 설정
```

관심상품 카드는 제품 리스트형으로 보여줘.

각 카드에는 아래 정보를 표시해줘.

* 제품 이미지
* 브랜드명
* 제품명
* 현재 최저가
* 가격 하락 정보
* 추천 배지
* 북마크 아이콘

가격 하락 예시:

```txt
▼ 2,100원 (18%)
```

관심상품이 없을 때의 empty state도 만들어줘.

```txt
아직 관심상품이 없어요
마음에 드는 제품을 저장하면 최저가를 쉽게 확인할 수 있어요.
추천 제품 보러가기
```

---

## 8.6 SEO 랜딩 페이지

라우트:

```txt
/guide/directorpi-sunscreen
```

페이지 제목:

```txt
2026 디렉터파이 추천 선크림 TOP 10 최저가 비교
```

설명:

```txt
디렉터파이가 추천한 선크림 중 민감성 피부도 참고하기 좋은 제품을 모아 최저가 기준으로 비교했어요.
```

구성:

1. SEO Hero
2. TOP 10 제품 리스트
3. 민감성 피부 추천 제품
4. 가격 비교 기준 설명
5. FAQ
6. 관련 카테고리 링크

FAQ 예시:

```txt
Q. 디렉터파이 추천 선크림은 어떤 기준인가요?
A. 성분, 사용감, 피부 타입 적합성 등을 기준으로 추천된 제품을 참고합니다.

Q. 최저가는 실시간으로 변동되나요?
A. 판매처 가격은 변동될 수 있으므로 구매 전 최종 가격을 확인해야 합니다.

Q. 민감성 피부도 사용할 수 있나요?
A. 제품별 추천 이유와 성분 정보를 함께 확인하는 것이 좋습니다.
```

---

# 9. Mock Data

`src/data/products.ts`를 만들어서 아래와 비슷한 구조로 mock data를 구성해줘.

```ts
export type Product = {
  id: string;
  slug: string;
  brand: string;
  name: string;
  category: string;
  image: string;
  volume: string;
  description: string;
  skinTypes: string[];
  tags: string[];
  badges: string[];
  lowestPrice: number;
  previousPrice?: number;
  priceDropAmount?: number;
  priceDropRate?: number;
  source: 'directorpi' | 'hwahae' | 'oliveyoung';
  reasonItems: string[];
  stores: {
    name: string;
    price: number;
    url: string;
    isBest?: boolean;
  }[];
};
```

제품은 최소 12개 정도 만들어줘.

제품 예시:

* 라운드랩 자작나무 수분 선크림
* 아누아 어성초 77 토너
* 토리든 다이브인 세럼
* 닥터지 레드 블레미쉬 클리어 수딩 크림
* 이니스프리 트루케어 무기자차 선스크린
* 넘버즈인 3번 결광가득 에센스 토너
* 에스트라 아토베리어365 크림
* 비플레인 녹두 약산성 클렌징폼
* 아이소이 잡티 세럼
* 브링그린 티트리 시카 수딩 크림
* 라네즈 네오 쿠션
* 클리오 킬커버 파운데이션

이미지는 실제 외부 이미지를 무단 사용하지 말고, 우선 placeholder 이미지나 단순한 제품 이미지 영역으로 처리해줘. 가능하면 CSS로 미니멀한 제품 박스/튜브 느낌의 placeholder를 만들어줘.

---

# 10. 컴포넌트 구조

> 폴더 레이아웃은 **Next.js App Router 기준(IMPLEMENTATION.md §2)**을 따른다. 라우트는 `src/pages/*` + React Router가 아니라 `app/**/page.tsx` 파일 기반이며, 아래의 `pages/*` 컴포넌트는 각 `app/.../page.tsx`로 대응한다. 공통/제품 컴포넌트는 `components/`(루트), mock·타입·유틸은 `lib/`로 둔다. 아래는 컴포넌트 인벤토리 참고용이다.

```txt
app/                              # 라우트 (page.tsx) — IMPLEMENTATION.md §2·§5.3
components/
    layout/
      AppShell.tsx
      BottomTabBar.tsx
      Header.tsx
    common/
      SearchBar.tsx
      Badge.tsx
      Chip.tsx
      Button.tsx
      PriceText.tsx
    product/
      ProductCard.tsx
      ProductListCard.tsx
      ProductCarousel.tsx
      StorePriceCard.tsx
      RecommendationReasonBox.tsx
  pages/   (→ 각 app/.../page.tsx 로 구현)
    HomePage.tsx            → app/page.tsx
    CategoryPage.tsx        → app/c/[category]/page.tsx
    ProductDetailPage.tsx   → app/p/[slug]/page.tsx
    GuidePage.tsx           → app/pick/[badge]/[category]/page.tsx, app/skin/[type]/[category]/page.tsx
    SearchPage.tsx          → (Phase 5 · 라우트 미연결, 컴포넌트만 작성)
    WishlistPage.tsx        → (Phase 5 · 라우트 미연결, 컴포넌트만 작성)
lib/
  data/ (products.ts, categories.ts)   # mock → Supabase 교체(IMPLEMENTATION.md §5.5)
  styles/ globals.css
```

---

# 11. UX 디테일

아래 UX를 반영해줘.

* 모든 카드는 rounded-2xl 이상으로 부드럽게
* 카드에는 약한 border와 soft shadow 적용
* 제품 이미지는 1:1 비율 유지
* 가격은 항상 눈에 잘 띄게
* “디렉터파이 추천” 배지는 green pill로 표시
* “오늘의 최저가” 배지는 yellow pill로 표시
* 가격 하락은 coral/red 계열로 표시
* 하단 탭바는 fixed
* 상세 페이지 CTA도 fixed
* 스크롤 시 CTA가 항상 보이도록
* 모바일에서 좌우 padding은 16px 기준
* max-width 430px 기준 중앙 정렬
* desktop에서는 모바일 앱 프레임처럼 중앙에 보이게

---

# 12. 작업 단계와 의미 단위 커밋 규칙

작업은 한 번에 크게 커밋하지 말고, 아래 의미 단위로 나누어 진행해줘.

각 단계마다 다음 순서를 지켜줘.

1. 해당 단계 구현
2. `npm run lint`, `npm run typecheck`, `npm run build` 중 가능한 검증 실행
3. 실패 시 수정
4. `git status` 확인
5. 의미 단위 commit 생성
6. 다음 단계 진행

만약 `lint`, `typecheck`, `build` 스크립트가 없다면 가능한 대체 명령을 사용하고, 없는 스크립트는 보고해줘.

---

## Commit 1. 프로젝트 기반 설정

작업 내용:

* 필요한 패키지 설치
* Next.js App Router 라우팅 설정
* Tailwind / CSS variables 설정
* global style 정리
* 앱 기본 레이아웃 준비

예상 커밋 메시지:

```bash
git add .
git commit -m "chore: set up ViewtyPick mobile UI foundation"
```

---

## Commit 2. Mock data와 타입 정의

작업 내용:

* 제품 타입 정의
* mock products 생성
* categories 데이터 생성
* 가격 포맷 유틸이 필요하면 추가

예상 커밋 메시지:

```bash
git add .
git commit -m "feat: add mock beauty product data"
```

---

## Commit 3. 공통 UI 컴포넌트 구현

작업 내용:

* Button
* Badge
* Chip
* SearchBar
* PriceText
* ProductImagePlaceholder
* StorePriceCard
* RecommendationReasonBox

예상 커밋 메시지:

```bash
git add .
git commit -m "feat: build shared ViewtyPick UI components"
```

---

## Commit 4. 앱 셸과 하단 탭바 구현

작업 내용:

* AppShell
* BottomTabBar
* 모바일 max-width 레이아웃
* 활성 탭 표시
* 라우팅 기본 연결

예상 커밋 메시지:

```bash
git add .
git commit -m "feat: add mobile app shell and bottom navigation"
```

---

## Commit 5. 홈 화면 구현

작업 내용:

* 브랜드 헤더
* 검색창
* Hero 배너
* 피부 타입 칩
* 인기 카테고리 grid
* 추천 TOP 10 가로 스크롤
* 오늘 가격 좋은 제품 섹션

예상 커밋 메시지:

```bash
git add .
git commit -m "feat: implement ViewtyPick home screen"
```

---

## Commit 6. 카테고리 목록 구현

작업 내용:

* `/category/:categorySlug`
* 카테고리 헤더
* 피부 타입 필터
* 정렬 칩
* 제품 리스트 카드
* category별 mock filtering

예상 커밋 메시지:

```bash
git add .
git commit -m "feat: implement category product listing"
```

---

## Commit 7. 제품 상세 구현

작업 내용:

* `/product/:productSlug`
* 상세 상단
* 제품 이미지
* 최저가 영역
* 추천 이유 박스
* 가격 비교 카드
* 함께 비교하는 제품
* 하단 sticky CTA

예상 커밋 메시지:

```bash
git add .
git commit -m "feat: implement product detail purchase flow"
```

---

## Commit 8. 검색 화면 구현

작업 내용:

* `/search`
* 검색 입력
* 인기 검색어
* 추천 검색 조합
* 최근 본 제품
* mock data 기반 검색 결과 필터링

예상 커밋 메시지:

```bash
git add .
git commit -m "feat: implement product search experience"
```

---

## Commit 9. 관심상품 화면 구현

작업 내용:

* `/wishlist`
* 관심상품 리스트
* 가격 변동 알림 토글 UI
* 관심상품 empty state
* mock wishlist 상태

예상 커밋 메시지:

```bash
git add .
git commit -m "feat: implement wishlist price tracking screen"
```

---

## Commit 10. SEO 랜딩 페이지 구현

작업 내용:

* `/guide/:guideSlug`
* SEO Hero
* TOP 10 제품 리스트
* 민감성 추천 제품
* 가격 비교 기준 설명
* FAQ
* 관련 카테고리 링크

예상 커밋 메시지:

```bash
git add .
git commit -m "feat: add directorpi sunscreen guide page"
```

---

## Commit 11. UI polish와 최종 정리

작업 내용:

* spacing 정리
* mobile viewport QA
* desktop 중앙 프레임 정리
* hover / active 상태 정리
* 빈 링크 / mock URL 정리
* 접근성 기본 속성 보완
* 최종 lint / typecheck / build

예상 커밋 메시지:

```bash
git add .
git commit -m "refactor: polish ViewtyPick mobile UI"
```

---

# 13. 커밋 전 체크리스트

각 커밋 전 반드시 확인해줘.

```bash
git diff --stat
git diff
npm run lint
npm run typecheck
npm run build
git status
```

단, 너무 큰 diff일 경우 핵심 변경 파일 중심으로 검토해줘.

커밋 메시지는 Conventional Commits 스타일을 사용해줘.

허용 예시:

```txt
feat: implement product detail purchase flow
feat: add mock beauty product data
chore: set up ViewtyPick mobile UI foundation
refactor: polish ViewtyPick mobile UI
fix: resolve mobile tab bar spacing
```

---

# 14. Git 작업 시 주의사항

* 절대 `main` 브랜치에 직접 커밋하지 마.
* 사용자 변경사항이 있는 파일은 덮어쓰지 마.
* `git reset --hard` 사용하지 마.
* `git clean -fd` 사용하지 마.
* 강제 push 하지 마.
* 원격 push는 사용자가 요청하기 전까지 하지 마.
* 커밋은 의미 단위로 나누고, 한 커밋에 너무 많은 화면을 몰아넣지 마.
* 검증 실패 상태로 커밋하지 마.
* 불가피하게 검증 실패가 남으면 커밋하지 말고 원인과 현재 상태를 보고해줘.

---

# 15. 최종 검증

모든 구현이 끝나면 아래 명령을 실행해줘.

```bash
npm run lint
npm run typecheck
npm run build
git status
git log --oneline -12
```

최종 상태는 working tree clean이어야 해.

---

# 16. 최종 보고 형식

작업 완료 후 아래 형식으로 보고해줘.

```txt
## 작업 완료 보고

### 브랜치
feature/viewtypick-mobile-ui-mvp

### 구현한 화면
- 홈
- 카테고리 목록
- 제품 상세
- 검색
- 관심상품
- SEO 랜딩 페이지

### 생성/수정한 주요 파일
- src/data/products.ts
- src/data/categories.ts
- src/components/...
- src/pages/...

### 커밋 목록
- <commit hash> chore: set up ViewtyPick mobile UI foundation
- <commit hash> feat: add mock beauty product data
- <commit hash> feat: build shared ViewtyPick UI components
- ...

### 검증 결과
- npm run lint: pass
- npm run typecheck: pass
- npm run build: pass

### Mock 처리된 부분
- 실제 상품 이미지
- 실제 가격 API
- 실제 구매 링크
- 실제 관심상품 저장 API
- 실제 가격 변동 알림

### 다음 단계 제안
1. 실제 상품 이미지/가격 데이터 연동
2. 어필리에이트 링크 구조 설계
3. SEO 메타 태그 및 sitemap 생성
4. 가격 변동 이력 저장 구조 설계
5. 관심상품 로그인 연동
```

---

# 17. 작업 범위 조절

한 번에 모든 화면을 구현하기 어렵거나 diff가 너무 커질 것 같으면, 아래 기준으로 1차 작업만 먼저 진행해줘.

## 1차 작업 범위

1. 브랜치 생성
2. 디자인 시스템
3. mock data
4. 공통 컴포넌트
5. AppShell / BottomTabBar
6. 홈 화면
7. 카테고리 목록
8. 제품 상세

1차 작업만 진행하는 경우에도 반드시 의미 단위 커밋을 남기고, 검증 결과를 보고해줘.

이후 나머지 검색 / 관심상품 / SEO 랜딩은 다음 작업으로 이어갈 수 있게 구조를 정리해줘.
