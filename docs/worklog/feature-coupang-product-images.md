# feature/coupang-product-images — worklog

Displays a product image on the list cards and detail page, using the Coupang
Partners `productImage` as a **fallback** behind the operator-owned
`products.image_url`. Separate feature from the price adapter (its own branch/PR).

## Compliance premise (operator-confirmed)
- Coupang Partners `productImage` (host `ads-partners.coupang.com`) is provided for
  members to display on their own site → OK to use, **including as the
  representative list/detail image**. The compliance anchor is the **Coupang
  Partners disclosure**, which must appear on any page showing a Coupang image/link
  (DESIGN §12).
- No AI-generated fake product images / detail-page captures.

## Data flow / separation
- **`products.image_url` is sheet-owned (operator) and never overwritten by the
  crawler** — it is the source of truth and takes precedence.
- Coupang image is a **crawler-derived fallback**, stored separately and layered at
  read time:
  > display image = `products.image_url` (operator) → Coupang `productImage`
  > (derived) → placeholder.

## Changes
- **`supabase/migrations/0011_product_image.sql`** — add `price_snapshots.image_url`
  (per-observation) + `listings.latest_image_url` (latest cache), and CREATE OR
  REPLACE `listing_prices_public` with `image_url` appended last (additive,
  non-destructive; grants/filter/security_invoker unchanged). Types updated
  (`PriceSnapshot`, `Listing`, `PublicListingPrice`).
- **adapter** — `PriceOffer.imageUrl`; `parseCoupangItem` sets it from
  `item.productImage`. `run.ts` writes `snapshot.image_url` and caches
  `listings.latest_image_url` (alongside `latest_matched_url`) in both save paths.
- **`lib/queries`** — `resolveDisplayImage(operator, productId, listingPrices,
  sellers)`: operator → Coupang (from the public view) → `''`. `mapToUIProduct`
  feeds the result into `UIProduct.image` (consumed by existing cards/detail).
  `products.image_url` is untouched. Mock `snapshotsToPublicPrices` carries
  `image_url` for parity.
- **disclosure** — `components/common/CoupangPartnersNotice.tsx` rendered site-wide
  via `AppShell` (covers every page that can show a Coupang image/link). The
  conditional inline disclosure added on the detail page in the price-adapter PR is
  consolidated into this component.

## next/image decision (deviation from prompt §5, reported)
The codebase renders product images with a plain `<img>` (`ProductImageWithFallback`:
`http`-check + `onError` → `CosmeticPlaceholderIcon`). `next/image` is used nowhere
in app code, so `images.remotePatterns` would be a **no-op** and converting all
image rendering to `next/image` is a separate, risky refactor (sizing/layout). We
therefore keep `<img>` — Coupang images at `ads-partners.coupang.com` render
directly and broken/expired URLs fall back to the placeholder (DoD #4 met).
Recorded host for whenever `next/image` is adopted: **`ads-partners.coupang.com`**.

## Tests / build
- `test:all` — PASS, incl. new cases: `resolveDisplayImage` precedence
  (operator > coupang > placeholder; non-coupang not used), `image_url` passthrough
  in `snapshotsToPublicPrices`, and `productImage → imageUrl` capture.
- `tsc --noEmit` — PASS. `eslint` — 0 errors. `next build` — PASS.

## Migration 0011 remote apply (gate)
Additive + non-destructive (2 nullable columns + CREATE OR REPLACE VIEW). Apply to
remote via the existing gate (backup → session-pooler push) **before** the next
crawler run / deploy, since the crawler writes the new columns. Plan reported for a
single go-ahead before running.
