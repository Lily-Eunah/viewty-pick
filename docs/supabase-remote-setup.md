# Supabase Remote Setup Guide

This guide covers wiring ViewtyPick to a real Supabase project. The app runs fully in mock mode (file-based JSON DB) without any of these steps — complete them only when ready to connect to the live database.

---

## 1. Create Supabase Project

1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to your target users (e.g. `ap-northeast-1` for Korea).
3. Wait for provisioning to finish (usually ~2 minutes).

---

## 2. Apply Migrations

Open the **SQL Editor** in Supabase Studio and run the migration files **in order**:

```
supabase/migrations/0001_init.sql   ← schema + score_config seed data
supabase/migrations/0002_rls.sql    ← RLS policies
```

**Step-by-step:**
1. In Supabase Studio → SQL Editor → click "New query".
2. Paste the contents of `0001_init.sql`, click **Run**. Verify all 16 tables appear in the Table Editor.
3. Paste the contents of `0002_rls.sql`, click **Run**. Verify no errors.

If you have the Supabase CLI installed, you can also run:
```bash
supabase db push
```
(requires `supabase/config.toml` — see Supabase CLI docs).

---

## 3. Collect Your Credentials

From **Project Settings → API**:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (e.g. `https://xyzxyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key — **keep secret, never expose to client** |

---

## 4. Configure Environment Variables

### Local development

Copy `.env.example` to `.env` and fill in the three Supabase values:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

Also **remove or change** the mock-mode flags so the app uses Supabase instead of the local JSON DB:

```
CRAWLER_MODE=live
VIEWTYPICK_MOCK_MODE=false
```

### GitHub Actions (crawler)

Add the following as **repository secrets** (Settings → Secrets and variables → Actions):

- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The crawler workflow (`crawl.yml`) reads these at runtime.

### Vercel (web app)

Add the same three Supabase variables as **environment variables** in the Vercel project settings, scoped to Production (and Preview if desired). The `SUPABASE_SERVICE_ROLE_KEY` is used only in server-side Route Handlers — it must not appear in the browser bundle.

---

## 5. Verify RLS Assumptions

### Web (anon key) — read-only public tables

The following tables have public `SELECT` policies for `anon` and `authenticated` roles:

| Table | Filter |
|---|---|
| `categories` | all rows |
| `sellers` | all rows |
| `products` | `is_active = true` |
| `badges` | all rows |
| `product_badges` | all rows |
| `listings` | `is_active = true` |
| `current_prices` | all rows |
| `seo_pages` | `is_active = true` |

### Batch / admin (service_role) — bypasses RLS

All write operations (crawl pipeline, sheet import) use the `service_role` key, which bypasses all RLS policies. These tables have **no public read** policy:

- `price_snapshots`, `retailer_allowlist`, `manual_overrides`
- `affiliate_clicks`, `crawl_runs`, `crawl_errors`
- `sheet_import_runs`, `score_config`

### Quick verification query (SQL Editor)

Run this with the **anon** role to confirm RLS is working:

```sql
-- Should return only active products
SELECT id, slug, is_active FROM products LIMIT 10;

-- Should return empty (no public read policy)
SELECT * FROM price_snapshots LIMIT 1;
```

You can test the anon role in Supabase Studio by switching the query role to `anon` in the SQL Editor header.

---

## 6. Mock Mode Fallback

The app and crawler automatically fall back to the local JSON mock DB when Supabase is not configured. This is controlled by:

- **`isSupabaseConfigured()`** in `lib/supabase/client.ts` — returns `false` if env vars are missing or contain placeholder values (`https://placeholder-project.supabase.co`, `placeholder-anon-key`).
- **`isSupabaseServerConfigured()`** in `lib/supabase/server.ts` — same logic for the `service_role` key.
- **`VIEWTYPICK_MOCK_MODE=true`** or **`CRAWLER_MODE=mock`** — forces mock mode even if real keys are present (used in CI and local dev).

Mock DB state is persisted at `lib/data/db_mock.json`.

---

## 7. Post-Connection Smoke Test

After setting real credentials, run:

```bash
# Verify typecheck and build still pass
npm run typecheck
npm run build

# Run the crawler against the real DB (dry-run style: no retailer API calls needed
# because adapters fall back to mock prices when API keys are missing)
npm run crawler:test
```

If `SUPABASE_SERVICE_ROLE_KEY` is real but retailer API keys are still missing, the crawler will use mock prices but write real rows to Supabase — useful for verifying DB connectivity and RLS without calling external retailers.

---

## 8. Environment Variable Reference

| Variable | Scope | Required for | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | web + crawler | Exposed to browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | web (read-only) | Exposed to browser |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | crawler + route handlers | Never expose to client |
| `CRAWLER_MODE` | control | crawler | `mock` or `live` |
| `VIEWTYPICK_MOCK_MODE` | control | crawler + revalidate API | `true` or `false` |
| `REVALIDATE_SECRET` | secret | `/api/revalidate` ISR endpoint | Set in Vercel + Actions |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | secret | sheet import | JSON string of service account |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | secret | sheet import | Sheet ID from URL |
| `DISCORD_WEBHOOK_URL` | secret | crawler alerts | Discord channel webhook |
| `COUPANG_ACCESS_KEY` | secret | Coupang adapter | Partners API |
| `COUPANG_SECRET_KEY` | secret | Coupang adapter | Partners API |
| `NAVER_CLIENT_ID` | secret | Naver adapter | Shopping Search API |
| `NAVER_CLIENT_SECRET` | secret | Naver adapter | Shopping Search API |
| `ADMIN_STATUS_USER` | secret | `/admin/status` | Basic auth username |
| `ADMIN_STATUS_PASSWORD` | secret | `/admin/status` | Basic auth password |
| `CRAWLER_USER_AGENT` | config | all HTTP requests | Default value in `.env.example` |
