# ViewtyPick — TBD / Backlog

> 누적된 follow-up·발견 이슈 정리. 우선순위: **P0(런칭 전 신뢰/데이터)** > **P1(공개 런칭 게이트)** > **P2(자동화·품질)** > **P3(문서/사소)**.
> 작성: 2026-06 (launch step 1 = Cloudflare + viewtypick.com noindex 배포 완료 시점).

---

## P0 — 신뢰/데이터 무결성 (팀 검증·공개 전 최우선)
라이브 홈(viewtypick.com)에서 발견 — 서비스 핵심 가치(검증된 제품·신뢰 가격)를 직접 훼손할 수 있음.

- [ ] **별점(★) 노출 제거/확인** — MVP는 리뷰 없음(DESIGN). 홈에 ★2.3(1,173) 등 표시 = mock/seed 누출 의심. 노출 정책 결정 + 제거.
- [ ] **"오늘 가격 좋은 제품" 정렬 오류** — 가장 비싼 제품(랑콤 170,000원)이 1위. "가격 좋은"의 정렬 기준(혜택/할인율/ml당?) 재정의.
- [ ] **카탈로그 실데이터 vs 데모/seed 감사** — 랑콤·아르마니·유세린·바이오힐 등 백화점 고가 브랜드가 "디렉터파이 K-뷰티 50개" 의도와 불일치. 어떤 게 실제 큐레이션이고 어떤 게 seed/데모인지 audit 후 정리.
- [ ] **표시 가격 전수 신뢰 점검** — mock 청소 이후에도 데모 가격이 남아 있는지(위 정렬·브랜드 정황) 확인.

## P0.5 — 실제 콘텐츠 큐레이션 (제품의 본체)
- [ ] **디렉터파이 언급 제품 ~50개 실제 입력** — 정확한 제품명·브랜드·카테고리·용량·이미지·뱃지·피부타입 + 검증된 판매처 URL(네이버 공식 mallName, 올영 큐레이터, 쿠팡 제품 URL). 데모가 아닌 *진짜 검증 카탈로그*가 있어야 서비스 가치 성립.

---

## P1 — 공개 런칭 게이트
- [ ] **법적 페이지** — 개인정보처리방침·이용약관(+ 제휴 수수료 고지 페이지). AdSense·상업 운영 요건.
- [ ] **Cloudflare 관리 robots.txt 비활성화** — 현재 Cloudflare Managed 블록(`Allow: / search=yes`)이 앱 `robots.ts`(`Disallow: /`)와 충돌. meta noindex로 색인은 막혀 있으나, `SITE_INDEXABLE` 토글이 단일 권위가 되도록 관리 robots 주입 끄기.
- [ ] **색인 ON = `SITE_INDEXABLE=true` + 재배포** — meta noindex가 빌드타임에 박힘(worklog §4). env만 바꾸면 안 됨.
- [ ] **Search Console 연결 + sitemap 제출**, **sitemap 전체 URL 열거**(카테고리/제품, 현재 noindex라 비어 있음).
- [ ] **next/image 도입(또는 width/height+lazy+sizes)** — 현재 plain `<img>`. 모바일 CWV/LCP/CLS = SEO 랭킹. ads-partners.coupang.com 호스트 기록됨.
- [ ] **JSON-LD 구조화 데이터 검증** — Product/AggregateOffer(lowPrice=기본 최저가만)/ItemList/BreadcrumbList. 페이지에 안 보이는 가격 금지.
- [ ] **Durable incremental cache (R2 + KV/DO)** — OpenNext on-demand revalidation이 전 isolate에 전파되도록(worklog §5). R2 프로비저닝 필요.
- [ ] **AdSense 신청 + 수익화 풀가동** (Cloudflare 이전 완료라 가능).

## P2 — 자동화 & 신선도
- [ ] **일일 cron 스케줄링** (GitHub Actions 04:00 KST) — fail_count fix 완료라 안전. 가격 신선도 + **가격 히스토리 자산** 누적 시작.
- [ ] **Discord 실연동** — 현재 mock. cron 알림/일일 요약이 실제로 도착하게.
- [ ] **`crawler:test` 라이브쓰기 가드** — prod Supabase 거부 / 테스트 DB 강제. (과거 mock이 prod 오염한 footgun.)

## P2 — 매칭/커버리지 품질
- [ ] **네이버/쿠팡 no_offer 키워드 튜닝** — 멀티 후보 쿼리(브랜드+핵심어/풀네임 축약)로 productId 미surface 제품 회복(예: 쿠팡 4건 등).
- [ ] **link-only 제품 보강** — 6개 manual_override/URL 입력, 쿠팡 잔여 short-link(넘버즈인 등) → 제품 상세 URL 교체.
- [ ] **tier-4 올영 link-only UI(§7.4)** — 가격 없는 올영 행 "올영에서 보기" 렌더(현재 `mapToUIProduct`가 스냅샷 없는 listing drop).
- [ ] **전역 `affiliate_url = url` 복사 재검토(비-쿠팡)** — 원본 URL이 affiliate_url에 들어가 latest_matched_url/딥링크를 가릴 수 있음. affiliate엔 진짜 제휴 링크만, 폴백은 redirect 체인이 담당.

## P3 — 문서/사소
- [ ] **DESIGN.md "10/hour" → "50/min" 정정** (쿠팡 검색 API 실제 한도).
- [ ] **`UI_DESIGN.md` 운영자 미커밋 편집** — 커밋 또는 폐기 결정.
- [ ] **`middleware.ts` → `proxy.ts` 재전환** — OpenNext가 Node proxy 지원 시(Next 16 마이그레이션 부채).

## 제품 이미지 컴플라이언스 (메모)
- 쿠팡 productImage는 파트너스 API 제공 자산 → 제휴 링크+고지 문구 맥락에서 사용 OK. **AI 가공/생성 가짜 이미지 금지**(신뢰·저작권). 네이버/올영 이미지는 각 프로그램 라이선스 범위 확인 후.
