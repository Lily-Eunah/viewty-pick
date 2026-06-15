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

## §2.4 trust-first — drop stale price on a no_offer transition
Found during pre-merge validation: after a priced→no_offer transition the public
view still showed the **stale** price. The 0008 view picked the latest
`status='ok'` row per listing, so when the newest snapshot was `no_offer` it fell
back to the previous `ok` price. §2.4 requires the opposite (no stale carry-over).

- **`0010_public_view_latest_ok_only.sql`** — redefine `listing_prices_public`:
  the `ok` row must also be the listing's **most recent** snapshot
  (`crawled_at = max`). If the latest observation is no_offer / failed / warning /
  low-confidence, the listing drops out (no stale fallback). Same columns /
  grants / `security_invoker=false` ⇒ safe `CREATE OR REPLACE`.
- **`lib/queries` `snapshotsToPublicPrices`** — mock parity: take each listing's
  LATEST snapshot, surface it only if that latest is displayable (was: filter
  displayable first, which resurrected stale).
- **`crawler/run.ts`** — when a product has no displayable (ok-latest) snapshot
  this run, **clear** `current_prices` (null `base_lowest_*`) instead of leaving
  the previous lowest in place.
- **`lib/queries/__tests__/publicPrices.test.ts`** — locks the parity:
  latest ok shows; priced→no_offer drops; no_offer→ok recovers; latest failed
  drops; inactive never shows.

This aligns the per-store view with the UI's own `isDisplayablePriceSnapshot`
gate (`status==='ok'`) and §2.4's explicit no-grace-window stance.

## Remote migration
0009 + 0010 applied via the existing gate (backup → `db push` over session
pooler). 0009 widens a CHECK; 0010 is a `CREATE OR REPLACE VIEW` — both
non-destructive, no data/RLS change.

## Pre-merge validation (remote, done)
Subset sync (`--only=p1sn8ibq` 스타라이크, real APIs) — one product gave a clean A/B:
- **listing 59 (OliveYoung, no-match → no_offer)**: pre-bumped `fail_count=2` →
  **reset to 0, stayed active** across 3 runs; no_offer snapshot logged once
  (transition), not re-logged after. **Dropped from the public view** (latest =
  no_offer, no stale 17000); `current_prices` for the product **cleared**.
- **listing 60 (Coupang, genuine fetch failure)**: `fail_count` 0→1→2→**3 →
  deactivated** (correct §4.4 staircase). NB: its URL is a `link.coupang.com/a/…`
  affiliate short-link that yields no productId → real fetch failure. This is a
  separate Coupang-adapter data-quality issue, intentionally **out of scope** here.
- Enum: `status='no_offer'` accepted, `'bogus'` rejected (23514).
- View row count 90→79 after 0010: the drop is 14 listings whose latest snapshot
  is a `warning` (correctly hidden by the `status='ok'` gate; they return on the
  next clean sync) + never-crawled listings (always absent). Every remaining view
  row verified `latest=ok`.
- Remote restored to baseline after validation (migrations retained).

## Why this matters next
With healthy listings no longer auto-deactivating, **daily cron scheduling
becomes safe**; once the cron runs, it accrues the **price-history asset** that
the chart / lowest-price badge (feature/public-price-view §6 future notes)
depend on. Scheduling itself is a separate step.
