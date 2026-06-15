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
### Phase D result — DONE 2026-06-15
- `npm run sheets:import` (operator go): fetched 39 products / 39 link rows / 39
  badges → upsert 39 products, 127 listings, 39 badges; **0 errors**. Reconcile
  deactivated 32 listings + 8 products (as dry-run predicted).
- **Verify**:
  - active: products=39, listings=127 (= sheet). Totals: products 47 (8 inactive),
    listings 159 (32 inactive) — deactivated rows preserved, not deleted.
  - duplicate map: active listings by url = **0 rows** ✅; by link_key = 0;
    products by product_key = 0; same-name different-id = 0.
  - idempotency: re-running `ops:dryrun-import` → 0 insert / 0 deactivate /
    127 update (upserts stable).
- Phase D Definition of Done (duplicate 0 / sheet-DB parity) met.

## Phase C — n/a (prune disabled; reconcile converged DB as planned).

## Phase E — limited live sync — DONE 2026-06-15

- Added scoped subset mode to `crawler/run.ts`: `--only=<keys>` (scopes ALL
  writes to the subset), `--skip-import`, `--max-coupang=N`, `--no-notify`.
- Ran: `crawler:sync --only=p8veeo9,p1xe9jfw,p4yux6n,p1iafa5k,p7eg0l0
  --skip-import --max-coupang=1 --no-notify` (몽디에스, 조선미녀, 넘버즈인, 아로셀,
  이니스프리). 5 products / 16 listings.
- **Verify** (price_snapshots 7 → 13, +6):
  - matched_url + matched_mall_name populated on all 6 (0006 fields work).
  - OliveYoung tier-2 (price via Naver): 조선미녀 14400, 넘버즈인 24900 (mall=올리브영).
  - OliveYoung tier-4 gap: 이니스프리 OY — no Naver OY offer → no price (link_only),
    as designed.
  - Volume compromise (§1): 아로셀 OY status=warning, unit_price_reliable=false,
    price kept (25000); base/effective stay comparable, ml unit excluded.
  - parse_confidence=high on successes. Naver mismatches (몽디에스, 넘버즈인 naver)
    failed gating (no price shown) — correct (DESIGN #4).
  - current_prices updated for 4 subset products (아로셀 base=10900 네이버 < OY 25000;
    조선미녀/넘버즈인=올리브영; 이니스프리=네이버). 몽디에스 none (both listings failed).
  - **Subset isolation confirmed**: non-subset current_prices retain 2026-06-12
    timestamp — untouched. Discord suppressed.
- Coupang: short-link URLs (`link.coupang.com/a/...`) can't yield a product id →
  coupang failed for the 1 attempted; cap worked (others skipped). Coupang
  coverage is a separate data issue (sheet has share links, not product URLs).

### Follow-ups (non-blocking)
- `crawl_runs` never populated (0 at Phase A and after run): `run.ts` inserts
  `started_at: Date.now()` (epoch ms) into timestamptz with an unchecked insert
  error → silent no-op. Fix: ISO string + check error. (pre-existing)
- 3 stale `current_prices` rows on now-deactivated products 1–3 (harmless; UI
  shows active only). Optional cleanup.
- OliveYoung tier-4 UI (link-only) still not rendered (§7.4 runbook follow-up).

### Follow-up (BLOCKING for daily automation): fail_count vs legitimate no-match
- `healthcheck.ts` Rule 1 marks any null sale_price as `status='failed'`. A tier-4
  OliveYoung link-only (curator URL, no Naver offer) and a legitimate Naver
  no-match are indistinguishable from a real fetch failure → `fail_count++`.
- `handleConsecutiveFailures`: fail 3 → `is_active=false`. So a legitimately
  link-only/no-match listing **auto-deactivates after 3 consecutive daily runs.**
- Single manual run is safe (each listing +1 only: 0→1). **Must fix before daily
  scheduling**: add a distinct `link_only`/`no_offer` status that does not
  increment fail_count (and exclude tier-4 OY / Naver-no-match from the failure
  path). Until fixed, do NOT enable daily automation.

## Phase F — current_prices recompute (full sync)
- Estimate from 5-product sample (small n): Naver match ~60%, product-has-price
  ~80% → ~31/39 with a price, ~8 link-only/no-price.
- Running `crawler:sync --skip-import --max-coupang=0` (coupang fully skipped —
  share-link URLs can't yield a product id and would pollute fail_count; Discord
  summary ON) over all 39 products / 127 listings, in background.

### Phase F result — DONE 2026-06-15
- Full `crawler:sync --skip-import --max-coupang=0` completed in 47.8s, exit 0.
  Run summary: 127 links → 50 OK / 8 warning / 52 failed (rest skipped = coupang
  + zigzag/ably no-adapter).
- **Verify**:
  - active products=39, active listings=127 (unchanged — nothing wrongly dropped).
  - price_snapshots total=63.
  - **matched (has displayable price)=33/39 (85%)**; unmatched/link-only=6.
  - **duplicate active URLs = 0** (still clean post-sync).
  - fail_count distribution: 0:140, 1:16, 2:3 — **0 listings deactivated by
    fail_count>=3** (single run safe, as predicted).
  - current_prices: healthy 네이버/올리브영 mix, several +promo.
- 6 unmatched (no Naver offer → link-only, correctly no price): 몽디에스, 후시다딘,
  스타라이크, 이지앤트리, 랑콤(스킨이돌3), 미샤 → manual_override / sheet-URL follow-up.
- **Discord caveat**: notify ran but as `[Discord Notification (Mock)]` — module
  is mocked in this env; no real webhook fired. Verify webhook config separately.

## Phase G — e2e verify — DONE 2026-06-15 (found a blocker)
- Ran `next start` (prod build) and fetched product detail pages
  (`/p/p1xe9jfw` 조선미녀, `/p/p1iafa5k` 아로셀, `/p/p8veeo9` 몽디에스).
- Renders OK: the 갱신/결제가 caveat ("갱신 기준: 매일 KST 04:00 … 실제 가격은 판매처
  정보와 상이할 수 있습니다"), layout, headers.
- **BLOCKER — no prices/buy-links render**: every product shows "현재 구매 가능한
  활성 판매처가 없습니다". Root cause: `0002_rls.sql` enables RLS on
  `price_snapshots` with **no anon read policy** (deliberate, per its note), but
  `mapToUIProduct` builds the per-store cards **from `price_snapshots`** read via
  the anon client. Confirmed live: anon reads products=39, listings=127,
  current_prices=36, but **price_snapshots=0** (RLS). So store list is always
  empty for the public.
  - Pre-existing (RLS + mapper predate this rollout; snapshots were never
    anon-visible) — surfaced now that Phase G expects prices to show.
  - Fix options (operator decision; production RLS/code change → via PR + gate):
    (A) add anon SELECT policy on price_snapshots (e.g. `USING (status='ok')`) —
        fastest; exposes snapshot rows publicly (low sensitivity — they're prices
        we display anyway).
    (B) refactor mapper to source per-store prices from an anon-readable source —
        current_prices only has aggregate lowest, not per-store, so needs more.
    (C) cleanest: a public view exposing only the latest displayable snapshot per
        active listing, granted to anon; point the mapper at it. (migration + query)
  - Recommend (A) for an immediate working site, (C) as the durable fix.
- Known limitation (runbook §7.4) still stands on top of the above: tier-4
  OliveYoung link-only UI not implemented (mapper drops snapshot-less listings).

## Outstanding follow-ups
0. **BLOCKING for the public site showing ANY price**: `price_snapshots` is not
   anon-readable (RLS) but `mapToUIProduct` reads per-store prices from it →
   product pages show "no active sellers". See Phase G. Fix via PR (option A/C).
1. **BLOCKING for daily automation**: fail_count vs legitimate no-match/link-only
   (auto-deactivation after 3 runs) — see Phase F note above.
2. Tier-4 OliveYoung link-only UI (§7.4).
3. 6 link-only products → manual_override or fix sheet URLs.
4. Coupang URLs in sheet are share-links → can't extract product id; need real
   product URLs before coupang prices work.
5. crawl_runs never populated (started_at epoch-ms + unchecked insert error).
6. Discord webhook is mocked in this env — confirm real delivery before relying on it.
7. 3 stale current_prices on deactivated products 1–3 (optional cleanup).
