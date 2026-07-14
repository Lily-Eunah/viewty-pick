# feature/oliveyoung-page-crawl

## Goal
Source OliveYoung prices by crawling our OWN curated product links directly (title +
price), instead of matching an OliveYoung offer on the Naver Shopping API. The current
Naver-only path leaves many products with no OliveYoung offer on Naver → Tier 3/4 →
the `link_only` tab grows. OliveYoung granted ViewtyPick explicit permission to crawl
our curated links (business team; no API, "just crawl it"). Title is parsed only for
개수/구성/용량 (`toCanonicalQuantity`) — NOT displayed.

## Status: PROBE stage (feasibility), adapter NOT built yet.

## Findings (verified live 2026-07-14)

1. **Direct storefront crawl is required and now permitted.** oliveyoung.co.kr is
   fronted by a **Cloudflare managed challenge** ("Just a moment…" / "잠시만 기다리세요",
   RAY_ID). A plain `fetch` (even of /robots.txt) → 403. So a Naver-free price needs a
   real browser render of the product page. Permission from OliveYoung removes the
   robots/self-imposed-compliance blocker (same stance as `crawler/core/naverPageCrawl.ts`,
   but with an explicit owner grant rather than an accepted-risk decision).

2. **Headless is blocked; HEADFUL passes.** The Cloudflare challenge flags the
   **headless fingerprint** — it blocked even from a residential Korean IP
   (1.238.238.195). A headful real browser (`headless:false`) executes the challenge JS
   and passes. We stay honest: **no anti-detection flags, no UA spoofing** — the UA is a
   normal `Chrome/148` (not `HeadlessChrome`). The challenge occasionally re-challenges;
   a reload retry (≤2) absorbs it.

3. **Stable parse source = `data-qa-name` DOM anchors** (QA hooks; survive deploys,
   unlike CSS-module-hashed classes; present in Playwright's render even when the RSC
   flight is not):
   - `text-product-original-price` = 정가 (struck; only when discounted)
   - `text-product-discount-price` = 할인가 (or the sole price when no discount)
   The Next.js flight (`__next_f`, React Query dehydrated cache with `salePrice`=정가,
   `finalPrice`=할인가, `saleableFlag`) is populated **inconsistently** across chromium
   builds — use as corroboration only, not the primary source.
   - Read via a Playwright **locator**, NOT `page.evaluate(namedFn)`: tsx/esbuild injects
     a `__name` helper into named functions that throws in-page when serialized.

4. **Local probe: 3/3 PASS** (residential IP): 스타라이크 24,000→14,400 · 아로셀 멜라
   TXA 30,000→25,000 · 이니스프리 1+1 더블기획 25,000→19,800. Title carries 용량/구성
   (e.g. "…50ml 더블 기획", "1+1") for `toCanonicalQuantity`.

## OPEN QUESTION (the whole point of the CI probe)
Local passes from a **residential** IP. The daily crawl runs on `crawl.yml` →
ubuntu-latest (**datacenter/Azure IP**), and Naver's equivalent page crawl was
hard-blocked (429) from that same runner. Cloudflare may serve a HARDER (interactive)
challenge to a datacenter IP that a headful-but-automated browser cannot auto-solve.
→ Must run `.github/workflows/oliveyoung-probe.yml` (workflow_dispatch, headful under
`xvfb`) and read the verdict BEFORE building the adapter.

## Built so far
- `scripts/live-check/diagnose-oliveyoung-crawl.ts` — READ-ONLY headful probe (no DB
  writes, no code changes). `npm run live-check:oliveyoung-crawl`.
- `.github/workflows/oliveyoung-probe.yml` — workflow_dispatch; installs Playwright
  Chromium; runs the probe headful under `xvfb-run`. No secrets, no deploy.

## Next steps
- [ ] Run the CI probe; record the datacenter-IP verdict below.
- [ ] If PASS → build the OliveYoung page-crawl adapter mirroring `naverPageCrawl.ts`:
      headful + retry, serial + rate-limit + random delay, fail-safe → link_only (never
      fabricate a price), title parsed only for 개수/구성/용량. Crawl = PRIMARY;
      Naver-sourced + manual_override = FALLBACK (agreed). Add sold-out detection.
- [ ] If BLOCKED → escalate: ask OliveYoung to whitelist the runner, or move OY crawl to
      a non-datacenter egress.

## CI probe result (datacenter IP)
_(pending — fill after running the workflow)_

## Out-of-scope note
Pre-existing `npm run typecheck` failure in `scripts/live-check/check-robots.ts:28`
("Duplicate function implementation") — unrelated to this branch, not touched here.
