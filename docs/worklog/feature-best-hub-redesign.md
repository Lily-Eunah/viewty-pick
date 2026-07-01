# feature/best-hub-redesign — /best 허브 리디자인

기준: SEO 품질 개선 후속. `/best` 허브가 46개 가이드를 동일한 텍스트 리스트로 나열해
프로덕션 수준의 시각 계층·차별성이 부족하다는 진단에서 출발.

## 설계 원칙
taxonomy(페이지 종류)가 아니라 **"카테고리 탭으로 못 얻는 차별적 가치 × 검색 의도"**로 그룹핑.
- `/best`는 하단 탭 "카테고리"(→ `/c`) 아래의 **서브페이지**이므로 `showBack` 헤더 유지가 맞음
  (탑레벨 destination 아님 → 헤더 교체 불필요).
- 카테고리별 최저가 페이지(선크림·토너 등)는 카테고리 탭 필터와 기능 중복 → 허브에서 강등하되
  SEO head-term 유입 + 내부 링크 자산을 위해 삭제하지 않고 하단 chip으로 유지.

## 4-tier 그룹핑 (위 → 아래)
1. **에디터 픽 (curation)** — `page_type='curation'`. 큰 hero 카드(대분류 일러스트 PNG) + 보조 카드.
   필터로 못 만드는 전문가 큐레이션(무기자차·톤업 등).
2. **고민·성분별 (keyword)** — `page_type='keyword'`. 2-col 그리드 + 개념 아이콘(진정·PDRN·여드름·블랙헤드).
3. **피부 타입별 (skin)** — `page_type='skin'`. 가로 스크롤 + 기존 피부타입 페이스 아이콘.
4. **올리브영 (seller)** — `spec.seller='oliveyoung'`. 초록 밴드로 분리, 카테고리 아이콘 chip.
5. **카테고리별 (category)** — 하단 SEO 색인용 chip. "카테고리 탭에서도 볼 수 있어요" 라벨.

## 아이콘 전략 (1 + 2(b))
- **1**: 카테고리 축 = 기존 `public/images/categories/*.png` 대분류 일러스트 재사용 (featured hero).
- **2(b)**: 개념/소분류 = 신규 mauve SVG 라인아트 세트 직접 제작 (`components/seo/GuideIcon.tsx`).
  - 제품형(tube·bottle·dropper·jar·compact·foundation·pad·foam·oil·pump·mask·device)
    + 개념형(soothing·pdrn·acne·blackhead·men·hydra), `stroke=currentColor`로 섹션별 색 테마.
  - `guideIconName(page)`: keyword slug → 개념 아이콘, 아니면 category → 제품 아이콘 매핑.
- 피부타입 카드는 기존 `components/home/BeautyIcons` 페이스 아이콘 재사용.
- NEW 배지·퀵점프는 도입하지 않음 (강등된 구조라 불필요, stale 리스크).

## 주요 변경 파일
- `components/seo/GuideIcon.tsx` — 신규. mauve SVG 라인 아이콘 세트 + 매핑 헬퍼.
- `app/best/page.tsx` — 전면 재구성: 4-tier 그룹핑 + featured hero + 올리브영 밴드 + 하단 chip.

## 테스트 / 검증
- `npx tsc --noEmit` — 에러 없음
- `npm run test:all` — All Pass
- `npx eslint app/best/page.tsx components/seo/GuideIcon.tsx` — 클린
- `next dev` 렌더 확인: `/best` HTTP 200, H1 + 6개 section, 가이드 링크 48개
  (고민·성분 13 / 피부타입 11 / 카테고리 chip 18 / featured+올리브영 밴드), 콘솔 에러 0.

## 남은 이슈 / TODO
- [ ] 개념 섹션 아이콘: 지금은 직접 그린 SVG(2b). 추후 원 디자이너에게 동일 스타일 일러스트
      확장 의뢰 시 교체 가능 (1(a)).
- [ ] `/c/[category]` 페이지에서 → `/best/[category]-best` 역링크 추가 (SEO 내부 링크 보강, 별도 작업)
- [ ] cf:deploy (operator)
