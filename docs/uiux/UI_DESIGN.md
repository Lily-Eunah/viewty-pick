# ViewtyDeal Color Palette ## 1. Core Brand Colors | 역할 | 색상 | HEX | 사용처 | | --------------------- | -------: | --------: | ------------------------- | | Primary / Wine | 딥 와인 | #410016 | 로고, 주요 CTA, 선택 상태, 가격 강조 | | Accent / Rose | 로즈 베이지 | #CA9BAA | 배너, 태그, 하이라이트 배경, 부드러운 강조 | | Secondary / Blue Gray | 뮤트 블루그레이 | #A4B4BE | 보조 아이콘, 서브 버튼, 정보 태그 | | Background / Ivory | 웜 아이보리 | #FBF7F1 | 전체 앱 배경 | | Surface | 크림 화이트 | #FFFDF9 | 카드, 입력창, 바텀시트 | | Surface Soft | 소프트 아이보리 | #F7EFE7 | 섹션 배경, 연한 카드 | | Border | 웜 베이지 라인 | #E8DDD5 | 카드/입력창/구분선 | | Text Primary | 차콜 | #29272A | 본문 주요 텍스트 | | Text Secondary | 그레이 브라운 | #6F6667 | 설명, 보조 정보 | | Text Muted | 라이트 그레이 | #A8A0A0 | 비활성, placeholder | --- # 2. Extended Tokens
css
:root {
  /* Brand */
  --color-primary: #410016;
  --color-primary-hover: #5A0824;
  --color-primary-soft: #F3E4E9;

  --color-accent: #CA9BAA;
  --color-accent-soft: #F6E7EC;
  --color-accent-light: #FAEEF2;

  --color-secondary: #A4B4BE;
  --color-secondary-soft: #EAF0F3;
  --color-secondary-dark: #6F838F;

  /* Neutral */
  --color-bg: #FBF7F1;
  --color-surface: #FFFDF9;
  --color-surface-soft: #F7EFE7;
  --color-border: #E8DDD5;
  --color-divider: #EFE6DF;

  /* Text */
  --color-text-primary: #29272A;
  --color-text-secondary: #6F6667;
  --color-text-muted: #A8A0A0;
  --color-text-inverse: #FFFFFF;

  /* Semantic */
  --color-price: #410016;
  --color-discount: #8A1238;
  --color-star: #B78A3B;
  --color-success: #6F8F7A;
  --color-warning: #D3A45C;
  --color-error: #B84A5A;
}
--- # 3. 컴포넌트별 색상 정의 ## App Background | 요소 | 색상 | | ----------- | ---------------------: | | 전체 배경 | #FBF7F1 | | 상단/하단 안전 영역 | #FBF7F1 | | 섹션 배경 | #FFFDF9 또는 #F7EFE7 | | 구분선 | #EFE6DF |
css
body {
  background: #FBF7F1;
  color: #29272A;
}
--- ## Header / Top Bar | 요소 | 색상 | | ------------ | --------: | | 헤더 배경 | #FBF7F1 | | 로고 텍스트 | #410016 | | 메뉴/알림/공유 아이콘 | #29272A | | 보조 아이콘 hover | #410016 | | 헤더 하단 라인 | #EFE6DF | --- ## Search Bar | 요소 | 색상 | | ------------ | --------------------------: | | 검색창 배경 | #FFFDF9 | | 검색창 border | #E8DDD5 | | placeholder | #A8A0A0 | | 입력 텍스트 | #29272A | | 검색 아이콘 | #6F6667 | | focus border | #CA9BAA | | focus shadow | rgba(202, 155, 170, 0.25) |
css
.searchInput {
  background: #FFFDF9;
  border: 1px solid #E8DDD5;
  color: #29272A;
}

.searchInput:focus {
  border-color: #CA9BAA;
  box-shadow: 0 0 0 3px rgba(202, 155, 170, 0.25);
}
--- ## Hero Banner | 요소 | 색상 | | ----------- | --------: | | 배너 배경 | #F6E7EC | | 배너 보조 배경 | #F7EFE7 | | 큰 문구 | #410016 | | 설명 텍스트 | #6F6667 | | CTA 버튼 | #410016 | | CTA 텍스트 | #FFFFFF | | 페이지 dot 활성 | #410016 | | 페이지 dot 비활성 | #D9C8C9 | 추천 그라데이션:
css
background: linear-gradient(
  135deg,
  #F6E7EC 0%,
  #FBF7F1 52%,
  #F7EFE7 100%
);
--- ## Primary Button | 상태 | 배경 | 텍스트 | Border | | -------- | --------: | --------: | --------: | | Default | #410016 | #FFFFFF | #410016 | | Hover | #5A0824 | #FFFFFF | #5A0824 | | Pressed | #2E0010 | #FFFFFF | #2E0010 | | Disabled | #D8CFCC | #FFFFFF | #D8CFCC | 사용처: * 최저가 구매하기 * 추천 선크림 보기 * 장바구니/구매 CTA * 선택된 주요 액션 --- ## Secondary Button | 상태 | 배경 | 텍스트 | Border | | -------- | --------: | --------: | --------: | | Default | #FFFDF9 | #410016 | #CA9BAA | | Hover | #F6E7EC | #410016 | #CA9BAA | | Disabled | #F1ECE8 | #A8A0A0 | #E8DDD5 | 사용처: * 구매하기 작은 버튼 * 더보기 * 외부 정보 링크 * 비교 상품 버튼 --- ## Filter Chips ### Active Chip | 요소 | 색상 | | ------ | --------: | | 배경 | #410016 | | 텍스트 | #FFFFFF | | Border | #410016 | ### Default Chip | 요소 | 색상 | | ------ | --------: | | 배경 | #FFFDF9 | | 텍스트 | #6F6667 | | Border | #E8DDD5 | ### Soft Highlight Chip | 요소 | 색상 | | ------ | --------: | | 배경 | #F6E7EC | | 텍스트 | #410016 | | Border | #F1D8E0 | 사용처: * 전체 * 민감성 * 지성 * 건성 * 수부지 * 복합성 * 인기순 * 최저가순 --- ## Product Card | 요소 | 색상 | | ------------ | ----------------------: | | 카드 배경 | #FFFDF9 | | 카드 border | #E8DDD5 | | 카드 shadow | rgba(65, 0, 22, 0.06) | | 상품명 | #29272A | | 상품 설명 | #6F6667 | | 가격 | #410016 | | 정가/보조가 | #A8A0A0 | | 별점 | #B78A3B | | 리뷰 수 | #6F6667 | | 찜 아이콘 기본 | #A8A0A0 | | 찜 아이콘 active | #410016 |
css
.productCard {
  background: #FFFDF9;
  border: 1px solid #E8DDD5;
  box-shadow: 0 8px 24px rgba(65, 0, 22, 0.06);
}
--- ## Rank Badge | 순위 | 배경 | 텍스트 | | ----- | --------: | --------: | | 1위 | #410016 | #FFFFFF | | 2~3위 | #6F838F | #FFFFFF | | 4위 이하 | #A4B4BE | #FFFFFF | 또는 더 부드럽게 가려면: | 순위 | 배경 | 텍스트 | | ----- | --------: | --------: | | 1위 | #410016 | #FFFFFF | | 2~3위 | #CA9BAA | #410016 | | 4위 이하 | #EAF0F3 | #6F838F | --- ## Tag / Badge | 태그 유형 | 배경 | 텍스트 | | -------- | --------: | --------: | | 더마테스트 완료 | #EAF0F3 | #6F838F | | 민감성 추천 | #F6E7EC | #410016 | | 지성 추천 | #EEF3F1 | #6F8F7A | | 무기자차 | #F7EFE7 | #6F6667 | | 기능성 | #FAEEF2 | #8A1238 | | 할인율 | #8A1238 | #FFFFFF | --- ## Price / Discount | 요소 | 색상 | | --------- | --------: | | 최저가 | #410016 | | 할인 가격 | #8A1238 | | 정가 취소선 | #A8A0A0 | | 할인 배지 배경 | #8A1238 | | 할인 배지 텍스트 | #FFFFFF | | 가격 비교 1위 | #410016 | | 가격 비교 일반 | #29272A | --- ## Category Icon Grid | 요소 | 색상 | | ------------- | --------: | | 아이콘 카드 배경 | #FFFDF9 | | 카드 border | #E8DDD5 | | 아이콘 라인 | #410016 | | 아이콘 보조 라인 | #CA9BAA | | 라벨 텍스트 | #6F6667 | | Active 배경 | #F6E7EC | | Active border | #CA9BAA | | Active 텍스트 | #410016 | --- ## Skin Type Shortcut | 요소 | 색상 | | ------------- | --------: | | 원형 버튼 배경 | #FFFDF9 | | 원형 버튼 border | #E8DDD5 | | 아이콘 기본 | #6F6667 | | 아이콘 active | #410016 | | active 배경 | #F6E7EC | | active border | #CA9BAA | | 라벨 | #6F6667 | --- ## Bottom Navigation | 요소 | 색상 | | ---------- | --------: | | 배경 | #FFFDF9 | | 상단 border | #E8DDD5 | | 비활성 아이콘 | #A8A0A0 | | 비활성 텍스트 | #A8A0A0 | | 활성 아이콘 | #410016 | | 활성 텍스트 | #410016 | | 활성 soft 배경 | #F6E7EC | --- ## Product Detail Image Area | 요소 | 색상 | | ------------- | -----------------------: | | 이미지 영역 배경 | #F7EFE7 | | 이미지 카드 배경 | #FBF7F1 | | 페이지 인디케이터 배경 | rgba(41, 39, 42, 0.55) | | 페이지 인디케이터 텍스트 | #FFFFFF | --- ## Recommendation Reason Section | 요소 | 색상 | | ------- | --------: | | 섹션 제목 | #29272A | | 체크 아이콘 | #6F8F7A | | 설명 텍스트 | #6F6667 | | 배경 필요 시 | #FFFDF9 | --- ## Price Comparison List | 요소 | 색상 | | -------------- | --------: | | 리스트 배경 | #FFFDF9 | | 1위 아이콘 | #B78A3B | | 순위 텍스트 | #6F6667 | | 판매처명 | #29272A | | 최저가 가격 | #410016 | | 일반 가격 | #29272A | | 구매하기 버튼 border | #CA9BAA | | 구매하기 버튼 텍스트 | #410016 | | 행 구분선 | #EFE6DF | --- ## External Link Card | 요소 | 색상 | | -------- | --------: | | 배경 | #FFFDF9 | | Border | #E8DDD5 | | 텍스트 | #29272A | | 아이콘 | #6F838F | | Hover 배경 | #F7EFE7 | --- ## Form / Input / Select | 요소 | 색상 | | ------------ | --------: | | 입력창 배경 | #FFFDF9 | | Border | #E8DDD5 | | Focus border | #CA9BAA | | Label | #6F6667 | | Value | #29272A | | Placeholder | #A8A0A0 | | Error border | #B84A5A | | Error text | #B84A5A | --- # 4. Claude 개발 지시용 요약 아래 내용을 

Primary color는 deep wine `#410016`으로 사용한다.
주요 CTA, 로고, 가격, 선택된 탭/칩, 활성 내비게이션, 찜 active 상태에 사용한다.

Accent color는 soft rose beige `#CA9BAA`로 사용한다.
배너, soft highlight, 태그 배경, focus ring, subtle selected background에 사용한다.

Secondary color는 muted blue gray `#A4B4BE`로 사용한다.
보조 아이콘, 정보성 태그, 정렬/필터 UI, secondary visual accent에 사용한다.

전체 앱 배경은 warm ivory `#FBF7F1`을 사용한다.
카드와 입력창은 `#FFFDF9`, 섹션 배경은 `#F7EFE7`, border는 `#E8DDD5`, divider는 `#EFE6DF`를 사용한다.

텍스트는 다음 기준으로 사용한다.
- Primary text: `#29272A`
- Secondary text: `#6F6667`
- Muted text / placeholder: `#A8A0A0`
- Inverse text: `#FFFFFF`

컴포넌트별 색상:
- Header: background `#FBF7F1`, logo `#410016`, icons `#29272A`
- Search bar: background `#FFFDF9`, border `#E8DDD5`, focus border `#CA9BAA`
- Hero banner: gradient `#F6E7EC` → `#FBF7F1` → `#F7EFE7`, CTA `#410016`
- Primary button: background `#410016`, hover `#5A0824`, text white
- Secondary button: background `#FFFDF9`, border `#CA9BAA`, text `#410016`
- Active chip: background `#410016`, text white
- Default chip: background `#FFFDF9`, border `#E8DDD5`, text `#6F6667`
- Product card: background `#FFFDF9`, border `#E8DDD5`, shadow `rgba(65, 0, 22, 0.06)`
- Price: `#410016`
- Discount badge: background `#8A1238`, text white
- Rating star: `#B78A3B`
- Bottom nav active: `#410016`
- Bottom nav inactive: `#A8A0A0`
- Tag blue-gray: background `#EAF0F3`, text `#6F838F`
- Tag rose: background `#F6E7EC`, text `#410016`
- External link card: background `#FFFDF9`, border `#E8DDD5`, icon `#6F838F`

전체 느낌은 고급스럽고 신뢰감 있는 뷰티 가격 비교 서비스로 구현한다.
과한 핑크보다는 아이보리 베이스에 딥 와인 포인트를 주고, 로즈 베이지와 블루그레이는 보조적으로만 사용한다.

--- # 5. Tailwind Theme 예시
ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        brand: {
          wine: "#410016",
          wineHover: "#5A0824",
          winePressed: "#2E0010",
          rose: "#CA9BAA",
          roseSoft: "#F6E7EC",
          roseLight: "#FAEEF2",
          blueGray: "#A4B4BE",
          blueGraySoft: "#EAF0F3",
          blueGrayDark: "#6F838F",
        },
        ivory: {
          bg: "#FBF7F1",
          surface: "#FFFDF9",
          soft: "#F7EFE7",
          border: "#E8DDD5",
          divider: "#EFE6DF",
        },
        text: {
          primary: "#29272A",
          secondary: "#6F6667",
          muted: "#A8A0A0",
          inverse: "#FFFFFF",
        },
        semantic: {
          price: "#410016",
          discount: "#8A1238",
          star: "#B78A3B",
          success: "#6F8F7A",
          warning: "#D3A45C",
          error: "#B84A5A",
        },
      },
      boxShadow: {
        card: "0 8px 24px rgba(65, 0, 22, 0.06)",
        floating: "0 16px 40px rgba(65, 0, 22, 0.10)",
      },
    },
  },
};
