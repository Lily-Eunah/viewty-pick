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

## Decision (2026-07-14): egress = local machine (A′)
Datacenter IP is unreliable (1/3). OliveYoung's approval team did no WAF whitelisting.
Repo is PUBLIC, so a self-hosted GitHub runner is unsafe (fork-PR RCE). → run OliveYoung
out-of-band on the operator's OWN machine as a **local scheduled script** (residential IP
+ real display), NOT a GitHub runner. Naver (pending its own permission) + Coupang are
deferred follow-ups.

## Implementation (PR1–4, on this branch)
- **PR1** `0022_add_oliveyoung_page_crawl_method.sql` — expand `listings.crawl_method`
  CHECK + re-provenance OliveYoung rows to `oliveyoung_page`.
- **PR2** `crawler/core/oliveyoungPageCrawl.ts` — headful parser/runner (data-qa anchors,
  challenge retry, fail-safe). 11 pure-parser tests + live runtime check (24,000/14,400 ·
  30,000/25,000).
- **PR3** OliveYoungAdapter page-crawl branch (`OLIVEYOUNG_PAGE_CRAWL=on`, anchored) +
  run.ts `--only-seller`/`--skip-seller` (scoped run skips current_prices/scores/images —
  site reads the view, not current_prices) + offerTitle prefix + import/CrawlMethod.
  test:all green; mock dry-run scopes to 12 OliveYoung listings + skips global steps.
- **PR4** `scripts/ops/oliveyoung-local-crawl.ts` + `npm run oliveyoung:crawl:local` +
  `crawl.yml --skip-seller=oliveyoung` + `docs/ops/oliveyoung-local-crawl.md` (Task
  Scheduler + rollout order).

## Operator rollout (order matters — see docs/ops/oliveyoung-local-crawl.md)
1. Apply migration 0022 to prod.
2. `npx playwright install chromium`; run `npm run oliveyoung:crawl:local` manually once,
   verify OliveYoung prices on the site (GitHub crawl still Naver-sources OliveYoung here).
3. Merge the branch → activates `--skip-seller=oliveyoung` (local becomes sole OliveYoung
   source).
4. Register the daily Task Scheduler job (**"run only when user is logged on"** — headful
   needs a display).

## Cloudflare rate escalation — 2026-07-18 (first scheduled run)
First real scheduled run (04:18, after days idle) revealed the real limit: the first
**~26** OliveYoung pages crawled fine (managed challenge auto-cleared), then Cloudflare
**escalated to the INTERACTIVE "verify you're human" challenge** and the remaining ~77
all failed → link-only (fail-safe, no fake prices; but their prior price got a `no_offer`
snapshot → dropped from the view). Even the operator's MANUAL checkbox clicks then looped
= the IP was hard-flagged for the rest of the burst. It is **rate-based** (a burst of
~100 headful hits trips it), not a permanent block — days idle didn't prevent it, and
verification (2 crawls days earlier) had passed ~95/97, so OliveYoung likely tightened the
threshold.
- ⛔ Auto-clicking the challenge is OFF the table: it's CAPTCHA/bot-detection bypass
  (against our own `규정 준수` rule + Cloudflare ToS) AND wouldn't work (manual clicks loop).
- **Mitigation (this change):** (1) pace pages at a random **4–8s** (was fixed 1.8s);
  (2) `--max-listings` LRU — the local run crawls only **20/day** (`OLIVEYOUNG_MAX_PER_RUN`),
  cycling the ~103 catalog over ~5 days, staying under the ~26 escalation point.
  Scheduled task DISABLED until the IP cools + a manual test confirms 20/day stays clean.
- **Durable fix (recommended, not yet done):** OliveYoung whitelists our egress IP in
  Cloudflare (business permission does NOT reach Cloudflare). The 2026-07-18 log
  (escalation at ~26 requests) is concrete evidence to give their tech team.

## Deferred / follow-up
- Automatic Naver-sourced fallback when a local run is missed: NOT wired (current fallback
  = last-good snapshot persists + manual_override). Low value for the target case (Naver
  often has no OliveYoung offer → the exact reason we page-crawl), so deferred.
- Naver page crawl via the same local path — separate, needs Naver's permission first
  (we do NOT have it; robots Disallow). See [[project-naver-page-crawl]].
- Coupang direct crawl — separate follow-up.

## CI probe result (datacenter IP) — 2026-07-14, run 29334088295

Runner: ubuntu-24.04, **Azure westus (datacenter IP)**. Headful under xvfb, real
`Chrome/148` Linux UA, ≤2 reload retries.

- 아로셀 멜라 TXA → **PASS** (정가 30,000 / 할인가 25,000)
- 스타라이크 PDRN → **403 "Just a moment…"** (challenge NOT cleared, incl. retry)
- 이니스프리 → **403 "Just a moment…"**

→ **1/3 PASS from the datacenter IP** (vs 3/3 residential). Cloudflare serves a much
stricter challenge to datacenter IPs; a headful automated browser clears it only
intermittently. This matches Naver's page crawl 429ing from the same runner. **Not
reliable enough for the daily crawl** — 2/3 would fail → fall back to link_only,
defeating the purpose. The approach (headful parse) is sound; the **egress IP** is the
blocker.

### Decision needed (adapter NOT started — its viability depends on this)
- **Option B (recommended): fixed-IP egress + OliveYoung whitelists that one IP.** Route
  the OY crawl through a single static IP and ask OliveYoung to whitelist it (turns the
  business permission into real WAF access; a whitelisted IP bypasses the challenge).
- **Option A (fallback): self-hosted runner on a residential IP** (e.g. the operator's
  Korean home connection). Passed 3/3 locally; free-ish but needs the machine up +
  runner setup + uptime.
- **Option C (not recommended): residential-proxy service.** Reliable but costs money
  (conflicts with 비용 0) and raises ToS/ethics questions.

Interim: keep the current Naver-sourced + manual_override path as-is.

## Out-of-scope note
Pre-existing `npm run typecheck` failure in `scripts/live-check/check-robots.ts:28`
("Duplicate function implementation") — unrelated to this branch, not touched here.
