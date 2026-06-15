# Ops Data Rollout — worklog

Operational rollout of the Naver-API / OliveYoung-via-Naver pipeline to the
remote (production) Supabase. Each phase: read-only audit → (backup + gate) →
execute → verify. Part 1 (sheet-import-dedup) merged as PR #11 (prerequisite).

Safety: read first, write later; destructive steps need backup + operator "go";
order `0006 → 0007` precedes all import/sync/recompute.

---

## Phase A — pre-rollout audit (READ-ONLY) — DONE 2026-06-15

Tool: `npm run ops:audit` (`scripts/ops/audit-phase-a.ts`) — selects only, zero writes.

### Row counts (remote)
| table | count |
|---|---|
| products | 47 (47 active) |
| listings | 54 (54 active) |
| badges | 1 |
| product_badges | 16 |
| price_snapshots | 7 |
| current_prices | 3 |

### Duplicate map
- duplicate `product_key`: **none**
- duplicate `link_key`: **none**
- suspected same product / different id (by normalized name): **none**
- **active listings sharing one `url` (count>1): 22 distinct URLs** — same
  affiliate/store link reused across many listings, e.g.
  `link.coupang.com/a/euTq778JA4` ×5; `brand.naver.com/dongwhafusidyne/...9999261730` ×3;
  `oy.run/g1ip6hEbG0GQsu` ×3; plus ×2 across coupang/naver/oy/zigzag/ably.
  This is the duplicate condition Phase D must drive to **0 rows**.

### Migration gap (remote)
- `price_snapshots.matched_url`: **missing**
- `price_snapshots.matched_mall_name`: **missing**
- `listings.latest_matched_url`: **missing**
- `crawl_method='naver_sourced'` rows: none (0007 not verifiable read-only)
- ⇒ **`0006` and `0007` are NOT applied to remote.** Hard prerequisite: the
  importer sets oliveyoung `crawl_method='naver_sourced'`, which the `0007`
  CHECK must allow, so migrations must be applied before re-import.

### Interpretation
- DB is "dirty" by the runbook's definition (shared URLs across listings).
- The fix path is correct: apply `0006 → 0007`, then re-import the cleaned
  canonical sheet. Part 1 dedup runs on the **sheet** (not the DB); reconcile
  then deactivates DB listings absent from the cleaned sheet, converging the DB
  and driving shared-URL duplicates to 0. This works **only if** the cleaned
  sheet itself has unique URLs per listing (operator confirmed sheet is cleaned).

---

## Phase B — remote migrations `0006 → 0007` — BLOCKED (awaiting DB connection string)

- Supabase CLI **is** available via `npx supabase` (v2.106.0). No local install/
  link needed if we use `db push --db-url <conn>`.
- Project ref: **`fttlbozyjvtuieznytda`** (from the public project URL subdomain).
- `.env` has `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` only — the
  service role key drives PostgREST (used for the read-only audit) but **cannot
  apply DDL / run pg_dump**.
- Single remaining gate: a **Postgres connection string** (direct or pooler,
  includes the DB password). Operator to add it to gitignored `.env` as
  `SUPABASE_DB_URL=postgresql://postgres:...@db.fttlbozyjvtuieznytda.supabase.co:5432/postgres`
  (or the pooler URL from Dashboard → Project Settings → Database). Never pasted
  in chat.
- Once provided, plan:
  1. **Backup first**: `npx supabase db dump --db-url "$SUPABASE_DB_URL" -f
     backups/pre-rollout-<ts>.sql` (or confirm dashboard PITR). Record location.
  2. **Inspect history before choosing apply method**:
     `npx supabase migration list --db-url "$SUPABASE_DB_URL"`. If remote history
     is in sync, `db push` is fine. If 0001–0003 were applied manually (no synced
     history), DO NOT `db push` (it would re-run `0001_init` and fail) — instead
     apply only the two needed files in a targeted, idempotent way (psql, or a
     one-off `--db-url` script): `0006_naver_api_matching.sql` then
     `0007_add_naver_sourced_crawl_method.sql`. Both use `IF NOT EXISTS` /
     `DROP CONSTRAINT IF EXISTS`, so targeted application is safe. (Audit shows
     0006 columns missing, so 0004/0005 state is also unverified — confirm during
     inspection.)
  3. Re-run `npm run ops:audit` to verify 0006 columns present + 0007 CHECK.

> STOP: no remote writes (migrations/backup/import/sync/recompute) until
> `SUPABASE_DB_URL` is provided. Per runbook §13, do not force arbitrary SQL.

---

## Phases C–G — pending Phase B.
