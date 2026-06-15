# feature/failcount-semantics — worklog

Fixes a hard blocker for the daily cron: a legitimate **no-match** (a listing
with no qualified offer — e.g. tier-4 OliveYoung link-only, a product not on the
platform) was being treated as a **fetch failure** and incrementing
`listings.fail_count`. Every run pushed such listings up the DESIGN §4.4
staircase → 3 consecutive "failures" auto-hid them, 5 sent them to manual
inspection. Healthy listings were being auto-deactivated.

## Root cause
The pipeline collapsed two different results into one. The Naver / OliveYoung
adapters return `salePrice = null` on a legitimate no-match; `runHealthCheck`
Rule 1 ("missing price") then returns `status='failed'`; `run.ts` routed that to
`handleConsecutiveFailures` → `fail_count++`. So "search succeeded, no official
offer" was indistinguishable from "HTTP 500 / timeout / blocked".

## Fix — explicit 3-state outcome
`FetchOutcome = 'ok' | 'no_offer' | 'failed'`:

| outcome | condition | fail_count | listing |
|---|---|---|---|
| `ok` | qualified offer matched + priced | **reset 0** | active, snapshot `status='ok'` |
| `no_offer` | fetch succeeded, no qualified offer | **reset 0** (not a failure) | active, link-only |
| `failed` | thrown error (HTTP/timeout/block) **or** bad priced data (healthcheck `failed`) | **+1** (§4.4 staircase) | warn→alert→hide→manual |

**Invariant**: `fail_count` = consecutive *fetch* failures. Any successful fetch
(priced **or** no_offer) resets it to 0. Auto-deactivation only ever reacts to
`fail_count`, so a no-match can never deactivate a healthy listing.

## Changes
- **`crawler/adapters/index.ts`** — `FetchOutcome` type + optional `outcome` on
  `PriceOffer`.
- **adapters** — `naver.ts` / `oliveyoung.ts` set `outcome:'no_offer'` on every
  no-match return (and tier-1 hidden), `outcome:'ok'` on priced returns.
  `coupang.ts`: a 200-but-empty result now returns `no_offer` instead of throwing
  (HTTP/timeout errors still throw → `failed`).
- **`crawler/core/normalize.ts`** — `applyManualOverrides` sets `outcome:'ok'`
  when a manual price is asserted (OliveYoung tier-3: no_offer → ok).
- **`crawler/core/healthcheck.ts`** — new pure `resolveListingOutcome(listing,
  outcome)`: `ok`/`no_offer` → reset; `failed` → delegate to
  `handleConsecutiveFailures`. Single source of truth for the semantics.
- **`crawler/run.ts`** — after `applyManualOverrides`, classify outcome.
  `no_offer` short-circuits before healthcheck: reset fail_count, keep active,
  record a `status='no_offer'` snapshot on first-observation/transition only (no
  daily bloat for steady-state link-only), and if the listing **had a price last
  run** drop it (trust-first, no stale carry-over) and add a daily-summary INFO
  line. Both `failed` paths (thrown + healthcheck-failed) go through
  `resolveListingOutcome(…, 'failed')`; the thrown path now also alerts at the
  notify stages.
- **`supabase/migrations/0009_no_offer_snapshot_status.sql`** — extend
  `price_snapshots.status` CHECK to include `'no_offer'`. `PriceSnapshotStatus`
  type updated.
- **`crawler/core/notify.ts`** — `sendDailySummary` gains a **No offer (info)**
  count and a **"offer disappeared"** info section. Coverage gaps are info;
  `FETCH_FAILED` stays on the critical-alarm path. No false failure alerts.

## Exposure / safety
`no_offer` rows (null prices) never surface: the public view (0008) filters
`status='ok'`, and `run.ts` price aggregation accepts only `status` ok/warning.
So `current_prices` and the anon view are unaffected — no leak, no stale price.

## Tests
`crawler/core/__tests__/failcount.test.ts` (wired into `test:all`):
- **no-match never deactivates**: 10× consecutive `no_offer` → fail_count 0, active (the regression guard).
- **fetch failures stage**: 1/2/3/5 → warn / alert / deactivate / manual.
- **mixed**: failures then a success (priced *or* no_offer) → fail_count resets to 0.
- parity: `resolveListingOutcome('failed')` == `handleConsecutiveFailures`.

## Verification
- `lint` (0 errors, 1 pre-existing img warning), `typecheck`, `test:all` (incl. 11 new failcount cases), `build` — all pass.
- Mock pipeline (`crawler:test`) runs clean; new summary line renders (`No offer (info)` + disappeared count). Mock fixtures are all priced → 0 no_offer there; the no_offer path is covered by unit tests and the pre-merge limited real sync below.

## Remote migration
0009 to be applied via the existing gate (backup → `db push` over session pooler),
reported for a single operator "go" before execution. It only widens a CHECK
constraint — non-destructive, no data/RLS change.

## Pre-merge validation (recommended, §5)
Limited real sync (`--only=<keys>` incl. a known no-match + a forced failure):
confirm no-match listings keep fail_count flat, real failures stage, and the
public view still shows only `status='ok'`.

## Why this matters next
With healthy listings no longer auto-deactivating, **daily cron scheduling
becomes safe**; once the cron runs, it accrues the **price-history asset** that
the chart / lowest-price badge (feature/public-price-view §6 future notes)
depend on. Scheduling itself is a separate step.
