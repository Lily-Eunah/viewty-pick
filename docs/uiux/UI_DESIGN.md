# ViewtyPick UI Design

## 디자인 콘셉트

> **믿을 수 있는 추천 제품을 보고, 가장 싸게 사는 뷰티 큐레이션 앱**

기존 가격비교 사이트처럼 숫자와 판매처가 빽빽한 화면보다는,
**제품 추천 → 신뢰 근거 확인 → 최저가 비교 → 구매 이동** 흐름이 자연스럽게 이어져야 해.

---

# 1. 최종 컬러 시스템

## 메인 팔레트

| 역할              |        컬러 | 사용처                   |
| --------------- | --------: | --------------------- |
| Primary         | `#6B8A47` | 브랜드, 선택 상태, 주요 CTA    |
| Primary Dark    | `#4F6A34` | 구매 버튼, 강조 버튼          |
| Primary Light   | `#EDF3E6` | 추천 이유 박스, 선택 전 칩 배경   |
| Accent          | `#F6C915` | TOP, 최저가, 가격 혜택 배지    |
| Accent Light    | `#FFF6CF` | 랭킹/혜택 배지 배경           |
| Warm Background | `#EAE3C0` | Hero, SEO 상단, 큐레이션 섹션 |
| Page Background | `#F8F6EE` | 전체 앱 배경               |
| Surface         | `#FFFFFF` | 카드, 상품 영역             |
| Price           | `#E05D44` | 최저가 가격                |
| Title           | `#1F241A` | 제목                    |
| Body            | `#4A4A42` | 본문                    |
| Sub Text        | `#8A8778` | 보조 텍스트                |
| Border          | `#E4E0D2` | 카드 라인, 구분선            |

---

## CSS 변수

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

---

# 2. 전체 UI 방향

## 피해야 할 느낌

* 다나와, 에누리처럼 표와 가격이 빽빽한 느낌
* 노란색이 많은 할인 쇼핑몰 느낌
* 베이지 배경이 과해서 오래된 건강식품몰처럼 보이는 느낌
* 판매처 리스트만 강조되어 “추천 서비스” 정체성이 약해지는 느낌

## 지향할 느낌

* 올리브영처럼 깔끔한 상품 탐색
* 오늘의집처럼 부드러운 카드형 큐레이션
* 무신사 뷰티처럼 모바일 중심의 정돈된 제품 리스트
* “이 제품은 왜 추천됐는지”가 먼저 보이는 구조

---

# 3. 모바일 기본 레이아웃

## 화면 기준

```text
모바일 기준: 360px ~ 430px
기본 좌우 패딩: 16px
카드 라운드: 18px ~ 24px
버튼 라운드: 14px ~ 16px
하단 탭바 높이: 64px ~ 72px
```

## 전체 구조

```text
┌────────────────────┐
│ Header             │
│ Search             │
│ Main Content       │
│                    │
│                    │
├────────────────────┤
│ Bottom Tab Bar     │
└────────────────────┘
```

## 하단 탭바

```text
홈      카테고리      검색      관심상품      마이
```

활성 탭은 `#6B8A47`, 비활성 탭은 `#AAA697`.

---

# 4. 홈 화면 redesign

홈은 모든 기능을 보여주는 곳이 아니라,
**“검증된 추천 제품을 최저가로 볼 수 있다”는 인상을 주는 곳**이어야 해.

## 홈 화면 구조

```text
┌────────────────────────┐
│ ViewtyPick        ♡    │
│ 믿고 사는 뷰티 최저가   │
├────────────────────────┤
│ 🔍 어떤 화장품을 찾나요? │
├────────────────────────┤
│ Hero Banner             │
│ 디렉터파이 추천 선크림   │
│ 최저가 한눈에 비교하기   │
│ [추천 제품 보기]         │
├────────────────────────┤
│ 내 피부 타입으로 찾기    │
│ 민감성 지성 건성 수부지  │
├────────────────────────┤
│ 인기 카테고리            │
│ 선크림 토너 크림 세럼    │
│ 클렌징 쿠션 로션 앰플    │
├────────────────────────┤
│ 디렉터파이 추천 TOP 10   │
│ 가로 스크롤 제품 카드    │
├────────────────────────┤
│ 오늘 가격 좋은 제품      │
│ 세로 제품 리스트         │
└────────────────────────┘
```

---

## 홈 Header

```text
ViewtyPick
믿고 사는 뷰티 최저가
```

### 스타일

```css
.home-header {
  padding: 20px 16px 12px;
  background: var(--background);
}

.logo {
  color: var(--primary-dark);
  font-size: 22px;
  font-weight: 800;
}

.tagline {
  color: var(--sub);
  font-size: 13px;
}
```

---

## 검색창

검색창은 홈 상단에서 크게 보여줘야 해.

```text
🔍 제품명, 피부타입, 카테고리 검색
```

```css
.search-bar {
  height: 48px;
  background: #FFFFFF;
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 0 16px;
  color: var(--sub);
}
```

---

## Hero Banner

Hero는 `#EAE3C0`을 가장 잘 쓸 수 있는 영역이야.

```text
디렉터파이 추천 선크림
최저가 한눈에 비교하기

민감성 피부도 참고하기 좋은 제품만 모았어요.

[보러가기]
```

### 스타일

```css
.hero-card {
  background: var(--background-warm);
  border-radius: 24px;
  padding: 20px;
}

.hero-title {
  color: var(--title);
  font-size: 22px;
  font-weight: 800;
}

.hero-button {
  background: var(--primary-dark);
  color: #FFFFFF;
  border-radius: 14px;
}
```

---

## 피부 타입 칩

```text
민감성  지성  건성  수부지  복합성  여드름성
```

선택 전:

```css
.skin-chip {
  background: #FFFFFF;
  color: var(--body);
  border: 1px solid var(--border);
}
```

선택 후:

```css
.skin-chip.active {
  background: var(--primary);
  color: #FFFFFF;
  border: none;
}
```

---

## 인기 카테고리

카테고리는 2열 카드가 좋아.

```text
┌─────────┐ ┌─────────┐
│ ☀️ 선크림 │ │ 💧 토너  │
└─────────┘ └─────────┘
┌─────────┐ ┌─────────┐
│ 🧴 크림  │ │ ✨ 세럼  │
└─────────┘ └─────────┘
```

```css
.category-card {
  background: #FFFFFF;
  border-radius: 18px;
  padding: 18px 16px;
  border: 1px solid var(--border);
}
```

---

# 5. 제품 카드 redesign

제품 카드는 이 서비스의 핵심 컴포넌트야.
카드 안에서 가장 먼저 보여야 하는 건 **이미지 → 추천 근거 → 최저가** 순서야.

## 기본 제품 카드

```text
┌────────────────────┐
│ 제품 이미지          │
│                    │
├────────────────────┤
│ [디렉터파이 추천]    │
│ 라운드랩 자작나무    │
│ 수분 선크림          │
│                    │
│ 최저가              │
│ 9,900원             │
│                    │
│ [가격비교 보기]      │
└────────────────────┘
```

## 카드 스타일

```css
.product-card {
  background: #FFFFFF;
  border-radius: 20px;
  border: 1px solid var(--border);
  overflow: hidden;
}

.product-image {
  background: #F5F3EA;
  aspect-ratio: 1 / 1;
}

.product-title {
  color: var(--title);
  font-size: 15px;
  font-weight: 700;
}

.product-price {
  color: var(--price);
  font-size: 20px;
  font-weight: 800;
}
```

---

## 추천 뱃지

```text
디렉터파이 추천
```

```css
.badge-directorpi {
  background: var(--primary-light);
  color: var(--primary-dark);
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 700;
}
```

---

## 최저가 뱃지

```text
오늘의 최저가
```

```css
.badge-best-price {
  background: var(--accent-light);
  color: #7A5B00;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 700;
}
```

---

# 6. 카테고리 페이지 redesign

카테고리 페이지는 검색 유입 후 실제 탐색이 일어나는 화면이야.
여기서는 **필터와 제품 리스트의 가독성**이 중요해.

## 선크림 카테고리 예시

```text
┌────────────────────────┐
│ ← 선크림                │
│ 디렉터파이 추천 제품 기준 │
├────────────────────────┤
│ 민감성 지성 건성 수부지  │
├────────────────────────┤
│ 추천순  최저가순  인기순 │
├────────────────────────┤
│ [제품 카드]             │
│ [제품 카드]             │
│ [제품 카드]             │
└────────────────────────┘
```

---

## 상단 카테고리 헤더

```text
선크림
디렉터파이 추천 제품을 최저가 기준으로 비교해보세요.
```

```css
.category-header {
  background: var(--background);
  padding: 20px 16px 12px;
}

.category-title {
  color: var(--title);
  font-size: 24px;
  font-weight: 800;
}
```

---

## 정렬 필터

```text
추천순  최저가순  가격하락순  인기순
```

선택된 정렬은 노란색이 아니라 세이지그린으로 처리하는 게 좋아.

```css
.sort-chip.active {
  background: var(--primary-light);
  color: var(--primary-dark);
  font-weight: 700;
}
```

---

## 리스트형 제품 카드

카테고리 페이지에서는 세로형보다 **리스트형 카드**가 더 효율적이야.

```text
┌────────────────────────┐
│ [이미지] 라운드랩 선크림 │
│        [디렉터파이 추천] │
│        민감성 · 수분진정 │
│        최저가 9,900원   │
│        쿠팡 / 올리브영 비교 │
└────────────────────────┘
```

```css
.product-list-card {
  display: flex;
  gap: 14px;
  background: #FFFFFF;
  border-radius: 18px;
  padding: 12px;
  border: 1px solid var(--border);
}
```

---

# 7. 제품 상세 페이지 redesign

제품 상세는 가장 중요해.
여기서 목표는 단순히 정보 제공이 아니라 **구매 전환**이야.

## 상세 페이지 구조

```text
┌────────────────────────┐
│ ← 제품 상세        ♡    │
├────────────────────────┤
│ 제품 이미지              │
├────────────────────────┤
│ [디렉터파이 추천]        │
│ 라운드랩 자작나무 선크림 │
│ 50ml                    │
│                         │
│ 최저가                  │
│ 9,900원                 │
│ 어제보다 2,100원 저렴    │
├────────────────────────┤
│ [최저가 구매하기]        │
├────────────────────────┤
│ 왜 추천되었나요?         │
│ ✔ 민감성 피부 추천       │
│ ✔ 성분 구성 우수         │
│ ✔ 백탁 적음              │
│ ✔ 디렉터파이 언급        │
├────────────────────────┤
│ 가격 비교               │
│ 쿠팡      9,900원 구매   │
│ 올리브영  11,000원 구매  │
│ 컬리      11,500원 구매  │
├────────────────────────┤
│ 제품 정보               │
│ 브랜드 / 용량 / 피부타입 │
├────────────────────────┤
│ 함께 비교하는 제품       │
└────────────────────────┘
```

---

## 상세 상단

제품 상세 상단은 배경을 너무 컬러풀하게 하지 말고 흰색 중심으로 가는 게 좋아.

```css
.product-detail-hero {
  background: #FFFFFF;
  border-radius: 0 0 28px 28px;
  padding: 16px;
}
```

---

## 가격 영역

```text
최저가
9,900원
어제보다 2,100원 저렴
```

```css
.lowest-price {
  color: var(--price);
  font-size: 28px;
  font-weight: 900;
}

.price-drop {
  display: inline-flex;
  background: var(--price-bg);
  color: var(--price);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
}
```

---

## 구매 버튼

구매 버튼은 `#4F6A34`를 추천해.
`#6B8A47`보다 조금 더 진해서 CTA로 안정적이야.

```css
.buy-button {
  width: 100%;
  height: 54px;
  background: var(--primary-dark);
  color: #FFFFFF;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 800;
}
```

버튼 문구는 이게 좋아.

```text
최저가 구매하기
```

또는

```text
9,900원에 구매하기
```

전환율만 보면 두 번째가 더 강할 수 있어.

---

## 추천 이유 박스

이 서비스가 단순 가격비교와 달라지는 가장 중요한 영역이야.

```text
왜 추천되었나요?

✔ 디렉터파이 추천 제품
✔ 민감성 피부도 참고 가능
✔ 백탁 적은 사용감
✔ 성분 구성 우수
```

```css
.reason-box {
  background: var(--primary-light);
  border-radius: 20px;
  padding: 18px;
}

.reason-title {
  color: var(--primary-dark);
  font-weight: 800;
}
```

---

## 가격 비교 카드

표 형태보다 카드형이 모바일에서 더 좋아.

```text
┌────────────────────────┐
│ 🏆 쿠팡                 │
│ 9,900원                 │
│ 오늘의 최저가           │
│ [구매하기]              │
└────────────────────────┘

┌────────────────────────┐
│ 올리브영                │
│ 11,000원                │
│ [구매하기]              │
└────────────────────────┘
```

최저가 판매처만 노란색 배지를 붙여.

```css
.store-card.best {
  border: 1.5px solid var(--accent);
}

.store-badge {
  background: var(--accent-light);
  color: #7A5B00;
}
```

---

# 8. 검색 화면 redesign

검색은 단순 제품명 검색이 아니라
**피부 타입, 카테고리, 추천 출처 기반 검색**까지 유도해야 해.

## 검색 화면 구조

```text
┌────────────────────────┐
│ 🔍 검색어를 입력하세요   │
├────────────────────────┤
│ 인기 검색어              │
│ 선크림 토너 민감성 수부지 │
├────────────────────────┤
│ 추천 검색 조합           │
│ 민감성 선크림            │
│ 지성 토너                │
│ 수부지 크림              │
├────────────────────────┤
│ 최근 본 제품             │
└────────────────────────┘
```

추천 검색어는 SEO 키워드와도 연결되게 만들면 좋아.

---

# 9. 관심상품 화면 redesign

관심상품은 향후 가격 하락 알림 기능과 연결될 수 있어.

```text
┌────────────────────────┐
│ 관심상품                │
│ 저장한 제품의 최저가를 확인해요 │
├────────────────────────┤
│ [제품 카드]             │
│ 현재 최저가 9,900원      │
│ 어제보다 2,100원 저렴    │
├────────────────────────┤
│ [제품 카드]             │
└────────────────────────┘
```

빈 상태 화면은 이렇게.

```text
아직 관심상품이 없어요

마음에 드는 제품을 저장하면
최저가를 쉽게 확인할 수 있어요.

[추천 제품 보러가기]
```

배경에는 `#EAE3C0`보다 `#F8F6EE`를 쓰고, 버튼만 세이지그린으로 처리.

---

# 10. SEO 랜딩 페이지 redesign

SEO 페이지는 실제 유입이 많이 발생할 가능성이 높아.
특히 아래 페이지들이 중요해.

```text
/directorpi-sunscreen
/sensitive-sunscreen
/roundlab-birch-sunscreen-price
/oily-skin-toner
```

## SEO 랜딩 구조

```text
┌────────────────────────┐
│ 2026 디렉터파이 추천 선크림 │
│ 최저가 비교              │
│                         │
│ 검증된 추천 제품만 모아  │
│ 가격까지 비교했어요.     │
├────────────────────────┤
│ TOP 10 제품              │
│ [제품 리스트]            │
├────────────────────────┤
│ 민감성 피부 추천 제품     │
│ [제품 리스트]            │
├────────────────────────┤
│ 가격 비교 기준           │
│ 판매처 / 배송비 / 공식몰 │
├────────────────────────┤
│ FAQ                     │
└────────────────────────┘
```

SEO 페이지 상단은 `#EAE3C0`을 써도 좋아.

```css
.seo-hero {
  background: var(--background-warm);
  border-radius: 0 0 28px 28px;
  padding: 28px 16px;
}
```

---

# 11. 컴포넌트 시스템

## 1) Primary Button

```text
최저가 구매하기
```

```css
.button-primary {
  background: #4F6A34;
  color: #FFFFFF;
  height: 54px;
  border-radius: 16px;
  font-weight: 800;
}
```

---

## 2) Secondary Button

```text
가격비교 보기
```

```css
.button-secondary {
  background: #EDF3E6;
  color: #4F6A34;
  height: 46px;
  border-radius: 14px;
  font-weight: 700;
}
```

---

## 3) Accent Badge

```text
오늘의 최저가
```

```css
.badge-accent {
  background: #FFF6CF;
  color: #7A5B00;
  border-radius: 999px;
  padding: 5px 10px;
  font-weight: 700;
}
```

---

## 4) Price Text

```text
9,900원
```

```css
.price-text {
  color: #E05D44;
  font-size: 22px;
  font-weight: 900;
}
```

---

## 5) Trust Badge

```text
디렉터파이 추천
```

```css
.badge-trust {
  background: #EDF3E6;
  color: #4F6A34;
  border-radius: 999px;
  padding: 5px 10px;
  font-weight: 700;
}
```

---

# 12. 정보 우선순위

이 서비스에서 화면별 정보 우선순위는 이렇게 잡는 게 좋아.

## 제품 카드

```text
1. 제품 이미지
2. 추천 출처 뱃지
3. 제품명
4. 피부 타입/카테고리
5. 최저가
6. 가격비교 버튼
```

## 제품 상세

```text
1. 제품명
2. 추천 출처
3. 최저가
4. 최저가 구매 버튼
5. 추천 이유
6. 판매처별 가격 비교
7. 제품 정보
8. 외부 참고 링크
```

## SEO 랜딩

```text
1. 검색 키워드와 일치하는 제목
2. 신뢰 가능한 추천 기준
3. TOP 제품 목록
4. 가격 비교
5. FAQ
6. 관련 페이지 링크
```

---

# 13. 최종 화면 톤 예시

## 홈

```text
배경: #F8F6EE
Hero: #EAE3C0
카드: #FFFFFF
CTA: #4F6A34
가격: #E05D44
혜택 배지: #FFF6CF
```

## 카테고리

```text
배경: #F8F6EE
상단 필터: 흰색 + 선택 시 #6B8A47
제품 카드: #FFFFFF
가격: #E05D44
추천 뱃지: #EDF3E6
```

## 상세

```text
상단 제품 영역: #FFFFFF
구매 버튼: #4F6A34
추천 이유: #EDF3E6
가격 비교 카드: #FFFFFF
최저가 판매처 강조: #FFF6CF + #F6C915
```

---

# 14. MVP 기준 우선 제작 화면

개발 순서는 이렇게 가는 게 좋아.

| 우선순위 | 화면      | 이유          |
| ---: | ------- | ----------- |
|    1 | 제품 상세   | 구매 전환 핵심    |
|    2 | 카테고리 목록 | 제품 탐색 핵심    |
|    3 | SEO 랜딩  | 검색 유입 핵심    |
|    4 | 홈       | 브랜드 신뢰 형성   |
|    5 | 검색      | 사용성 강화      |
|    6 | 관심상품    | 추후 가격 알림 확장 |

---

# 15. 최종 디자인 방향 한 줄

**ViewtyPick은 “화장품 추천 콘텐츠를 보고 난 뒤, 진짜 믿을 수 있는 제품만 최저가로 확인하는 모바일 뷰티 큐레이션 서비스”처럼 보여야 해.**

그래서 전체 UI는
**세이지그린으로 신뢰감**,
**노란색으로 가격 혜택**,
**밝은 웜 배경으로 부드러운 뷰티 무드**,
**흰색 카드로 제품 집중도**를 만드는 방향이 가장 좋아.
