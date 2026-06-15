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

## Phase B — remote migrations `0006 → 0007` — BLOCKED (awaiting access)

- Supabase CLI not installed and project not linked (no `supabase/config.toml`).
- `.env` has `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` only — the
  service role key drives PostgREST (used for the read-only audit) but **cannot
  apply DDL / run pg_dump**.
- To proceed (operator chose "install + link Supabase CLI") we need:
  1. **Supabase access token** (`SUPABASE_ACCESS_TOKEN`) for `supabase login`.
  2. **DB password** for `supabase link --project-ref <ref>` / `db push`.
  3. Project ref (derivable from the project URL subdomain — to be confirmed).
- **Backup first** (Phase B requirement) also needs DB access: `supabase db dump`
  / pg_dump of `listings`, `price_snapshots`, `current_prices`,
  `retailer_allowlist`, or confirm dashboard backup/PITR. Backup location TBD.

> STOP: no remote writes (migrations/backup/import/sync/recompute) until the
> above access is provided. Per runbook §13, do not force arbitrary SQL.

---

## Phases C–G — pending Phase B.
