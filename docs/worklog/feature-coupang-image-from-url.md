# feature/coupang-image-from-url — worklog

Resolve a **Coupang product-page URL** placed in `products.image_url` to the
product's real `productImage` (via the Partners search API) at import time, and
store THAT as the display image. Operators use this for products whose
representative image we otherwise lack (e.g. Coupang is not the official seller):
they paste a good Coupang product URL into `image_url`, and import turns it into a
usable image. Stored verbatim, a product-page URL renders broken → placeholder;
this closes that gap.

## Why import (not a sheet write-back)
`products.image_url` is written DB-side during `sheets:import`, and
`resolveDisplayImage` already ranks operator `image_url` first (→ Coupang listing
→ placeholder). So import is the natural place to translate the sheet value. The
**sheet keeps the Coupang URL unchanged** — every import re-resolves, which keeps
the rotation-prone Coupang image URL fresh and avoids writing a soon-stale image
back to the sheet.

## Behavior
1. **Classify** `products.image_url` (`isCoupangProductPageUrl`):
   - direct image URL (`.jpg/.png/.webp/…` or the `ads-partners.coupang.com`
     productImage host) → **used as-is** (regression-safe),
   - Coupang product-page URL (`coupang.com/.../products/{id}`) → **image source**,
   - anything else → left as the operator's value (pass-through).
2. **Resolve** (`resolveCoupangImageFromUrl`): extract productId → Partners SEARCH
   (keyword = brand + name, the same builder as price matching) →
   `pickCoupangImage`:
   - anchored productId row's `productImage` if present, else
   - **top-hit `productImage`** fallback (identity is lenient for images — the same
     product under a different productId still shows the same image; unlike PRICE,
     which is strictly anchored), else null.
3. **Store** the resolved `productImage` in DB `products.image_url`. **Never** the
   product-page URL.
4. **Fail closed**: unresolved (search miss / no image / no productId / HTTP-timeout
   / mock-test) → store `''` → placeholder fallback. A broken product-page URL never
   reaches an `<img>`.

## Constraints (honest)
- Partners API is **search-only** (no `GET products/{id}`): a product absent from
  the search top-10 can't be resolved → placeholder. Same limit as price matching.
- Rate limit reused from the adapter (≤30/min, 2s spacing). One search per distinct
  image_url; resolution is de-duplicated by raw URL.

## Changes
- **`crawler/adapters/coupang.ts`** — new exported, reusable helpers:
  `looksLikeImageUrl`, `isCoupangProductPageUrl`, `pickCoupangImage`,
  `resolveCoupangImageFromUrl` (reuses the rate-limited, HMAC-signed `searchCoupang`
  + the same mock/test guard as `fetchOffer`).
- **`crawler/sheets/import.ts`** — `resolveProductImages` pre-pass (shared by the
  Supabase and mock paths, de-duped by raw URL) + `resolveImageUrl` to compute the
  stored value. Both product upserts now write `resolveImageUrl(...)` instead of the
  raw `image_url`.

## Tests / build
- `crawler/adapters/__tests__/coupang.test.ts` — Fixture 11 (image_url
  classification: product-page vs `.jpg` vs `ads-partners` host vs non-coupang vs
  empty) and Fixture 12 (`pickCoupangImage`: anchored, top-hit fallback, no-image →
  null, empty → null).
- `test:all` — PASS. `tsc --noEmit` — PASS (exit 0). `eslint` (changed files) — 0
  errors. `next build` — PASS. (Pre-existing `.open-next`/`scripts/ops` lint noise is
  unrelated generated-artifact output.)

## Rollout
Merge → `crawler:sheets:import` (resolves the ~34 products that already carry a
Coupang product URL in `image_url`) → `crawler:sync` → confirm images appear on the
unofficial-Coupang products (라하토너 · 레스트업 · 온그리디언츠 등) → `cf:deploy`.
No migration (reuses existing `products.image_url` + `resolveDisplayImage`).
