# feature/seo-quality-improvements — SEO 품질 개선

기준 보고서: `docs/seo-improvement-report.html`

## 구현 요약

### P0 — 카니발리제이션 정리
- `acne-pad` 스펙 제거 (pad-best와 Jaccard 1.0 = 완전 중복)
- `men-allinone` 스펙 제거 (allinone-best와 Jaccard 1.0 = 완전 중복)
- `next.config.ts`에 301 리디렉트 추가: `/best/acne-pad` → `/best/pad-best`, `/best/men-allinone` → `/best/allinone-best`
- 색인 예산 절약, 링크 에쿼티 통합

### P1 — 페이지 콘텐츠 깊이
- `lib/seo/specs.ts`에 `intro?: string` 및 `uniqueFaqs?: Array<{q,a}>` 필드 추가
- 전 44개 스펙에 페이지별 고유 도입부(100–250자) 및 1–2개 주제별 FAQ 작성
- `app/best/[slug]/page.tsx` 개선:
  - **고유 도입부** (`spec.intro`) 히어로 섹션에 노출
  - **가격 업데이트 날짜** (`lastUpdated`) 히어로 상단에 표시
  - **최저가 TOP3 요약 블록** 제품 목록 위에 추가 (가격 즉시 확인)
  - **추천이유(reasonItems[0])** 각 제품 카드 아래 베이지 배너로 표시
  - **고유 FAQ 우선 노출** (페이지별 uniqueFaqs → 선정 이유 → 공통 2개 순)
  - **메타 설명 강화** 제품 수 + 대표 브랜드 자동 추가로 CTR 개선
  - **BreadcrumbList** 2단계 → 3단계로 확장 (`/best` 허브 포함)

### P2 — 롱테일 키워드 신규 페이지
- `pdrn-serum` 추가 (PDRN·피디알엔·폴리뉴클레오타이드 keywords)
- `soothing-toner` 추가 (진정·시카·센텔라 키워드)
- `soothing-serum` 추가 (진정·시카·마데카소사이드 키워드)
- `soothing-cream` 추가 (진정·시카·판테놀 키워드)
- 모두 4개 이상 제품 보유 여부는 sheets:import 후 확인 필요 (MIN_SEO_PRODUCTS gate)

### P3 — /best 허브 품질
- `app/best/page.tsx` 개선:
  - 그룹별 섹션 인트로 추가 (카테고리별 / 피부타입별 / 고민성분별 / 큐레이션)
  - 가이드 카드에 **최저가 미리보기** (예: "최저 12,900원~") 추가
  - 전체 가이드 수 표시 ("총 N개 가이드 · 매일 가격 갱신")

### Import 에러 진단 수정 (fix)
- `crawler/sheets/import.ts`:
  - Step 5/6/7(allowlist/overrides/seo_pages) 유효성 실패 시 구체적 에러 메시지를 `stats.errors`에 push
  - 빈 행(all values empty) skip으로 불필요한 에러 카운트 방지
  - import 완료 후 첫 30개 에러 상세 console 출력 추가
  - `Fetched:` 로그에 allowlist/overrides/seo_pages 행 수 추가

### 올리브영 × 카테고리 페이지 (SEO report 2.5)
- `SeoPageSpec`에 `seller?: string` 필드 추가 (post-filter용)
- `matchSeoProducts`에 seller 필터 추가 (`stores[].sellerSlug` 기준)
- 5개 신규 스펙: `oliveyoung-{sunscreen,toner,serum,cream,cushion}`
  - 카테고리 필터 + seller='oliveyoung' 조합으로 제품 선별
  - 각 페이지 고유 intro + FAQ 포함
- `app/best/page.tsx`: 허브 카드 카운트에 seller 필터 반영 (spec 룩업)
- `app/best/[slug]/page.tsx`: getSeoPageData 결과에 seller 후필터 적용

### P4 — 내부 링크 강화
- `/best/[slug]` 하단에 **관련 추천 가이드** 섹션 추가 (최대 5개)
  - 우선순위: 동일 category → 동일 page_type 순
  - `getActiveSeoPages()` 재활용 (React cache로 추가 DB 쿼리 없음)
  - 기존 "전체 가이드 보기" 단독 링크 → 카드 목록 + 전체 보기 구성으로 교체

## 주요 변경 파일
- `lib/seo/specs.ts` — 전면 재작성: 인터페이스 확장 + 49개 스펙(+5 oliveyoung)
- `lib/seo/match.ts` — SeoFilters에 seller 필터 추가
- `next.config.ts` — P0 301 리디렉트 추가
- `app/best/[slug]/page.tsx` — P1 콘텐츠 깊이 + seller 필터 + P4 관련 가이드
- `app/best/page.tsx` — P3 허브 품질 + seller 필터 반영
- `crawler/sheets/import.ts` — 에러 진단 개선

## 테스트 결과
- `npm run test:seomatch` — **10개 All Pass** (seller 필터 2개 신규 테스트 포함)
- `npm run test:all` — All Pass
- `npx tsc --noEmit` — 에러 없음

## 남은 이슈 / TODO
- [ ] **sheets:import 116 에러 원인 재확인** — 에러 로깅 추가 후 재실행하면 상세 출력됨
- [ ] 새 스펙(PDRN·진정 4개 + 올리브영 5개) sheets:import로 DB 활성화 필요
  - write-seo-pages 실행 → 시트에 추가 → sheets:import → DB row 생성
  - DB row 없는 slug는 `/best/[slug]` 404
- [ ] `device-best` vs `dry-device` (Jaccard 0.86) — 콘텐츠로 차별화됐으나 확인 필요
- [ ] `SITE_INDEXABLE=true` + GSC·네이버 서치어드바이저 등록 (operator)
- [ ] cf:deploy (operator)
- [ ] P3 캐러셀 이미지 교체 (별도 작업)
- [ ] 네이버 블로그 채널 (Play A) — 별도 운영 작업
