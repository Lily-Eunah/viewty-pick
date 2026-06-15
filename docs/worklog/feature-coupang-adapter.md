# feature/coupang-adapter — worklog

Activates the Coupang leg of the 3-platform comparison (올영/네이버/**쿠팡**).
Coupang prices come from the **Partners search API**, anchored to the
**productId in the listing's product-detail URL**; the buy link is the
**affiliate deeplink the search response already returns** (`productUrl`). Fixes
the listing-60 class of bug where a `link.coupang.com/a/…` share short-link was
treated as a fetch failure and auto-deactivated.

## Real-API facts (confirmed by `scripts/live-check/live-check-coupang.ts`)
These pinned the design — no guessing (prompt §8):
- **HMAC `signed-date` must be `yyMMdd'T'HHmmss'Z'`** (literal `T`/`Z`). The old
  adapter stripped them → HTTP 401. Fixed.
- **There is NO `GET products/{id}` price endpoint** (404). The only price source
  is the **search API** (`/v2/providers/affiliate_open_api/apis/openapi/v1/products/search?keyword=…&limit=20`).
- The search item exposes **`productPrice`** (NOT `price`), **`isRocket`**,
  **`isFreeShipping`**, and **`productUrl`** (an affiliate deeplink). The parser
  reads `productPrice` and falls back to legacy `price` for old fixtures.

## Behaviour
| listing url | action | outcome | fail_count | listing |
|---|---|---|---|---|
| `…/vp/products/{id}` + productId in search results | priced | `ok` | reset 0 | active, snapshot `ok` |
| `…/vp/products/{id}` + productId NOT in results | search OK, no match | `no_offer` | reset 0 | active, link-only |
| `link.coupang.com/a/…` / no productId | **no API call** | **`data_error`** | **reset 0** | active, link-only |
| HTTP error / timeout | thrown | `failed` | **+1** (§4.4 staircase) | warn→alert→hide→manual |

`data_error` is a new 4th `FetchOutcome`: the listing's own data is unusable
(operator must fix the sheet URL), so no fetch is attempted, `fail_count` never
increments, and the listing stays active. It is surfaced in the **daily summary**
under "데이터 오류 (시트 URL 수정 필요)" for the operator to act on. For
fail_count/active/snapshot/stale-drop it behaves exactly like `no_offer`.

## Deeplink — no separate API call (decision)
The search response's `productUrl` is already an affiliate deeplink, so on a
priced match the adapter sets `matchedUrl = productUrl`, which `run.ts` caches to
`listings.latest_matched_url`. No dedicated deeplink-generation API is called
(its response format is auth-walled and unverifiable from public docs → §8). Zero
extra quota; only the confirmed search shape is relied upon.

## affiliate_url / redirect (decision)
The sheet import previously force-copied `affiliate_url = url` for every listing.
A Coupang product-detail URL is **not** an affiliate link, so:
- **import** now leaves `affiliate_url` **blank (null)** for Coupang listings
  (other sellers unchanged).
- **`/go/[listingId]`** redirect chain extended to
  **`affiliate_url → latest_matched_url → url → home`**, so a Coupang listing
  monetizes via the cached deeplink when priced, and still links to the plain
  product URL before/without a price match.

### Follow-up (NOT in this PR)
The global `affiliate_url = url` copy for **all** sellers in
`crawler/sheets/import.ts` is a broader question (it puts non-affiliate URLs into
`affiliate_url` for every retailer). Left as a deliberate follow-up — revisit
whether import should ever populate `affiliate_url` from a plain `url`.

## Compliance
Coupang Partners disclosure rendered on `app/p/[slug]` whenever a Coupang store is
present in the comparison: "이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따라 일정액의
수수료를 제공받습니다." (DESIGN §12 / prompt §1.5). Site-wide footer disclosure on
the home page is unchanged.

## Rate limit & schedule
The official Partners search-API doc states **50 calls/min** ("1분당 최대 50번") —
NOT the "10 calls/hour" the design docs (DESIGN §122/§457/§570) assumed.
`MIN_CALL_INTERVAL_MS` therefore defaults to **2000ms** (≤30/min, a safe margin),
overridable via `COUPANG_RATE_LIMIT_DELAY_MS`. One call per product ⇒ a **full
Coupang sync of ~40 products takes ~80s**, so the "~4h sync / separate cadence"
concern is moot; `--max-coupang=N` remains available as a cap. (DESIGN.md's
10/hour figure should be corrected in a follow-up.)

## Sheet import URL hygiene
`crawler/sheets/validate.ts` `normalizeListingUrl()` (used by `expandListings`,
the single source of truth for import + dedup):
- a non-URL cell such as `"?"` → **null → no listing** (so an operator placeholder
  can't create a bogus listing or trip the duplicate-url fail-fast gate);
- a scheme-less host URL (`coupang.com/vp/products/123?…`, common when pasted from
  the address bar) → upgraded to `https://…` so the `/go` redirect doesn't resolve
  it relative to the site origin.

## Files changed
- `crawler/adapters/index.ts` — `FetchOutcome` gains `data_error`.
- `crawler/adapters/coupang.ts` — full rewrite: HMAC fix, search-API price match
  by productId, `data_error`/`no_offer`/`failed` classification, productUrl
  deeplink cache, product load for the search keyword.
- `crawler/run.ts` — `data_error` branch (reset + collect for summary).
- `crawler/core/notify.ts` — daily-summary data-error section.
- `crawler/core/healthcheck.ts` — `resolveListingOutcome` doc covers `data_error`.
- `crawler/sheets/import.ts` — Coupang `affiliate_url` left blank.
- `app/go/[listingId]/route.ts` — redirect fallback chain + `url`.
- `app/p/[slug]/page.tsx` — Coupang Partners disclosure.
- `crawler/adapters/__tests__/coupang.test.ts` — search shape, short-link
  data_error, keyword builder.

## Tests / build
- `npm run test:all` — PASS (incl. new Coupang cases: productPrice parse,
  isFreeShipping/isRocket shipping note, productUrl→matchedUrl, short-link→null
  productId, `isCoupangShortLink`, `buildSearchKeyword`).
- `npx tsc --noEmit` — PASS. `npx eslint` — 0 errors (1 pre-existing warning in an
  unrelated migrate script). `npm run build` — PASS.

## Fixes found during live validation
- **search `limit` must be ≤10** (doc max). The adapter used `limit=20`, which
  made the API return an empty `productData` — a false `no_offer`. Fixed to 10.
- **`latest_matched_url` was never persisted.** `run.ts` computed it in memory but
  the `listings` update only wrote `fail_count`/`is_active`, so the Coupang
  deeplink (and the Naver matched link) never reached the DB and `/go` could not
  fall back to it. Now persisted in both the Supabase and mock-DB save paths.

## Re-import (remote, done)
`ops:dryrun-import` (read-only) first flagged the sheet: two Coupang cells were a
`"?"` placeholder (→ duplicate-url → import would abort) and ~10 Coupang URLs were
scheme-less. After the URL-hygiene fix the dry-run was clean; the real import ran
0 errors (45 products / 138 listings, 2 orphan listings deactivated). Post-import:
32 active Coupang listings, 31 with product-detail URLs, all `affiliate_url=null`,
0 scheme-less.

## Live validation (remote, done) — real keys, subset sync
`--only=p1sn8ibq,p8veeo9,p4yux6n --skip-import --max-coupang=3 --no-notify`:
- **`coupang_p1sn8ibq`** (스타라이크, productId 8745247214) — **the former listing-60
  short-link bug**: now `status='ok'`, 16,760원, `로켓배송`, deeplink cached to
  `latest_matched_url`, **renders in `listing_prices_public`**.
- **`coupang_p8veeo9`** (몽디에스, 5529437152) — matched + priced (33,000) + deeplink
  cached; `status='warning'` (volume/variance gate) so excluded from the public
  ok-only view — expected, not a failure.
- **`coupang_p4yux6n`** (넘버즈인, still a `link.coupang.com/a/…` short-link) —
  `data_error`: no API call, `fail_count=0`, **stayed active** (no deactivation),
  no deeplink (redirect falls back to its url).
- HMAC, `/v1/products/search` path, and the 50/min rate were all confirmed against
  the real API.

## NOTE — accidental mock write to live DB
While exercising the wiring, `npm run crawler:test` was run; because Supabase env
is configured in this environment, `--test` mocks only the **adapters/notify**,
not the **DB destination** — so a batch of mock-priced snapshots / scores /
current_prices was written to the live Supabase. This is largely self-healing
(the next real `crawler:sync` writes newer snapshots and the public view shows the
latest), but it leaves mock history rows + one mock `crawl_runs` entry. Avoid
`crawler:test` against a live-Supabase env; the unit tests cover the logic.
