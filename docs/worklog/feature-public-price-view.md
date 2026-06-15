# feature/public-price-view — worklog

Fixes the Phase-G blocker: per-store prices did not render on the public detail
page because the UI read them straight from `price_snapshots`, which is
anon-locked (DESIGN §13, batch-only raw history) → anon got 0 rows.

Solution = **option C**: keep the raw table locked, expose a safe **public
projection view** (`listing_prices_public`) and point the UI at it. Option A
(anon SELECT policy on the raw table) was rejected — RLS filters rows, not
columns, so it would leak `source_text` / `status` / `parse_confidence` and the
batch-internal history, violating DESIGN intent.

## Changes

### DB — migration `0008_public_price_view.sql`
- Index `idx_price_snapshots_listing_crawled (listing_id, crawled_at desc)` for the
  latest-per-listing lookup.
- View `public.listing_prices_public` `with (security_invoker = false)`:
  - `distinct on (listing_id) … order by listing_id, crawled_at desc` → **latest
    snapshot per listing**.
  - `join listings on is_active` + `where status='ok' and parse_confidence='high'`
    → only **displayable** rows (comparison-exclusion policy).
  - `case when unit_price_reliable then unit_price end` → §1 volume compromise:
    unreliable ml unit price is NULL; `base_unit_price`/`effective_unit_price`
    stay visible.
  - Exposes ONLY safe columns: `listing_id, product_id, seller_id, sale_price,
    base_unit_price, effective_unit_price, unit_price, promo_type, promo_text,
    in_stock, shipping_note, matched_mall_name, crawled_at`. Internal fields
    (`source_text, status, parse_confidence, regular_price, shipping_fee,
    matched_url, id, unit_price_reliable, total_*`) are not selected.
  - `grant select … to anon, authenticated`.
- **RLS on `price_snapshots` is untouched** — anon stays at 0 rows there.

### UI — `lib/queries/index.ts` + `lib/types.ts`
- New type `PublicListingPrice` mirroring the view row.
- `getProducts()` Supabase path now reads `listing_prices_public` instead of
  `price_snapshots`; mock path mirrors the view via new helper
  `snapshotsToPublicPrices()` (collapses raw mock snapshots to latest displayable
  per listing).
- `mapToUIProduct()` builds the per-store list from the view rows (already one
  row per listing); still drops `in_stock === false` (view exposes but does not
  filter it). Buy-link priority `affiliate_url → latest_matched_url` is unchanged
  — handled by `/go/[listingId]`.
- Home/list summary path (`current_prices`) is untouched: role split stays
  **summary = current_prices, per-store = this view**.

### Test — `scripts/live-check/live-check-price-view.ts` (`npm run live-check:price-view`)
LIVE check (needs remote keys, not CI): asserts (1) anon reads the view, (2) anon
still sees 0 raw `price_snapshots`, (3) only the safe columns are present / no
forbidden internal column leaks, (4) one row per listing + no unreliable
`unit_price` exposed (cross-checked vs the raw flag via service role).

## Security note
The view is `security_invoker = false` (owner-rights), which intentionally
bypasses the raw table's RLS — that is the entire mechanism of the safe
projection. Supabase advisor will flag it as a **"security definer view"**. This
is **accepted and intended**: the view is a curated, anon-safe read surface
(latest + safe columns + displayable rows only); the sensitive raw table remains
anon-locked. Column-level safety is enforced by the explicit SELECT list, which
RLS alone cannot do.

## Verification
- `lint` (0 errors, 1 pre-existing img warning), `typecheck`, `test:all`, `build` — all pass.
- Mock path: `getProducts()` → 13/13 products render ≥1 store
  (e.g. 레드 블레미쉬 클리어 수딩 크림 → 쿠팡=15000, 올리브영=21900).
- Remote (post-apply): run `npm run live-check:price-view` → expect anon view read
  returns the ~33 priced rows, raw `price_snapshots` = 0 for anon.

## Remote migration
0008 applied to remote via the existing gate (backup first → session-pooler
repair/push), reported for single operator "go" before execution.

## Status / follow-ups
- DoD: per-store prices render via the view; raw table stays anon-locked (0);
  view = latest + safe columns + displayable + volume compromise.
- **tier-4 OliveYoung link-only** still does not render (§7.4 not implemented) —
  expected, separate follow-up.
- Future (structure-compatible, not built now): sibling history view
  `listing_price_history_public` (windowed series, same safe-column/filter/grant
  pattern) for price charts; `lowest_30d`/`is_lowest` summary on `current_prices`
  for a "lowest-price" badge. Both depend on daily-cron stability (fail_count fix)
  and sync writing a snapshot every day even when price is unchanged (chart
  continuity); history is not backfillable.
