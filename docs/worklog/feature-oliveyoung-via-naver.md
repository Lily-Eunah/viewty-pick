# Worklog — feature/oliveyoung-via-naver

OliveYoung price collected via the approved **Naver Shopping Search API**
("OliveYoung = just another official mall"), gated by a manually-entered
**curator affiliate link**. No request is ever made to `oliveyoung.co.kr`
(compliant). Builds on the merged Naver API matching infra (0006, `pickOfficialOffer`).

## Why
OliveYoung crawling is policy-blocked: `robots.txt` is `User-agent: * → Disallow: /`
(content paths whitelisted only for search/AI bots) + WAF 403. There is no public
OliveYoung price API. The only compliant automated path to an OliveYoung price is
reading the OliveYoung offer that surfaces on the Naver Shopping Search API. The
Playwright OliveYoung crawler is retired.

## Display logic — 4-tier curator gate (spec §1)
The curator `affiliate_url` is both the gate and the buy link.
| tier | condition | price | buy link |
|------|-----------|-------|----------|
| 1 hidden    | no curator URL | — (row not shown) | — |
| 2 naver     | curator + Naver OliveYoung offer | **Naver** | curator |
| 3 manual    | curator + no Naver + `manual_override` | **manual** | curator |
| 4 link_only | curator + no Naver + no override | — (no price) | curator |

"Curator URL present" (sold on OliveYoung) does **not** guarantee "a Naver
OliveYoung offer exists" → tiers 2 vs 3/4. Price comes via Naver (or manual
override); the buy button is **always** the curator `affiliate_url` (redirect
route prefers `affiliate_url` over `latest_matched_url`). Caveat shown to users:
"실제 결제가는 판매처 확인" + refresh time.

## Main changes (by commit)
1. `refactor` — retire OliveYoung Playwright crawler (`crawler/adapters/oliveyoung.ts`); pipeline never hits oliveyoung.co.kr.
2. `feat(db)` — `supabase/migrations/0007_add_naver_sourced_crawl_method.sql`: extend `listings.crawl_method` CHECK with `naver_sourced`, re-provenance existing OliveYoung listings; `CrawlMethod` type updated.
3. `feat` — register OliveYoung `mallName` ('올리브영') in `retailer_allowlist` (`seed_metadata.ts`, `mock_sheets_data.ts`) for the 5 brands with an OliveYoung curator listing.
4. `feat` — extract OliveYoung offer via Naver: refactor `naver.ts` to expose cached `searchNaverShopping` + `matchNaverOffer` (one Shopping API call per product, shared by brand-store and OliveYoung listings); OliveYoung adapter sources its price from the '올리브영' offer; `SELLER_META.oliveyoung.crawl_method='naver_sourced'`.
5. `feat` — 4-tier display gate: curator-URL gate + pure `resolveOliveYoungTier()`; redirect-always-curator documented.
6. `feat` — `manual_override` fallback (tier 3): a price override clears `matchExcluded`, asserts in-stock, tags source (`crawler/core/normalize.ts`).
7. `test` — `crawler/adapters/__tests__/oliveyoung.test.ts` (12 cases); wired into `test:all`.
8. `docs` — this worklog + `scripts/live-check/live-check-oliveyoung.ts` (read-only coverage tool).

## Tests
- `npm run lint && npm run typecheck && npm run test:all && npm run build` — all pass.
- New `test:oliveyoung` (12): pickOfficialOffer with mallName='올리브영' (adopt individual offer; exclude catalog representative + reseller; price+link from same offer); 4-tier gate incl. Naver-over-manual precedence; manual_override tier-3 fallback; redirect-always-curator invariant.
- Existing normalize/healthcheck/naver/coupang/packageExtractor suites — regression pass.

## Live coverage report (§4, read-only — `npm run live-check:oliveyoung`)
Run against the real Naver Shopping API on 2026-06-15. Output (gitignored) →
`scripts/live-check/expectations/oliveyoung-via-naver.json`.

- **mallName confirmed: `올리브영`** (exact string) — allowlist value is correct.
  Individual mall offer (not the 가격비교 catalog representative); price + link
  from the same offer. No false/reseller OliveYoung matches observed.
- **Coverage (distinct OliveYoung-curator brands): 3 / 5 = 60% (tier 2).**

| brand | tier | price | mallName |
|-------|------|-------|----------|
| 아로셀     | 2 naver | 25,000 | 올리브영 |
| 조선미녀   | 2 naver | 14,400 | 올리브영 |
| 넘버즈인   | 2 naver | 24,900 | 올리브영 |
| 스타라이크 | 3/4 gap | — | (no Naver OliveYoung offer) |
| 이니스프리 | 3/4 gap | — | (no Naver OliveYoung offer) |

The two gaps have individual-mall offers on Naver but none from OliveYoung →
genuinely not listed on Naver under OliveYoung (not a matching bug). They are
**manual_override (tier 3) candidates**, link-only (tier 4) until entered.

## Remaining issues / TODO
- **Migration apply order (operator):** apply `0006` and `0007` to remote Supabase
  **before** `sheets:import` / `crawler:sync`. Until then the live import fails on
  the `listings_crawl_method_check` constraint (`naver_sourced`) and snapshot insert
  fails on `matched_mall_name` (0006, already lagging on remote pre-this-branch).
- **Manual overrides for gaps:** enter OliveYoung prices for 스타라이크 / 이니스프리
  via `manual_overrides` (seller=oliveyoung, override_type=price) to lift them tier 4→3.
  Coverage (~60%) means a non-trivial manual-entry burden — operator to confirm cadence.
- **manual_override TTL / refresh cadence:** undecided (`expires_at` left blank/long) — spec §2.5.
- **UI link-only (tier 4) rendering:** current `mapToUIProduct` drops a listing with no
  displayable snapshot, so a tier-4 OliveYoung row shows no button. If we want the
  curator link visible without a price, a small UI change is needed (follow-up).
- **mallName re-confirm:** '올리브영' confirmed today; re-check periodically (storefront
  naming can change) per spec §8.
