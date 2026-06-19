# Claude Code 작업 프롬프트 — 매처 PR + merge + main 배포(데이터 반영)

> 목적: 검증 완료된 `fix/naver-sku-matching`(매처 최종형)을 push → PR(영어) → CI green → merge,
> 그다음 **main에서 `cf:deploy`** 해 viewtypick.com에 정정된 가격을 반영한다.
> 매처는 크롤러/로직 전용(웹 렌더·신규 마이그레이션 없음) → main 배포는 웹 동작 변화 없이 Supabase의 정정 데이터만 새로 읽어 반영.
> CLAUDE.md(§3 Push/PR, §4 무결성) 준수.

## 0. 전제 (검증됨)
- 매처: link-id 앵커 → 세트 개당가 → OY 4단계 → 신뢰밴드 → **+올리브영 recall + gift-strip 채점**.
- **full 프로덕션 재수집 검증 완료**(백업 `backups/2026-06-16T14-45-41-677Z`): wrong 가격 0, priced 40/45, crawl_runs/last_crawled_at 기록됨.
- 브랜치 26커밋, 미push.

## 1. Push 전 검증
```
git status                 # 의도한 변경만
npm run lint               # error 0 (기존 <img> 경고 1 허용)
npm run typecheck
npm run test:all
npm run build
```
- 파일 무결성: `git diff --stat main...fix/naver-sku-matching`, `git diff --check`. 마이그레이션 없음 확인.
- **비커밋 혼입 점검**: `docs/prompts/`·`tmp/`·`UI_DESIGN.md`·시크릿·`.env` 안 들어갔는지 `git status`.

## 2. Push
```
git push -u origin fix/naver-sku-matching
```
- main 직접 push·force push 금지.

## 3. PR 생성 (영어 — CLAUDE.md §3)
`gh pr create --base main --head fix/naver-sku-matching`. 아래 초안을 커밋/검증에 맞게 보정:

**Title:**
```
feat(crawler): final Naver/OliveYoung matcher — id-anchor, sets per-unit, OY 4-tier, confidence band, +올리브영 recall & gift-strip scoring
```
**Body:**
```markdown
## Summary
Replaces fuzzy title matching with a trust-first matcher that prices only what it can
confidently identify, so the comparison shows correct prices (or no price) — never a
different product's price.

## Matcher pipeline
- **Naver brand-store**: link-id anchor (resolve curated channelProductNo → match the
  result whose link → /products/{N}); anchor miss → link-only (no fuzzy price).
- **Sets/bundles**: included with per-unit (effective) pricing; gifts label-only (not
  counted); heterogeneous 2-product sets → inspection.
- **OliveYoung (no anchor)**: 4-tier (hidden / Naver mallName='올리브영' match / manual_override
  / link-only) + confidence band (auto-price only on sim≥0.6 + core token; else hold) +
  **+올리브영 recall query** (surfaces OY's own listing; mallName filter still excludes
  title-stuffed resellers) + **gift-stripped scoring** (a freebie can't lend its token).

## Full production re-collection — verified (backup taken)
- **Wrong prices = 0.** Ground-truth: 조선미녀 **14,400** (was wrong 25,300), 유세린 **60,900**,
  라하 13,800/16,800/OY 1+1 eff 12,000, 토리든 19,930, 닥터지 16,990 (toner set held),
  바이오힐보 held (trust-first).
- priced 40/45 products, 63 priced listings. crawl_runs / last_crawled_at now recorded.

## Known follow-ups (operator/web — not in this PR)
- Operator sheet: badge rows still use old names (하이아르론/엔에이디) → 2 badge skips; 넘버즈인
  coupang URL is still a short-link (data_error); 아르마니 #95 113,050 is the anchored
  "리필위크 세트" (swap to a single URL if a single price is wanted).
- Web reflection needs `cf:deploy` (run.ts revalidate is stubbed + REVALIDATE_SECRET unset).
- Web-layer mocks (별점/20% 인하/하락 badge/per-unit display/0-price sort/tier-4 link-only)
  are a separate PR.

## Testing
lint / typecheck / test:all / build green. No new migrations; no DB writes from code.
```

## 4. CI green → merge
```
gh pr checks --watch
gh pr merge --merge --delete-branch   # 기존 PR 관례(merge commit)
git checkout main && git pull origin main
```
- CI 실패 시 merge 금지·보고.

## 5. main 배포 (데이터 반영)
- main(merge 반영)에서 `npm run cf:deploy`.
  - **빌드 env 확인**: `.env`에 `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` 존재(빌드 타임 inline). `SITE_INDEXABLE`은 **미설정 유지(noindex)**. 런타임 시크릿은 Cloudflare에 기설정.
  - ⚠️ Windows: OpenNext 빌드가 `.open-next` EBUSY 나면 stale `workerd.exe` 종료 후 재시도(npm 사용). 막히면 보고.
- 배포 후 fresh Worker가 Supabase의 정정 데이터를 새로 읽음 → 반영.

## 6. 검증 (viewtypick.com)
- 정정 가격 반영 확인: **조선미녀 14,400**, 닥터지 토너 미노출, 바이오힐보 가격 없음 등.
- **noindex 유지**(robots `Disallow: /`, meta noindex), 제휴 고지 노출.
- ⚠️ **웹 레이어 mock(별점·20% 인하·하락·다중팩 표시·0원 정렬)은 여전히 보임 = 정상**(별도 web PR 대상). 이 단계는 *가격 값* 반영만.

## 7. 작업 규칙 / 막히면
- merge·배포 권한/인증(`gh auth status`, `wrangler whoami`) 문제 시 멈추고 보고.
- CI·빌드 실패 시 merge·배포 말고 상태 보고.
- 배포가 매처 브랜치 코드를 올리는 게 아니라 **merge된 main**을 올리는 것임을 재확인(브랜치에서 `cf:deploy` 금지).
- `docs/prompts/`·`tmp/`·`UI_DESIGN.md`·시크릿 비커밋·비노출.

---
## 다음 (이 PR/배포 후)
**web-layer PR**: mock 제거(별점·20%·하락) + 개당가 표시·개당 정렬 + tier-4 link-only 렌더. + 운영자 시트 follow-up(배지명·넘버즈인 URL·아르마니 단품 URL). 그게 끝나면 사이트가 "정확한 값 + 가짜값 제거"로 깨끗해짐.
