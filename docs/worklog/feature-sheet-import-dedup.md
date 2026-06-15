# Worklog — feature/sheet-import-dedup

Part 1 of the ops-data-rollout runbook: make sheet re-import safe against
duplicates **before** any remote (production) data operations. This branch is a
prerequisite for the Part 2 operational rollout.

## Implemented

### 1. Fail-fast duplicate detection (`crawler/sheets/validate.ts`, `import.ts`)
- `detectSheetDuplicates(rawProducts, rawLinks)` flags:
  - **duplicate `product_key`** — more than one product row resolving to the same
    key (whether identical rows or two distinct products colliding on one key);
  - **duplicate `link_key`** — same seller+product listed in more than one
    `product_links` row;
  - **duplicate `url`** — one url reused across multiple listings.
- `import.ts` calls it after loading raw sheet data and **aborts before any
  write** if duplicates are found, logging a `formatDuplicateReport` conflict
  report and recording a `failed` `sheet_import_runs` row (Supabase path).
- Root cause this guards against: a dirty sheet (same product seeded under two
  key schemes, one url under multiple link_keys) silently recreating DB
  duplicates on re-import.

### 2. Centralized key derivation (single source of truth)
- `makeProductKey`, `buildNameToKey`, `expandListings` (+ `FlatListing`, `Seller`)
  moved into `validate.ts` and reused by both the importer and the duplicate
  detector, so the two can never drift on how keys/listings are derived.

### 3. Idempotent upsert (confirmed) + orphan reconcile (`import.ts`)
- Upserts already key on `product_key` (products), `link_key` (listings),
  `(product_id, badge_id)` (badges) — verified idempotent (re-import of the same
  sheet does not insert duplicates).
- **Reconcile**: after upserts, DB products/listings whose key is absent from the
  current sheet are set `is_active=false` (no hard delete), so re-import converges
  the DB to the sheet and stale rows drop out. Implemented for both the Supabase
  and mock-DB paths via the pure helper `computeOrphanKeys`.
- Deactivation counts recorded in `ImportStats` and `sheet_import_runs.summary`.

## Changed files
- `crawler/sheets/validate.ts` — shared key helpers, `detectSheetDuplicates`,
  `hasDuplicates`, `formatDuplicateReport`, `computeOrphanKeys`.
- `crawler/sheets/import.ts` — fail-fast dedup gate, shared-helper refactor,
  orphan reconcile (Supabase + mock), deactivation stats.
- `crawler/sheets/__tests__/dedup.test.ts` — new fixture tests.
- `package.json` — `test:sheets` script wired into `test:all`.

## Tests
- `npm run test:sheets` — duplicate product_key/link_key/url detection,
  clean-sheet pass, re-import idempotency (deterministic expansion, stable
  link_key), orphan reconcile. All pass.
- `npm run lint` — clean (1 pre-existing unrelated `<img>` warning in
  `ProductImage.tsx`).
- `npm run typecheck` — clean.
- `npm run test:all` — all 7 suites pass.
- `npm run build` — succeeds.

## Notes / TODO
- This branch only makes re-import safe; it does **not** touch remote data.
- Reconcile deactivates (never hard-deletes). Hard removal of test junk, if
  desired, is a gated Part 2 Phase C step (backup + operator "go").
- **Precondition for Part 2**: the Google Sheet must be cleaned to one canonical
  row per product first. With dedup in place, a dirty sheet now fails the import
  loudly instead of silently duplicating — but it still must be cleaned to import
  successfully.
