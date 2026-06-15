# Live Parse Validation (`scripts/live-check/`)

**Not CI tests.** These scripts hit the real network / live API keys and are run
manually. The fixture-based unit tests (`npm run test:naver|coupang|normalize`)
remain the CI source of truth.

## Scripts

| Command | What it does | Quota/network |
|---|---|---|
| `npm run live-check:coupang [-- --limit=3 --delay=5000]` | Resolves `link.coupang.com` deeplinks → productId, calls Partners `products/search`, compares `parseCoupangItem()` output to the real response | Coupang search API (10/hour). Keep `limit ≤ 3` |
| `npm run live-check:naver [-- --limit=5]` | Runs the adapter's robots.txt check against real Naver listing hosts; reports whether a live crawl is permitted (does **not** crawl) | robots.txt fetch only |
| `npm run live-check:normalize` | Feeds captured real Coupang items through `normalizePrice()` to verify bundle math / volume-mismatch gate / shipping label separation | none (reads artifacts) |

Helpers: `_inspect.ts` (DB seller/listing overview), `_sample.ts <naver|coupang>`
(list listings + product details). Both read-only.

## Preconditions

- `.env` with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (read-only DB),
  `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`, `CRAWLER_USER_AGENT`.
- `VIEWTYPICK_MOCK_MODE=false`, `CRAWLER_MODE=live`.
- Playwright chromium installed (`npx playwright install chromium`) — only needed
  if Naver crawl ever becomes permitted.

## Output (gitignored)

- `artifacts/coupang/<link_key>.json` — slim real API items (image blobs &
  affiliate URLs/tokens stripped).
- `expectations/{coupang,naver}.json` — per-link comparison records.

Both dirs are gitignored (network/key-dependent, may contain affiliate tokens).
See `docs/worklog/feature-pipeline-mvp-live-check.md` for the findings report.
