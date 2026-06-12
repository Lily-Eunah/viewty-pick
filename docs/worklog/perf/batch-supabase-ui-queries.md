# Perf: Batch Supabase UI Queries

Branch: `perf/batch-supabase-ui-queries`
Date: 2026-06-12

## Root Cause

`getProducts()` in `lib/queries/index.ts` fired 8 Supabase requests **sequentially**
(one `await` per table). No `Promise.all`, no deduplication.

Additionally, the home page called `getRecommendedProducts()`, `getTodayBestPriceProducts()`,
and `getProducts()` as 3 separate calls in a single `useEffect` — each triggering
a full round of 8 sequential queries = **24 sequential Supabase requests per page load**.

The product detail page called `getProductBySlug()` twice (once in `generateMetadata`,
once in the page component) plus `getProducts()` for related products = **24 more**.

## Changes

### `lib/queries/index.ts`
- Extracted `fetchAllData()` — runs all 8 table queries with `Promise.all` instead of
  sequential awaits. Wrapped with React `cache()` so server components share a single
  fetch result per request (deduplicates `getProductBySlug` + `getProducts` on detail page).
- `getProductBySlug()` now calls `fetchAllData()` directly instead of calling
  `getProducts()` (avoids mapping all products just to find one).
- `getRecommendedProducts()` and `getTodayBestPriceProducts()` now sort from
  `getProducts()` result in-memory (no extra Supabase calls).

### `app/page.tsx`
- Removed 3 separate query calls in `useEffect`. Now calls `getProducts()` once and
  derives `recommended` (top by viewtyScore) and `bestDrops` (top price drops) in-memory.

## Before / After Request Counts

| Route                      | Before              | After              |
|----------------------------|---------------------|--------------------|
| `/` (home)                 | ~24 sequential      | 8 parallel         |
| `/c/sunscreen`             | ~9 sequential       | 9 parallel (1+8)   |
| `/p/[slug]`                | ~24 sequential      | 8 parallel (cached)|
| `/pick/directorpi/sunscreen`| ~9 sequential      | 9 parallel (1+8)   |
| `/skin/sensitive/sunscreen` | ~9 sequential      | 9 parallel (1+8)   |

Note: category/pick/skin pages still make 1 separate `getCategoryBySlug()` query
(1 targeted query) + 8 parallel `fetchAllData()` = 9 total. These pages are client
components, so `cache()` dedup doesn't apply across calls.

## Verification

- `npm run typecheck`: pass
- `npm run lint`: pass (0 errors, 2 pre-existing warnings)
- `npm run build`: pass — all routes compiled

## Manual Routes to Verify

- `http://localhost:3000/`
- `http://localhost:3000/c/sunscreen`
- `http://localhost:3000/p/p8veeo9`
- `http://localhost:3000/pick/directorpi/sunscreen`
- `http://localhost:3000/skin/sensitive/sunscreen`

## Files Changed

- `lib/queries/index.ts`
- `app/page.tsx`
- `docs/worklog/perf/batch-supabase-ui-queries.md` (this file)

## Remaining Opportunities (not in scope)

- Convert `app/page.tsx`, `/c/[category]`, `/pick`, `/skin` pages to server components
  to fully leverage `cache()` deduplication and eliminate client-side Supabase calls
- `getCategoryBySlug()` could be merged into `fetchAllData()` cache for server components
