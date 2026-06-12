# Worklog: infra/supabase-remote-setup

## Summary

Prepared Supabase remote integration documentation for ViewtyPick. No real secrets were added, no external services were called, and no production data was touched. All work is documentation and configuration-safe.

## Implemented

- **`docs/supabase-remote-setup.md`** — Step-by-step guide for connecting ViewtyPick to a real Supabase project:
  - Project creation and migration application (`0001_init.sql`, `0002_rls.sql`)
  - Credential collection from Supabase Studio
  - `.env` configuration for local dev, GitHub Actions secrets, and Vercel env vars
  - RLS assumption verification (8 tables with public read, 8 private-write-only)
  - Mock fallback behavior and how `isSupabaseConfigured()` controls switching
  - Post-connection smoke test procedure
  - Full environment variable reference table (15 vars)

## Key Changed Files

- `docs/supabase-remote-setup.md` — new file

## Mock Mode Validation Results

All checks ran against mock DB (`VIEWTYPICK_MOCK_MODE=true CRAWLER_MODE=mock`):

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ Pass (0 errors) |
| `npm run lint` | ✅ Pass (2 pre-existing warnings, 0 errors) |
| `npm run build` | ✅ Pass (Turbopack, 5 routes) |
| `npm run crawler:test` | ✅ Pass (43 listings, 84% success, mock DB write) |

## RLS Findings

Migration `0002_rls.sql` is correct and complete:
- RLS enabled on all 16 tables
- 8 tables have public `SELECT` policies (anon + authenticated)
- 8 tables (price_snapshots, retailer_allowlist, manual_overrides, affiliate_clicks, crawl_runs, crawl_errors, sheet_import_runs, score_config) have no public read — writes go via service_role only
- No gaps in current RLS design

## Remaining Issues / TODO

- Supabase project not yet created — user needs to complete step 1 of `docs/supabase-remote-setup.md`
- `score_config` seed data is included in `0001_init.sql` (lines 196–208); no separate seed script needed
- Zigzag and Ably adapters are not yet implemented — `[Pipeline] No adapter found for seller slug: zigzag` is expected and benign
- 2 pre-existing lint warnings exist (unrelated to this branch):
  - `components/common/ProductImage.tsx:23` — `<img>` vs `<Image />`
  - `crawler/core/healthcheck.ts:117` — unused `previousSnapshot`
