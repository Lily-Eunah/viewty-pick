# Claude Code 작업 프롬프트 — 웨이트리스트(출시·할인알림 사전신청, 발송은 추후)

> 목적: 로그인/마이·알림 기능 오픈 전, **수요 검증 + 런칭 리스트 수집.** 마이 탭과 관심상품의 "할인 알림 받기"에서 **이메일(필수)+동의**를 받아 안전 저장. **이메일 온리**(전화 미수집 — 런칭 알림은 이메일로). **이번 단계는 수집만**(발송 없음 — 로그인 생기면 Phase 2).
> 베이스: 최신 `main`. 분기 `feature/waitlist`. 대상: DB migration(`waitlist` 테이블), 서버 라우트/액션(`app/api/waitlist/route.ts` 등, **service role 서버 전용**), `app/my/page.tsx`(신규), 관심상품 CTA, `components/layout/BottomTabBar.tsx`.

## 1. DB (migration 0016)
`waitlist` 테이블: `id`, `email text not null`, `intent text not null check (intent in ('launch','price_alert'))`, `wishlist_slugs jsonb null`, `consent_service boolean not null`, `consent_marketing boolean not null default false`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`, **`unique(email)`**. (전화 컬럼 없음 — 이메일 온리.)
- **RLS: anon 접근 전면 차단(read/write 모두)**. 쓰기는 **서버에서 service role로만**. 이메일 목록이 클라이언트로 절대 노출되면 안 됨.

## 2. 수집 폼 (클라이언트 → 서버 라우트)
- 필드: **이메일(필수, 형식 검증)**, 동의 체크박스 2개 — **서비스 출시/기능 알림 수신(필수, 제출 조건)** + **(선택) 마케팅 정보 수신**. (전화 필드 없음.)
- 짧은 **개인정보 안내**(수집 항목·목적=출시/알림 통지·보관, 동의 철회 방법) 노출.
- 제출 → 서버 라우트(`POST /api/waitlist`)가 **service role(supabaseServer)로 upsert**(email 충돌 시 consent/wishlist 갱신, intent 보존/갱신, updated_at). **service role 키는 서버 전용**(클라이언트 노출 금지).
- 성공 상태: "신청 완료 — 출시되면 알려드릴게요." 재신청 가능(중복 방지 upsert).

## 3. 진입점
- **마이 탭 `/my`(신규)**: 현재 "준비 중" alert 대신 → **출시 알림 웨이트리스트 페이지**. "마이/로그인 기능 준비 중, 출시되면 알려드릴게요" + 폼(`intent='launch'`). BottomTabBar 마이 탭의 `handleUnderConstruction`·`opacity-60` 제거 → 실제 `/my` 링크.
- **관심상품 "할인 알림 받기" CTA**: `/wishlist`에서 → 같은 폼(`intent='price_alert'`) + **현재 localStorage 관심목록 slug를 `wishlist_slugs`로 함께 전송**(로그인/알림 오픈 시 그 제품 가격알림 시드). 
  - ※ 이 CTA는 favorites(localStorage 관심상품, `feature/favorites`)가 있어야 slug를 읽음 → favorites 머지 후 연결. favorites 전이면 마이 웨이트리스트만 먼저 출시하고 CTA는 후속.

## 보안/프라이버시 (필수)
- PII(이메일·전화)는 **Supabase(RLS) 안전 저장만** — 시트/커밋/클라이언트 로그/URL 파라미터에 절대 금지.
- 동의 없이 마케팅 발송 안 함(이번 단계는 발송 자체가 없음). 동의 값·시각 저장.
- (변호사 아님) 개인정보보호법 수집·이용 동의 + 정보통신망법 광고성 수신 동의 원칙 준수 설계.

## 테스트
- 유효 이메일 + 서비스동의 → 저장(서버). 같은 이메일 재제출 → upsert(중복 행 0).
- 마케팅 동의 on/off 저장.
- anon 클라이언트로 waitlist **조회 불가**(RLS) 확인.
- price_alert 제출 시 wishlist_slugs 저장(favorites 연동 시). 마이 탭 alert 없이 `/my` 이동.
- `test:all`·typecheck·build·lint green.

## 적용
- `feature/waitlist`: `feat(web): pre-launch waitlist (email-only + consent) stored securely; wire my tab`, `test`, `docs: worklog`. 영어 PR → CI → merge → **migration 0016 적용(SQL Editor)** → `cf:deploy` → 신청·저장 확인(서버에서만 조회). 발송 없음(Phase 2 로그인 후).

## 막히면
- 서버 라우트가 부담이면 Supabase RLS **insert-only 정책(anon insert 허용, select 차단)**로도 가능하나, **select 차단은 반드시**(이메일 유출 방지). 권장은 service role 서버 라우트.
