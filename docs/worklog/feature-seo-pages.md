# feature/seo-pages — SEO 랜딩 페이지 (/best/[slug])

## 구현 요약
검색 유입용 SEO 랜딩 페이지를 추가했다. `seo_pages` 시트의 주제 중 **현재 뷰티픽에
4개 이상 노출 가능한 제품이 매칭되는 주제만** 페이지화하고, 각 페이지에서 추천 제품
리스트 + 쿠팡·올리브영·네이버 최저가 비교 + 뷰티픽 홍보 + FAQ를 보여준다. Google
Search Console / 네이버 서치어드바이저 소유확인과 sitemap·robots도 정비했다.

데이터 측(테이블/RLS/시트 import)은 이미 배선돼 있었고, **렌더 라우트·쿼리·sitemap·
소유확인이 비어 있던 것**을 채웠다. 토픽을 카테고리/피부타입/뱃지만으로는 표현할 수
없어(여드름·블랙헤드·미백 등) `seo_pages`에 **`keywords` 컬럼**을 추가했다.

## 주요 변경 파일
- `lib/seo/match.ts` — 페이지 1개 → 노출 제품 매칭 단일 소스. `matchSeoProducts`
  (category=minor/major slug, skin_type=AND, badge=directorpi/hwahae, keywords=CSV OR).
  `MIN_SEO_PRODUCTS=4`. 라우트·sitemap·생성 스크립트가 공유 → 4개 게이트가 절대 어긋나지 않음.
- `lib/seo/specs.ts` — 후보 페이지 스펙(시트 주제 정렬). 생성 스크립트가 4개 미만은 걸러냄.
- `app/best/[slug]/page.tsx` — SEO 랜딩 라우트. h1·meta·canonical·OG, JSON-LD
  (ItemList + FAQPage + BreadcrumbList), thin-content 가드(<4 → 404), `revalidate=3600`.
- `app/best/page.tsx` — 전체 가이드 허브(내부링크/크롤 발견용), 4개 이상만 링크.
- `lib/queries/index.ts` — `getActiveSeoPages`, `getSeoPageData(slug)` 추가(기존 getProducts
  표시 게이트·추천 정렬 재사용).
- `app/layout.tsx` — `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` /
  `NEXT_PUBLIC_NAVER_SITE_VERIFICATION` 환경변수 기반 소유확인 meta 태그(값 없으면 미출력).
- `app/sitemap.ts` — 홈 + /best + /best/[slug](4개 이상) + /c/[category] + /p/[slug] 열거
  (SITE_INDEXABLE 시에만; noindex면 빈 sitemap 유지).
- `supabase/migrations/0019_seo_keywords.sql` — `seo_pages.keywords TEXT` 추가.
- `crawler/sheets/{setup_headers,validate,import}.ts` — `keywords` 컬럼 배선
  (헤더는 정렬 misalign 방지 위해 `is_active` 뒤에 append).
- `lib/types.ts` — `SeoPage.keywords?`.
- `lib/__tests__/seoMatch.test.ts` + `test:seomatch`(→ `test:all`).
- `scripts/ops/analyze-seo-topics.ts` — 후보 스펙별 제품 수 리포트(읽기 전용).
- `scripts/ops/write-seo-pages.ts` — 생성 행을 `seo_pages` 시트에 직접 기록(백로그 보존).

## 생성된 페이지 (40 active)
선크림(디렉터파이/건성/지성/민감성/복합성), 토너·세럼·수분크림·쿠션·파운데이션·패드·
클렌징폼·클렌징오일·바디워시·바디로션·시트팩·올인원·뷰티디바이스, 대분류 허브(기초
스킨케어/베이스메이크업/바디케어/클렌징/마스크팩), 피부×카테고리(건성·수부지 크림,
건성·민감성 세럼, 건성 쿠션/파운데이션/디바이스), 키워드(여드름 토너·세럼·크림·패드,
블랙헤드 클렌징오일, 진정·수분 마스크팩), 남자(화장품/스킨케어/올인원).
- inactive(<4, 슬러그 보존): `mineral-sunscreen`(3), `toneup-sunscreen`(3) — 제품 늘면 자동 활성.

## 테스트 결과
- `npm run test:seomatch` — 8/8 통과. `test:all`에 편입.
- `typecheck` — 신규/수정 파일 0 에러(기존 무관 에러 2건: `crawler/core/__tests__/normalize.test.ts`,
  추적 안 되는 로컬 `scripts/ops/_test-sync-live.ts` — 본 작업과 무관).
- `eslint`(변경 파일) — 0 error.
- dev 스모크: `/best` 200, `/best/directorpi-sunscreen` 200(제품 7, ItemList 7),
  `/best/dry-skin-sunscreen` 200(제품 4), `/best/nonexistent` 404, robots noindex(런치 전 정상).
- 시트 쓰기: `seo_pages` 159행(헤더+42 구조행[40 active]+백로그 114) 기록·읽기검증 완료.
  쓰기 전 백업 `backups/seo_pages_backup_pre_write.json`(gitignore).

## 운영자 후속 작업 (배포 순서)
1. **마이그레이션**: `0019_seo_keywords.sql`를 prod Supabase에 적용(`seo_pages.keywords` 컬럼).
2. **시트 헤더 동기화**(선택): `npm run sheets:headers` — 시트 헤더에 `keywords` 보장
   (이미 write-seo-pages가 헤더 기록함; 멱등).
3. **import**: `npm run sheets:import` — 시트 → `seo_pages` 테이블(40 active 반영).
4. **소유확인 토큰**: Cloudflare 환경변수에
   `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`(Search Console),
   `NEXT_PUBLIC_NAVER_SITE_VERIFICATION`(네이버 서치어드바이저) 설정.
   - GSC: 도메인/URL-접두어 속성 추가 → "HTML 태그" 방식 토큰 복사.
   - 네이버: 웹마스터도구 사이트 등록 → "HTML 태그" content 값 복사.
5. **색인 ON**: 공개 런치 시 `SITE_INDEXABLE=true` → robots allow + sitemap 노출 활성.
6. **배포**: `npm run cf:deploy`.
7. 배포 후 GSC/네이버에서 `https://viewtypick.com/sitemap.xml` 제출.

## 남은 이슈 / TODO
- 키워드 컬럼이 DB에 없을 때(마이그레이션 전) keyword 기반 inactive 행은 import되지 않으므로
  영향 없음. 마이그레이션 → import 순서 유지.
- 후보 추가는 `lib/seo/specs.ts`에 1줄 추가 후 `write-seo-pages --apply` → import 하면 됨
  (4개 이상이면 자동 active).
- mock(db_mock.json / mock_sheets_data) seo 행은 기존 6개 유지(키워드 옵셔널). 실데이터는 prod 기준.
