# fix/coupang-image-identity-guard — worklog

Live-QA bug: `pickCoupangImage`'s anchor-miss fallback took the **top search hit's
image with no identity check**, so a *different* product's photo could slip in
(엑설런트 선크림, productId 5529437152, was absent from search → a different
sunscreen's top-hit image was shown). The root cause was not "it fell back" but
"it fell back **without verifying identity**". The Partners API is **search-only**
(no productId/URL lookup; deeplink returns a tracking URL only), so an anchor miss
is structural — the fallback must exist, but **gated**.

## Change — `pickCoupangImage(items, anchorProductId, productName)`, 3 stages
1. **anchored** — exact `productId === anchorProductId` row's `productImage`
   (via `pickCoupangMatch`; identity not required — it IS the product).
2. **strict-identity fallback** — anchor missing → the TOP result whose
   `productName` passes `passesImageIdentity`, reusing the SAME pure gates as price
   matching:
   - `productIdentityScore ≥ 0.6` (the OY/Naver auto-price HIGH band),
   - a `distinctiveTokens` core token present,
   - `!hasFormConflict`,
   - `classifyOfferComposition().kind === 'single'` (bundle/set/multipack/gift out).
   The ONLY relaxation vs price is **volume** — the same product's other sizes show
   the same photo, so volume is not checked (allows another seller's listing image
   of the same product).
3. **otherwise `null`** → `resolveCoupangImageFromUrl` returns `''` → placeholder.
   A non-passing (= different) product's image is **never** used.

## Key principle
Images needn't be as strict as price, but a **different product is forbidden**.
Identity lets only the same product through (incl. another seller's listing image =
the correct image). Naver images are still never used (ToS/copyright); Coupang
Partners images are OK for affiliate display.

## Changes
- `crawler/adapters/coupang.ts` — import the price-matching pure gates from
  `./naver` (`productIdentityScore`, `hasFormConflict`, `distinctiveTokens`,
  `classifyOfferComposition`, `stripHtml`) + `stripPromoGifts`; new local
  `passesImageIdentity` + `IMAGE_IDENTITY_SIMILARITY = 0.6`; `pickCoupangImage` now
  takes the curated `productName` and applies the gate. `resolveCoupangImageFromUrl`
  passes `name` through (no import.ts change — its signature is unchanged).
- `crawler/adapters/__tests__/coupang.test.ts` — Fixture 12 rewritten: anchored;
  anchor-miss → same-product image (skips a higher-ranked wrong product);
  anchor-miss + only different products → `null` (엑설런트 regression);
  same-product bundle/set → `null`; no-image → `null`; empty → `null`.

## Tests / build
- `test:all` — PASS (15 suites, 0 failures). `tsc --noEmit` — exit 0.
  `eslint` (changed files) — 0 errors. `next build` — PASS.
- No migration (logic-only fix on the existing image path).

## Rollout
Merge → `crawler:sheets:import` (re-resolves the products carrying a Coupang URL in
`image_url`) / `crawler:sync` → live check: (a) resolved images are the RIGHT
product, (b) different-product/bundle cases fall back to placeholder → `cf:deploy`.
