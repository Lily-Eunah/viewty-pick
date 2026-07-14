# OliveYoung local page crawl — operator guide

OliveYoung price comes from a **headful** crawl of our own curated product pages (we hold
OliveYoung's crawl permission). oliveyoung.co.kr is behind a **Cloudflare managed
challenge** that blocks a *headless* browser — and blocks a *headful* browser from a
**datacenter IP** (GitHub Actions) ~2/3 of the time. A **residential IP + a real display**
passes reliably (probe: 3/3 local vs 1/3 GitHub Actions). So OliveYoung is crawled
**out-of-band on the operator's own machine**, while the daily GitHub crawl does
everything else and skips OliveYoung (`crawl.yml` → `--skip-seller=oliveyoung`).

## What the local run does

`npm run oliveyoung:crawl:local` runs the normal pipeline **scoped to OliveYoung**:
- `--only-seller=oliveyoung` → crawls only OliveYoung listings and writes only their
  price snapshots. `current_prices`, `viewty_score`, and product images are **not**
  touched (they stay owned by the daily GitHub crawl).
- `OLIVEYOUNG_PAGE_CRAWL=on` → the OliveYoung adapter uses the headful page crawl (by
  `goodsNo` from the curated link) instead of the Naver-sourced fallback.
- Fail-safe: any Cloudflare block / timeout / parse miss / sold-out → the listing stays
  link-only (no price written). It never fabricates a price.
- The site reads the `listing_prices_public` view, so a fresh OliveYoung snapshot shows
  up immediately; the run also fires `/api/revalidate`.

⚠️ It **writes production Supabase** (the wrapper forces `CRAWLER_ALLOW_PROD_WRITE=true`
for itself only — do not put that in `.env`).

## Prerequisites

1. **Migration 0022 applied to prod** (adds `crawl_method='oliveyoung_page'`). Apply it
   BEFORE the first local run, or the listing write is rejected by the CHECK constraint.
2. `.env` in the project root with the Supabase + Discord + revalidate secrets the
   crawler already uses (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_*`,
   `DISCORD_WEBHOOK_URL`, `REVALIDATE_SECRET`, …).
3. Playwright Chromium installed once: `npx playwright install chromium`.

## Rollout order (do NOT skip)

1. Apply migration 0022 to prod.
2. Run `npm run oliveyoung:crawl:local` **manually once** and confirm OliveYoung prices
   look right on the site (see Verify). At this point the GitHub crawl still prices
   OliveYoung (Naver-sourced), so nothing is lost if the local run misbehaves.
3. Only after step 2 looks good, merge the branch — that activates
   `--skip-seller=oliveyoung` in `crawl.yml`, handing OliveYoung fully to the local run.
4. Register the scheduled task (below).

If the local run ever stops (laptop off for days), OliveYoung prices just go stale
(last-good snapshot persists) — they do not vanish, and `manual_override` still applies.

## Schedule it (Windows Task Scheduler)

The crawl is **headful**, so the task MUST run in an interactive desktop session — i.e.
**"Run only when user is logged on"** (the default). "Run whether user is logged on or
not" runs in session 0 with no display and the browser launch fails.

CLI (adjust the path / time; 10:00 = a time the machine is normally on & logged in):

```
schtasks /Create /TN "ViewtyPick OliveYoung Crawl" /SC DAILY /ST 10:00 ^
  /TR "cmd /c cd /d C:\Users\yua12\Desktop\Project\viewty-pick && npm run oliveyoung:crawl:local >> oy-crawl.log 2>&1"
```

Or via the GUI: Create Task → General: "Run only when user is logged on" → Triggers:
Daily 10:00 → Actions: Start a program, Program `npm.cmd`, Arguments
`run oliveyoung:crawl:local`, Start in `C:\Users\yua12\Desktop\Project\viewty-pick`.

## Verify

- Console ends with `Sync complete! Success rate: …%` and a per-title `[TitleParse]`
  line per OliveYoung product.
- The Discord daily-summary (if `DISCORD_WEBHOOK_URL` is set) posts the OliveYoung run.
- On the site, an OliveYoung price appears/updates for the crawled products.
- A block shows as `challenge not cleared … link-only` in the log for that goodsNo — the
  product stays link-only rather than getting a wrong price.

## Compliance (permission ≠ carte blanche)

Serial, rate-limited (`OLIVEYOUNG_CRAWL_INTERVAL_MS`, default 1800ms), random-ish pacing,
**no UA spoofing** (real headful Chrome UA), volume ≤ our curated OliveYoung links/day,
and fail-safe to link-only. Keep it gentle.
