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

## 주요 변경 파일
- `lib/seo/specs.ts` — 전면 재작성: 인터페이스 확장 + 44개 스펙 고유 콘텐츠
- `next.config.ts` — P0 301 리디렉트 추가
- `app/best/[slug]/page.tsx` — P1 콘텐츠 깊이 대폭 강화
- `app/best/page.tsx` — P3 허브 품질 개선

## 테스트 결과
- `npm run test:seomatch` — 8개 All Pass
- `npm run test:all` — 실행 중 (전체 스위트)
- `npx tsc --noEmit` — 에러 없음

## 남은 이슈 / TODO
- [ ] 새 스펙(PDRN·진정 4개)이 실제로 4개 이상 제품 매칭하는지 sheets:import 후 확인
- [ ] `device-best` vs `dry-device` (Jaccard 0.86) — 콘텐츠로 차별화됐으나 products 수 확인 필요
- [ ] `SITE_INDEXABLE=true` + GSC·네이버 서치어드바이저 등록 (operator)
- [ ] cf:deploy (operator)
- [ ] P3 캐러셀 이미지 교체 (별도 작업)
- [ ] 네이버 블로그 채널 (Play A) — 별도 운영 작업
