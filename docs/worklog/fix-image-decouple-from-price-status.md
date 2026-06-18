# fix/image-decouple-from-price-status — worklog

Live-QA bug: when a Coupang price was held in **warning → inspection** (e.g. ml/용량
mismatch) and therefore hidden, the Coupang listing's **image disappeared with it**.
Root cause: `resolveDisplayImage` sourced its Coupang fallback image from the
**ok-only public price view** (`listing_prices_public` / `dbListingPrices`). A
warning/inspection-held listing drops out of that view (§2.4 trust-first price gate),
so its `image_url` went with it — even though the listing row itself still carries a
perfectly good cached image.

Desired behavior: **price stays ok-only, image is decoupled from price status.** A
warning-priced Coupang listing hides its price but still shows its image.

## Change
- `lib/queries/index.ts` — `resolveDisplayImage` now reads the Coupang image from the
  **listing row's `latest_image_url`** (status-independent; cached by the crawler at
  match time, `crawler/run.ts:377`, *before* the failed/warning/ok branch), NOT from
  the ok-only public price view.
  - Signature changed: `(operatorImageUrl, productId, listings: Listing[], sellers)`
    (was `listingPrices: PublicListingPrice[]`).
  - Precedence unchanged: **operator `products.image_url` → Coupang listing
    `latest_image_url` → placeholder (`''`)**.
  - Gate retained: only the product's **active** Coupang listing's image is used; a
    non-Coupang seller's image is never a fallback.
- `mapToUIProduct` — call site now passes `dbListings` instead of `dbListingPrices`.
  `dbListings` already carries `latest_image_url` on both the Supabase path
  (`select('*')`) and the mock path.

## Not touched (by design)
- **Price exposure stays ok-only.** `snapshotsToPublicPrices` /
  `isDisplayablePriceSnapshot` and every price-rendering path are unchanged — this
  fix touches the image source only. The image fallback never resurrects a non-ok
  price. The now-unused `image_url` passthrough on the public view is left in place
  (harmless; removing it would be an unrelated price-path change).

## Tests / build
- `lib/queries/__tests__/publicPrices.test.ts` — `resolveDisplayImage` cases
  rewritten to drive off `Listing.latest_image_url`: operator wins; Coupang listing
  image used when operator empty; **image shows even when price is warning/inspection
  (decoupled)**; non-Coupang image not used; **inactive** Coupang listing image not
  used; placeholder when none.
- `test:all` — PASS (15 suites, 0 failures). `tsc --noEmit` — exit 0.
  `eslint` (source) — 0 errors. `next build` — PASS.
  - Note: `npm run lint` reports errors only inside the stale, gitignored
    `.open-next/` build artifact (not source); eslint config ignores `.next`/`out`/
    `build` but not `.open-next`. CI on a clean checkout is unaffected.
- No migration (read-time display logic only; `latest_image_url` already exists,
  migration 0011).

## Rollout
Merge → `cf:deploy` → live check: (a) a warning-priced Coupang product shows its
image (not the placeholder), (b) its price is still hidden, (c) ok-priced and
operator-`image_url` products are unchanged (regression 0).
