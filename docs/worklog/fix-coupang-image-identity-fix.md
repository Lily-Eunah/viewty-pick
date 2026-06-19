# fix/coupang-image-identity-fix — worklog

Live bug: VDL / 아이소이 products showed a **third brand's photo** — 대라(DAERA) 스킨케어링
쿠션. Three independent causes, all in the Coupang image-fallback path (the price path
is untouched):

1. **identity ignored brand** — `passesImageIdentity` compared only the product *name*
   (e.g. "스킨케어 비건 쿠션", brand excluded). DAERA overlapped on generic tokens
   (스킨케어·쿠션) and on a distinctive substring (스킨케어 ⊂ 스킨케어링), so it passed.
2. **composition filter was poison for images** — the real 아이소이 hit (rank 0,
   "…비건 쿠션 21호 **본품+리필**") was rejected by `classifyOfferComposition().kind !==
   'single'`, so the correct product dropped out and DAERA's 단품 was adopted. For an
   IMAGE, a 본품+리필 / 기획세트 is the SAME product's photo — composition must not reject it.
3. **URL-keyed cache collision** — `resolveProductImages` de-duped by the raw
   `image_url` string, so when two different products shared one URL (operator typo) the
   URL was resolved ONCE (under whichever row came first) and applied to BOTH.

## Changes

### `crawler/adapters/coupang.ts`
- New `brandMatchTokens` + `brandMatchesTitle` — the candidate title MUST contain the
  product's **brand** (normalized, space-stripped substring — same tolerance as the
  official-mall brand check). Korean + parenthetical-English aliases (e.g.
  "아이소이(isoi)") are each accepted. **Empty brand ⇒ cannot pass** (safe side = leave
  unresolved → placeholder).
- `passesImageIdentity(title, name, brand)` — now requires `brandMatchesTitle` AND
  keeps `productIdentityScore ≥ 0.6` + `distinctiveTokens` + `!hasFormConflict`. The
  `classifyOfferComposition().kind !== 'single'` rejection is **removed** for images
  (본품+리필 / 기획세트 allowed). `hasFormConflict` stays — a different FORM (토너 ↔ 패드)
  IS a different photo, so it is still rejected. Dropped the now-unused
  `classifyOfferComposition` import.
- `pickCoupangImage(items, anchorProductId, productName, brand)` — threads `brand` into
  the fallback gate; the anchored-productId direct match (stage 1) is unchanged.
- `resolveCoupangImageFromUrl` — passes its existing `brand` into `pickCoupangImage`.

### `crawler/sheets/import.ts`
- New `imageResolveKey(raw, brand, name)` — the resolution map is now keyed **per
  product** (raw URL + brand + name), not per raw URL. One product's resolved image can
  no longer leak onto another that shares the same `image_url` cell; each is resolved
  with its own brand+name.
- `resolveProductImages` re-keyed accordingly + warns when one Coupang page URL is
  shared by >1 distinct product (likely operator typo).
- `resolveImageUrl(raw, brand, name, resolved)` — looks up by the composite key; both
  call sites (Supabase path + mock path) pass `p.data.brand` / `p.data.name`.

### `crawler/adapters/__tests__/coupang.test.ts`
- Fixture 12 calls updated for the new `brand` arg; the same-product bundle/set test now
  **expects adoption** (composition ignored for images).
- New Fixture 12b: DAERA-different-brand rejected while the real 아이소이 본품+리필 is
  adopted; different brand as the ONLY result → `null`; empty brand → `null`;
  parenthetical alias "아이소이(isoi)" matches; `hasFormConflict` (토너 ↔ 패드) still
  rejected even with a brand+identity match.

## Tests / build
- `test:coupang` — PASS (incl. all new cases). `test:all` — PASS (17 suites, 0
  failures). `tsc --noEmit` — exit 0. `eslint` — 0 errors (1 pre-existing unrelated
  warning). `next build` — PASS.
- No migration (logic-only fix on the existing image path). Price matching untouched.

## Rollout
Merge → `sheets:import` (re-resolves Coupang `image_url` products per-product) →
`crawler:sync` → live check: VDL anchor image correct, 아이소이 shows its own image,
DAERA no longer leaks, different-brand/unresolved cases fall back to placeholder →
`cf:deploy`.
