# QA: Google Sheet → Supabase E2E Smoke Test

Branch: `qa/sheets-supabase-e2e-smoke`
Date: 2026-06-12

## Summary

Safe E2E smoke test of the Google Sheets → Supabase → Web UI pipeline.
No new features added. No production secrets modified. No real price crawlers run.

## Steps Executed

1. `sheets:headers` — wrote column headers to all 7 Sheet tabs (non-destructive)
2. `sheets:import` — imported real Sheet data into Supabase via Google Sheets API
3. `npm run typecheck` / `npm run lint` / `npm run build` — all pass

`sheets:reseed` was intentionally skipped to preserve existing Sheet data.

## Bug Fixed

**File:** `crawler/sheets/import.ts`

Empty string `""` was passed to Supabase for `source_date` (a date column), causing
PostgreSQL error `22007: invalid input syntax for type date`. Root cause: `?? null`
does not coerce empty strings. Fixed by replacing `??` with `||` for `detail`,
`source_title`, `ref_url`, and `source_date` in the `product_badges` upsert.

## Supabase Table Counts (post-import)

| Table              | Count |
|--------------------|-------|
| categories         | 6     |
| sellers            | 5     |
| products           | 16    |
| listings           | 54    |
| badges             | 1     |
| product_badges     | 16    |
| retailer_allowlist | 0     |
| manual_overrides   | 0     |
| seo_pages          | 6     |
| sheet_import_runs  | 9     |

Latest `sheet_import_runs`: status=`completed`, error_count=0

## Build Result

- typecheck: pass
- lint: pass (2 pre-existing warnings, not introduced here)
- build: pass — all 5 app routes compiled

## Routes to Verify Manually

- `http://localhost:3000/`
- `http://localhost:3000/c/sunscreen`
- `http://localhost:3000/p/p8veeo9`
- `http://localhost:3000/pick/directorpi/sunscreen`
- `http://localhost:3000/skin/sensitive/sunscreen`

## Changed Files

- `crawler/sheets/import.ts` — empty-string normalization fix for badge fields

## Remaining Issues / TODO

- `retailer_allowlist` count is 0 — Sheet tab may be empty; no action needed now
- `manual_overrides` count is 0 — expected (no overrides entered yet)
- `<img>` warning in `ProductImage.tsx` — pre-existing, not in scope here
