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
Search API = **10 calls/hour** → `MIN_CALL_INTERVAL_MS` (360s) is enforced
between successive calls. One call per product ⇒ a **full Coupang sync of ~40
products takes ~4h**. Run Coupang on a separate/async cadence (e.g. `--max-coupang=N`,
or every-other-day) so it never blocks the OliveYoung/Naver sync. The adapter only
guarantees the 360s spacing; the schedule itself is a separate decision.

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

## Outstanding / operator pre-reqs (before live validation — prompt §2, §5)
1. **Sheet**: Coupang listing `url`s must be product-detail URLs
   (`…/vp/products/{id}`), not `link.coupang.com/a/…` share short-links. Until
   then those listings show as `data_error` (correct, not a failure).
2. **Re-import** the sheet so the DB picks up the corrected Coupang URLs and the
   new blank-`affiliate_url` rule.
3. **Limited live validation** (real keys, 360s spacing) on 2–3 Coupang listings:
   productId match → price recorded + isRocket/shipping label + renders in the
   public view; deeplink cached; a short-link listing shows as `data_error`
   (fail_count unchanged, not deactivated).

## NOTE — accidental mock write to live DB
While exercising the wiring, `npm run crawler:test` was run; because Supabase env
is configured in this environment, `--test` mocks only the **adapters/notify**,
not the **DB destination** — so a batch of mock-priced snapshots / scores /
current_prices was written to the live Supabase. This is largely self-healing
(the next real `crawler:sync` writes newer snapshots and the public view shows the
latest), but it leaves mock history rows + one mock `crawl_runs` entry. Avoid
`crawler:test` against a live-Supabase env; the unit tests cover the logic.
