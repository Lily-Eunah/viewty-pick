# Claude Code 작업 프롬프트 — 런칭 Readiness (OpenNext → Cloudflare → 도메인 → SEO → 법적 페이지)

> 목적: viewtypick.com 공개를 위한 **엔지니어링/인프라/런칭 준비**를 단계적으로 완료한다.
> **UI 시각·UX QA는 별도 인력(범위 제외)** — 대신 테스트 가능한 배포 URL + QA 핸드오프 체크리스트를 산출.
> 위험 단계(OpenNext·Cloudflare·DNS)는 **게이트**: 실행 전 계획 보고 + 운영자 확인, 비호환/실패 시 멈추고 보고.

---

## 0. 범위 / 운영자 선결
- 범위: OpenNext 호환성 검증 → Cloudflare 이전 → 도메인 연결 → SEO 인프라 → 법적 페이지 → 런칭 점검.
- 제외: UI 시각/UX QA(사람), AdSense 신청(런칭 후), 히스토리 차트/매칭 튜닝(별도).
- **운영자 선결(없으면 해당 단계에서 멈추고 요청)**:
  - **Cloudflare 계정** + viewtypick.com을 Cloudflare에 추가할 권한(또는 Spaceship 네임서버 변경 권한).
  - **GA4 속성**(Measurement ID), **Google Search Console** 접근(소유권 확인용).
  - **법적 페이지용 정보**: 운영 주체명/연락 이메일(사이트용), 수집 데이터 범위(우리는 익명 클릭·GA4, PII 미저장 — DESIGN §13). → 초안은 에이전트가 만들고 **운영자/법무 검토 전제**.
- **왜 Cloudflare인가**: Vercel Hobby는 비상업 전용인데 쿠팡 제휴 딥링크가 이미 라이브 → 실도메인 공개 = 상업 사용 → Hobby ToS 위반. DESIGN §3.1대로 **Cloudflare 이전(1순위 Workers+OpenNext)** 후 공개.

---

## Phase L1 — OpenNext 호환성 검증 (게이트, 먼저)
- 현재 Next 앱을 **Cloudflare Workers + OpenNext**로 빌드/로컬·preview 실행.
- 검증 항목(DESIGN §3.1·Phase 2.11): App Router, **Route Handler `/go/[listingId]`·`/api/revalidate`**, **ISR + on-demand revalidation**, 이미지 처리(현재 plain `<img>`라 next/image 의존 없음 — 확인), 서버 컴포넌트, env 접근.
- **비호환 발견 시: 멈추고 보고** + 대안(기능 회피/수정). DESIGN 원칙: "검증 완료 전 제휴/광고 운영 시작 안 함."
- 산출: 호환성 리포트(OK/이슈 목록). **OK여야 L2 진행.**

## Phase L2 — Cloudflare 이전 (게이트: 운영자 확인 후 실행)
- Cloudflare 프로젝트(Workers+OpenNext) 생성, **env/secrets 등록**(Supabase URL/anon/service role, REVALIDATE_SECRET, GA4 등 — 클라이언트 노출 금지 분리). 시크릿 비커밋·비노출.
- 빌드/배포 → **preview URL에서 검증**: 페이지 렌더, **`/go` 리다이렉트 + affiliate_clicks 기록**, **on-demand revalidate** 동작, **RLS anon read-only**(공개 뷰만), 가격·이미지 렌더, 쿠팡 고지 문구.
- 실패 시 멈추고 보고. (Vercel은 이전 검증 끝날 때까지 병행 가능.)

## Phase L3 — 도메인 연결 (viewtypick.com)
- Spaceship → **Cloudflare 네임서버로 변경**(또는 Cloudflare DNS에 도메인 추가). apex + `www` 설정, **www↔apex 정규화(canonical 호스트 301)**, SSL(Cloudflare 자동).
- viewtypick.com이 Cloudflare 배포를 가리키는지, HTTPS·리다이렉트 정상 확인.
- DNS 전파/네임서버 변경은 운영자 작업이 필요할 수 있음 → 단계·레코드 안내하고 확인 대기.

## Phase L4 — SEO 인프라
- `sitemap.ts`/`robots.ts`(동적), **JSON-LD**(Product+AggregateOffer **base 최저가만**, ItemList, BreadcrumbList — 페이지 미노출 가격 금지, DESIGN §11), 메타 템플릿·OG, **canonical**, thin/중복 조합 **noindex**.
- **GA4 설치**(Measurement ID), **Search Console 소유권 확인** + **sitemap 제출**.
- Rich Results / Lighthouse(모바일 CWV)로 점검. ※ 현재 `<img>` 사용이라 **CWV 개선(next/image 또는 width/height·lazy·sizes)** 은 런칭 전 권장 follow-up으로 리포트(이번 범위에선 측정·기록).

## Phase L5 — 법적/컴플라이언스 페이지
- **개인정보처리방침**(익명 클릭·GA4·PII 미저장 반영), **이용약관**, **제휴 수수료 고지 페이지**(쿠팡 파트너스 + 네이버/올영 등; 기존 AppShell 고지 유지). 푸터에서 링크.
- **초안 생성 + "운영자/법무 검토 필요" 명시**(법률 자문 아님). 운영자 제공 정보(주체명·연락처) 반영.

## Phase L6 — 런칭 전 점검 + QA 핸드오프
- 가격 **갱신 시각 + "실제 결제가는 판매처 확인"** 문구 전역, secrets는 Cloudflare 환경변수에만, 제휴 링크 prod 동작, 마지막 빌드/배포 green.
- **UI QA 핸드오프 산출물**: (1) QA가 테스트할 **배포(preview/prod) URL**, (2) **UI QA 체크리스트 문서**(`docs/qa/ui-qa-checklist.md` — 홈/카테고리/상세/랜딩 화면, 가격·뱃지·이미지·고지·구매버튼/`/go`·모바일 반응형·placeholder 폴백·tier-4 link-only 한계 명시). 코드 QA는 에이전트가 안 함(사람 담당).

---

## 작업 규칙 (CLAUDE.md)
- **단계별 브랜치/PR 분리**(한 PR에 전부 몰지 말 것): 예 `chore/opennext-verify`, `chore/cloudflare-migration`, `feat/domain-and-dns`, `feat/seo-infra`, `feat/legal-pages`, `chore/launch-checklist`.
- main 직접 커밋·force push 금지. Conventional Commits. 커밋 전후 `git diff --stat`/`--check`/`git show --stat HEAD`.
- `docs/prompts/`·`tmp/`·`UI_DESIGN.md`(운영자 미커밋)·시크릿 비커밋.
- 원격 마이그레이션 필요 시(없을 듯) 기존 게이트. 각 PR 영어 본문(요약·이유·테스트) → CI green → merge.
- worklog: 각 단계 `docs/worklog/<branch>.md`.

## Definition of Done
1. OpenNext 호환성 검증 통과(또는 이슈 해결).
2. Cloudflare에 배포·검증(렌더·`/go`+클릭집계·revalidate·RLS·가격/이미지/고지).
3. viewtypick.com 연결, HTTPS·www↔apex 정규화.
4. sitemap/robots/JSON-LD(base only)/canonical/noindex, GA4+Search Console+sitemap 제출.
5. 개인정보처리방침·이용약관·제휴 고지 페이지(초안, 검토 전제) + 푸터 링크.
6. 런칭 점검 + **QA 핸드오프(배포 URL + UI QA 체크리스트)**. CWV(next/image) follow-up 리포트.

## 막히면
- OpenNext 비호환 기능 발견 → 멈추고 이슈·대안 보고(강행 금지).
- Cloudflare/도메인 권한·계정·DNS가 운영자 작업 필요 → 단계 안내 후 대기.
- 법적 페이지 필수 정보(주체명·연락처) 없음 → 운영자에게 요청, placeholder로 초안만.
- 이전 후 기능 회귀(revalidate/route handler/RLS) → 멈추고 보고, Vercel 병행 유지.
