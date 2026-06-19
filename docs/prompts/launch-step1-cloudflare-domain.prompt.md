# Claude Code 작업 프롬프트 — 런칭 1단계: Cloudflare 이전 + viewtypick.com 팀 검증 배포 (noindex)

> 목표: 앱을 **Cloudflare(Workers + OpenNext)**로 이전하고 **viewtypick.com**에 연결해
> 동료들이 실도메인에서 검증할 수 있게 한다. **색인은 차단(noindex), 접근은 공개 URL.**
> 색인 허용·법적 페이지·AdSense·수익화 풀가동·Search Console 제출은 **다음 단계(공개 런칭)**로 미룬다.

---

## 0. 배경 / 확정
- 호스팅: **Cloudflare 이전(확정)** — 쿠팡 제휴 딥링크가 이미 라이브라 Vercel Hobby 비상업 ToS를 피해야 함(DESIGN §3.1). 1순위 **Workers + OpenNext**.
- 가시성: **noindex + 공개 URL**(게이트 없음). 검색 색인만 차단, 링크로는 접근 가능.
- 이미지가 plain `<img>`(next/image 미사용)라 **OpenNext 이미지 최적화 설정 부담 없음** — 이전에 유리.
- 크롤러(GitHub Actions)는 웹 호스트와 무관하게 Supabase에 계속 씀 — 이번 작업에 영향 없음.

## 0.1 역할 분담 (중요)
- **에이전트(코드/설정)**: OpenNext 설정·호환성 검증, `wrangler` 구성, robots/noindex 토글, 배포 스크립트, 스모크 테스트, PR.
- **운영자(대시보드/계정)**: Cloudflare 계정·도메인 추가, **Spaceship 네임서버 변경**, Cloudflare에 **시크릿/환경변수 입력**, (필요 시) 배포 권한 제공. 에이전트는 이 자격증명에 접근 못 하므로, 해당 단계는 운영자가 수행하거나 자격증명 제공 후 진행.

## 0.2 현재 진행 상태 (이미 완료)
- ✅ Cloudflare 도메인 추가 + **Spaceship 네임서버 변경 + DNS 전파 완료(Active)**. → 대기 없이 전 단계 진행 가능.
- 진행 순서: OpenNext 호환성 검증(§1) → `wrangler` 구성·`*.workers.dev` 배포·스모크(§2) → 운영자 시크릿 입력(§2, Worker 생성 후) → **custom domain(viewtypick.com) 연결**(§3) → noindex 확인(§4) → 스모크(§5).
- (에이전트가 Cloudflare/Spaceship 자격증명에 접근 못 하면, 시크릿 입력·custom domain 연결은 운영자가 수행하거나 자격증명 제공 후 진행.)

---

## 1. OpenNext 호환성 검증 (게이트 — 통과 전 배포 금지)
DESIGN §3.1·IMPLEMENTATION §2.11. `@opennextjs/cloudflare`로 빌드/동작 검증:
- 빌드 성공, 로컬/preview 구동.
- **Route Handlers**: `/go/[listingId]`(302 + `affiliate_clicks` insert), `/api/revalidate`(secret 검증).
- **ISR / on-demand revalidation** 동작.
- **Supabase 읽기**: anon+RLS로 `listing_prices_public`·`current_prices`·products 등 정상.
- `sitemap.ts`·`robots.ts` 동적 생성.
- 외부 이미지 `<img>`(ads-partners.coupang.com) 렌더(최적화 없음 — 그대로 OK).
- 비호환 발견 시 **수정 후 재검증**. 하드 블로커면 멈추고 보고(임시 Vercel 폴백은 최후수단).

## 2. Cloudflare 배포
- (운영자) Cloudflare 계정 + 프로젝트.
- (에이전트) `wrangler.toml`/OpenNext 빌드·배포 구성.
- **환경변수/시크릿** (운영자가 Cloudflare에 입력, 클라이언트 노출 금지):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (공개·RLS 읽기 전용)
  - `SUPABASE_SERVICE_ROLE_KEY` (서버 전용 — `/go` insert·`/api/revalidate`에서만)
  - `REVALIDATE_SECRET`
  - ※ 크롤러 시크릿(coupang/naver/google/discord)은 **GitHub Actions에만**, Cloudflare엔 두지 않음.
- 먼저 `*.workers.dev` URL로 배포 → 스모크 후 도메인 연결.

## 3. viewtypick.com 연결 (Spaceship → Cloudflare)
- ✅ (완료) Cloudflare 사이트 추가 + Spaceship 네임서버 변경 → **Cloudflare가 "Active"인지 먼저 확인**(아직이면 전파 대기, 강제 우회 금지).
- (에이전트/운영자) Active 후 Worker에 **custom domain**으로 `viewtypick.com`(+`www`) 연결. TLS는 Cloudflare 자동.
- 연결 후 apex/www 접속 확인.

## 4. noindex (공개 URL)
- **검색 색인 차단**: 사이트 전역 `meta robots = noindex, nofollow` + `robots.txt`에 `Disallow: /`.
- **공개 런칭 때 한 번에 뒤집을 수 있게 env 플래그로**: 예 `SITE_INDEXABLE=false` → `robots.ts`/메타가 이 값을 읽어 noindex. 런칭 시 `true`로만 바꾸면 색인 허용.
- 제휴 고지 문구는 이미 AppShell 전역 노출 — 유지 확인.
- ⚠️ 이 단계에선 **Search Console sitemap 제출/색인 요청 하지 않음**(다음 단계).

## 5. 스모크 테스트 (팀 검증)
- viewtypick.com에서 홈/카테고리/제품상세/SEO 랜딩 렌더.
- 공개 뷰 가격(3사) + 이미지(쿠팡 폴백/placeholder) + `/go` 302 리다이렉트(affiliate_clicks 기록) + 제휴 고지 노출.
- **noindex 확인**: `robots.txt` `Disallow: /`, 페이지 메타 `noindex`.
- 프로덕션 빌드 성능 sanity(모바일).
- 결과(접속 URL·확인 항목·이상)를 보고 → 팀 공유.

## 6. 이번 단계에서 제외 (다음: 공개 런칭)
- 색인 허용(`SITE_INDEXABLE=true`), Search Console/sitemap 제출, **법적 페이지(개인정보처리방침·이용약관)**, AdSense, 수익화 풀가동, 일일 cron 스케줄링+Discord 실연동.

## 7. 브랜치 & 커밋 (CLAUDE.md)
- 분기 `chore/cloudflare-opennext-launch`(최신 main). main 직접 커밋·force push 금지.
- 커밋 단위:
  - `chore: add opennext cloudflare build config (wrangler)`
  - `fix: opennext compatibility for route handlers/isr` (필요 시)
  - `feat: site indexability flag (noindex for team verification)`
  - `docs: cloudflare deploy + domain runbook in worklog`
- 시크릿·`.env`·`docs/prompts`·`tmp`·운영자 `UI_DESIGN.md` 편집 비커밋. `git diff --check`.
- 영어 PR(요약·이유·검증결과 + 배포/도메인 절차) → CI green → merge.
- worklog `docs/worklog/cloudflare-opennext-launch.md`(OpenNext 검증 결과·배포 절차·도메인·noindex 상태).

## 8. Definition of Done
1. OpenNext 호환성 검증 통과(route handlers·ISR·Supabase·sitemap/robots).
2. Cloudflare(Workers+OpenNext) 배포 성공, 시크릿은 Cloudflare/GitHub에만.
3. **viewtypick.com** 연결(apex+www, TLS), 팀이 실도메인에서 접속·검증 가능.
4. 전역 **noindex + robots Disallow**, `SITE_INDEXABLE` 플래그로 토글 가능, 제휴 고지 노출.
5. 스모크 테스트(가격·이미지·/go·고지·noindex) 통과, worklog 작성, 시크릿 비노출.

## 9. 막히면
- OpenNext 하드 비호환(특정 기능 미지원) → 어떤 기능이 막히는지·대안(코드 조정 or 임시 Vercel) 보고 후 결정. 임의 우회 금지.
- Cloudflare 계정/도메인/네임서버/시크릿은 **운영자 액션** — 자격증명/접근 없으면 그 지점에서 멈추고 운영자에게 요청.
- DNS 전파 지연 시 대기 안내, 강제 우회 금지.
- 색인 관련(robots/메타)이 모호하면 noindex 기본값으로 두고 보고.
