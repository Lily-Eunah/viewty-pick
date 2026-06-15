# Claude Code 작업 프롬프트 — `feature/crawler-consolidation` PR 작성 + Merge

> 목적: 네이버 어댑터 통합 작업 브랜치를 push → PR 생성(영어) → CI 통과 확인 → main에 merge.
> CLAUDE.md 규칙(§3 Push/PR, §4 파일 무결성)을 엄격히 준수한다.

---

## 0. 전제 / 범위

- 대상 브랜치: **`feature/crawler-consolidation`** → base **`main`**.
- 이 PR의 산출물: ① 브랜치 통합(pipeline-mvp 기반), ② 용량 불일치 **절충안**, ③ 네이버 어댑터 **쇼핑 검색 API 복귀 + 공식몰 매칭(allowlist mallName, 개별몰 `{2,3}`만, 실패 시 비교 제외)**, ④ **마이그레이션 0006**(`price_snapshots.matched_url/matched_mall_name`, `listings.latest_matched_url`), ⑤ 리다이렉트 우선순위(`affiliate_url → latest_matched_url → home`), ⑥ §1b 용량 감사(읽기 전용), ⑦ 단위/라이브 검증.
- **범위 밖(merge 차단 아님, PR 본문에 follow-up으로 명시)**: 올리브영 크롤(robots `*` Disallow + WAF 403로 **크롤 불가** → 별도 결정), 쿠팡 라이브 검증(실 키 대기), allowlist 데이터 등록(운영자 TODO).

---

## 1. Push 전 검증 (CLAUDE.md §3 — 통과 필수)

순서대로 실행하고 **모두 통과**해야 push한다. 하나라도 실패하면 멈추고 보고.

```
git status                  # 의도한 변경만 있는지
npm run lint                # eslint (기존 <img> 경고 1건은 허용, error 0)
npm run typecheck           # tsc clean
npm run test:all            # 전 테스트 PASS
npm run build               # 빌드 성공
```

**파일 무결성(§4)**: `git diff --stat main...feature/crawler-consolidation` 로 변경 규모 확인, `git diff --check` 로 깨진 줄 없는지, 각 커밋이 잘림/0바이트 없는지 점검. 특히 마이그레이션 SQL·어댑터 파일 끝이 온전한지 직접 확인.

**커밋되면 안 되는 것 제외**: `docs/prompts/`, `tmp/` 는 운영자 개인 파일이므로 **커밋/스테이징 금지**(이미 untracked). 실수로 들어가지 않았는지 `git status`로 확인.

---

## 2. Push

```
git push -u origin feature/crawler-consolidation
```
- `main`에 직접 push 금지. force push 금지.

---

## 3. PR 생성 (제목·본문 영어 — CLAUDE.md §3)

`gh pr create --base main --head feature/crawler-consolidation` 로 생성. 아래 초안을 사용하되, 실제 커밋·테스트 결과에 맞게 보정한다.

**Title:**
```
feat(crawler): Naver Shopping Search API adapter with official-mall matching, volume-mismatch compromise, and matched-offer data model
```

**Body:**
```markdown
## Summary
Reverts the Naver price adapter from Playwright crawling back to the sanctioned
Naver Shopping Search API, because brand.naver.com/robots.txt disallows crawling
for our user-agent (`*` → Disallow: /). Adds official-mall matching, a volume-
mismatch compromise policy, and a matched-offer data model so the displayed price
and outbound link always come from the same official-store offer.

## Why
- Crawling brand.naver.com is not permitted for our crawler under robots.txt;
  UA-spoofing a whitelisted bot is evasion and against our trust-first policy.
- The Shopping Search API is the authorized read path (storefront robots N/A).
- Volume metadata is unreliable (LLM-seeded 50ml); price must not be hidden just
  because per-ml normalization is uncertain.

## What changed
- **Naver adapter → Shopping Search API.** Playwright/crawl code removed; pure
  `pickOfficialOffer()` extracted and unit-tested.
- **Official-mall matching.** Individual-mall offers only (`productType ∈ {2,3}`,
  which also excludes used/discontinued/preorder); official mall via
  `retailer_allowlist.allowed_store_name` (+ brand-contains fallback);
  title/volume similarity gate. No match → excluded + flagged (no reseller fallback).
- **Price + link from the same offer.** `/go/[listingId]` redirect priority:
  `affiliate_url → latest_matched_url → home`.
- **Volume-mismatch compromise.** Base/effective prices stay comparable and
  `parse_confidence` stays `high`; only `unit_price` is nulled with
  `unit_price_reliable=false`, excluding it from per-ml ranking / Viewty Score's
  per-ml component. `volume_mismatch` flagged for review.
- **Migration 0006.** `price_snapshots.matched_url`, `price_snapshots.matched_mall_name`,
  `listings.latest_matched_url`; `retailer_allowlist.allowed_store_name` reused as
  the mallName anchor.

## Testing
- `npm run lint` (0 errors; 1 pre-existing `<img>` warning)
- `npm run typecheck` (clean)
- `npm run test:all` (PASS — incl. pickOfficialOffer matching, redirect priority,
  normalize compromise)
- `npm run build` (succeeds)
- Live Naver API validation: 4/7 matched, 3 correctly excluded (no reseller fallback).
- Read-only volume audit: 몽디에스 50→60ml candidate; 이니스프리/조선미녀 50ml confirmed.
  No DB/sheet writes.

## Known follow-ups (not in this PR)
- **Olive Young crawl is not viable**: robots.txt `User-agent: * → Disallow: /`
  (content paths only whitelisted for search/AI bots) + WAF 403. Needs an
  alternative (manual_overrides / info-link / partner data) — operator decision.
- Allowlist data: register official mallName for 넘버즈인 (quick activation);
  verify whether 후시디딘 has an individual official-store offer in API results.
- Coupang live validation pending real keys (360s spacing).
```

---

## 4. CI 통과 확인 후 Merge

```
gh pr checks --watch        # CI(mock-validation 등) 통과 대기
```
- CI가 모두 green이면 merge. 실패 시 멈추고 원인 보고(merge 금지).
- Merge 방식은 **기존 히스토리 관례에 맞춰 merge commit**(과거 PR이 "Merge pull request #N" 형태):
```
gh pr merge --merge --delete-branch
```
- `main`에 force push 금지. merge 충돌 시 멈추고 보고.

---

## 5. Merge 후 정리

```
git checkout main
git pull origin main
git log --oneline -5        # merge 커밋 확인
```
- 로컬 `feature/crawler-consolidation`이 남아 있으면 정리(선택).

---

## 6. 작업 규칙 / 막히면

- CLAUDE.md 준수: main 직접 커밋·force push 금지, 검증 실패 상태 커밋/merge 금지.
- `docs/prompts/`·`tmp/`는 절대 커밋하지 않는다.
- push/PR/merge 권한·인증(`gh auth status`)에 문제가 있으면 멈추고 보고.
- 테스트·빌드·CI 중 하나라도 실패하면 **merge하지 말고** 상태를 보고한다.
- worklog(`docs/worklog/feature-crawler-consolidation.md`)가 최신인지 확인, 누락 시 갱신 후 push에 포함.
