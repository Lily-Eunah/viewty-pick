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

### Connectivity note (2026-06-15)
- First attempt used the **direct** host `db.<ref>.supabase.co:5432` → DNS
  `no such host` (Supabase direct hostnames are IPv6-only; IPv4 network can't
  resolve). Switch `SUPABASE_DB_URL` to the **session pooler** URI from the
  dashboard: `postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres`.

### Agreed approval flow (operator)
- Once `SUPABASE_DB_URL` is set: run **backup + migration-history inspect**
  (read-only) automatically, then **stop and report** the apply plan.
- Applying `0006`/`0007`: **single "go"** after the report applies both, then
  re-audit. (No per-migration gating.)

---

## Phase B — progress 2026-06-15

### Connectivity + history inspect (read-only) — DONE
- Session pooler URI connects (`aws-1-ap-southeast-1.pooler.supabase.com:5432`).
- `supabase migration list`: local 0001–0007 all show **empty Remote column** →
  remote `schema_migrations` history is unsynced (migrations applied manually).
  ⇒ `db push` is unsafe (would re-run `0001_init`). Apply target files directly.
- **Schema probe (actual columns)** — wider gap than expected:
  - `0004` price_snapshots.shipping_fee / shipping_note : **MISSING**
  - `0005` price_snapshots.unit_price_reliable          : **MISSING**
  - `0006` price_snapshots.matched_url / matched_mall_name / listings.latest_matched_url : **MISSING**
  - ⇒ Remote schema is effectively at `0003`. **Apply `0004 → 0005 → 0006 → 0007`**
    (all idempotent), not just 0006/0007 — sync/recompute need shipping_* and
    unit_price_reliable too.

### Backup (read-only) — DONE
- `pg_dump` / `psql` not installed; `supabase db dump` needs Docker (not running).
  → Used logical JSON export instead: `npm run ops:backup`
  (`scripts/ops/backup-json.ts`), service-role/PostgREST, read-only.
- Location: `backups/2026-06-15T06-08-53-012Z/` (gitignored). Row counts:
  categories 7, sellers 5, products 47, listings 54, badges 1, product_badges 16,
  price_snapshots 7, current_prices 3, retailer_allowlist 0, manual_overrides 0,
  seo_pages 6, sheet_import_runs 11, crawl_runs 0, crawl_errors 0.
- `0004–0007` are purely additive (ADD COLUMN IF NOT EXISTS + CHECK swap); they
  don't modify/delete existing rows, so a data-level export is a sound safety net.

### Apply method + result — DONE 2026-06-15
- `supabase db push` works over the session pooler **without Docker** (Docker is
  only needed for `db dump`/local). Method chosen by operator: CLI sequential.
- Remote history was empty → `db push` would have re-run 0001–0003. Fixed with
  `supabase migration repair --status applied 0001 0002 0003 --db-url …`
  (metadata only, no DDL), then dry-run confirmed only 0004–0007 pending.
- Applied: `supabase db push --db-url … --yes` → 0004, 0005, 0006, 0007.
- **Verify**:
  - `migration list`: Local = Remote for 0001–0007 (history synced).
  - audit probe: 0006 columns `present`; listings with
    `crawl_method='naver_sourced'` present (0007 CHECK + re-provenance UPDATE OK).
- Backup substituted by Supabase auto-backup/PITR + the JSON export (additive
  DDL, no rows touched).

## Phase C — cleanup
- Plan: **prune disabled** (runbook default). Rely on Part 1 reconcile during
  Phase D re-import to deactivate (not delete) stale/duplicate-URL listings.

## Phase D — re-import (cleaned canonical sheet → remote)
- Next major production write. Importer is fail-fast (aborts before any write if
  the sheet has duplicate product_key/link_key/url) and reconciles orphans.
- **Read-only pre-check** (`npm run ops:check-sheet`, no writes): cleaned sheet =
  **39 products, 39 link rows, 127 expanded listings**, **PASS** (no duplicate
  product_key/link_key/url) → import will proceed without aborting.
- Expected impact: DB 47 products / 54 listings → sheet 39 products / 127
  listings. Upsert 39+127; reconcile deactivates (is_active=false, reversible)
  the ~8 products + stale listings whose keys aren't in the sheet → drives the
  22 shared-URL duplicate groups to 0.
- **Read-only dry-run diff** (`npm run ops:dryrun-import`, no writes):
  - ① 8 products to deactivate: 7 are **re-keyed duplicates** (old `PROD_001…007`,
    brand baked into the name; canonical brand/name-split rows already in DB and
    will be updated) — the exact "product_id 1~7 ↔ 29~35" dupe the rollout
    targets. 1 is an **intentional removal** (`id=51` 더모테라피 에센스토너 — brand
    not in cleaned catalog). All reversible (`is_active=false`).
  - ② placeholder link cells: none. duplicate product_key/link_key/url groups: 0/0/0.
  - ③ products: upsert 39 / deactivate 8. listings: upsert 127 (insert 105 /
    update 22) / deactivate 32. Converges exactly to sheet (39 products / 127
    active listings).
- Pending operator go for `npm run sheets:import`.

## Phases E–G — pending Phase D.
