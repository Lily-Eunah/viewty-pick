# ViewtyPick MVP Verification & Walkthrough Report

## 1. Current MVP Status

“All core MVP modules for Phase 0-3 now compile successfully in local/mock mode. The project is ready for staging deployment, Supabase remote integration, and real retailer adapter validation.”

“Phase 0~3의 핵심 MVP 모듈은 local/mock 기준으로 컴파일 및 파이프라인 실행이 완료되었다. 이제 staging 배포, Supabase 원격 DB 연동, 실제 판매처 어댑터 검증 단계로 진입할 수 있다.”

---

## 2. Implemented Areas
The ViewtyPick repository contains the following core areas developed during the Phase 0–3 MVP iterations:

* **Database Schema & Mock DB**: DB table structures and Row-Level Security (RLS) definitions are implemented inside the SQL migrations (`supabase/migrations/`). For local dev, a synchronized fallback local JSON database (`lib/data/db_mock.json` & `lib/supabase/mockDb.ts`) simulates database CRUD operations.
* **Google Sheets Import Pipeline**: Reads product curation and seller sheets in structural formats, validating columns via Zod schemas and synchronizing records to either the database or the local mock database.
* **Crawler Adapters**: Custom adapters for OliveYoung (Playwright), Naver Shopping (Search API), and Coupang (Partners Search API) are set up to crawl prices, handle proxy settings, and parse promo benefits.
* **Price Normalization & Aggregation**: Price normalization calculates base unit prices and promotional effective unit prices. Centralized healthcheck gates intercept outliers and sequential crawl failures.
* **Viewty Score & Scoring config**: Automatically updates product recommendation ranks using Viewty Score logic that calculates brand recognition, price competitiveness, and trust coefficients.
* **Mobile Web UI Routes**: Centered layout constrained to a mobile viewport (`max-w-[430px]`). Routes include Home (`/`), Category lists (`/c/[category]`), Product details (`/p/[slug]`), Curation landing pages (`/pick/[badge]/[category]`), and Skin concern landing pages (`/skin/[type]/[category]`).
* **SEO Metadata & JSON-LD**: Dynamically generates dynamic titles, meta descriptions, and structural Product + AggregateOffer JSON-LD schemas server-side inside detail Server Components.
* **Affiliate click redirection (`/go/[listingId]`)**: Logs product redirects to `affiliate_clicks` dynamically prior to forwarding users to retailer store landing pages.
* **On-Demand Cache Revalidation (`/api/revalidate`)**: ISR on-demand route handler to rebuild cache keys dynamically after synchronization.
* **Admin Dashboard (`/admin/status`)**: Live monitor displaying crawl success rate, override logs, click logs, and active listing statuses.

---

## 3. Security Hardening
- **Route Interception via `proxy.ts`**: Protected `/admin/status` using Next.js 16's named `proxy(request: NextRequest)` function.
- **Environment Gating**: Auth credentials are loaded strictly from server-only environment variables (`ADMIN_STATUS_USER`, `ADMIN_STATUS_PASSWORD`). If missing or containing `'placeholder'`, it fails closed.
- **Vulnerability Guarding**: 
  - Malformed or invalid Authorization headers are caught safely in a `try/catch` block and return a `401 Unauthorized` response with a real `WWW-Authenticate: Basic realm="ViewtyPick Admin"` header.
  - No hardcoded username or password credentials exist in page code or helpers.
- **Cache Revalidation secret protection**: Removed the public fallback token `'placeholder-revalidate-secret'`. If `REVALIDATE_SECRET` is missing in production, the route fails closed. Dev/mock mode permits bypass ONLY when explicitly marked by mock env variables, and error blocks omit variables to prevent stack trace leaks.
- **Example configs**: `.env.example` has empty placeholders only, and `.env.local` is kept untracked.

---

## 4. Price Display Rules
- **Primary Lowest Price**: Lowest price represents the **base price only**, derived dynamically from the cheapest displayable store listing (`stores[0]?.price`). Promotional effective prices (coupons, membership discount rates) are displayed separately as a benefit badge and do not replace the base price.
- **Strict Snapshot Gating**: Snapshots are excluded from lowest price selection if they fail the shared `isDisplayablePriceSnapshot` check:
  - Snapshot `status !== 'ok'` (representing crawling errors or warnings)
  - `in_stock === false` (out-of-stock listings)
  - `parse_confidence === 'low'` (low confidence regex extractions)
  - Associated listing is marked inactive in the sheets/DB
- **Fallback String**: When no displayable price exists (all stores filtered out or empty listings), the UI displays `"가격 확인 중"` instead of `"0원"` or `-원`.
- **JSON-LD Schema price consistency**:
  - `AggregateOffer.lowPrice` is identical to the visible lowest base price.
  - Excludes low-confidence, out-of-stock, or product-mismatch offers.
  - If no displayable price exists, the `offers` property is omitted, rendering only standard Product schema without a price object.

---

## 5. Local/Mock Verification Results
The project builds and verifies cleanly on Next.js 16 / Turbopack with 0 errors:

1. **`npm run typecheck`**: Compiles successfully with **0 errors**.
2. **`npm run lint`**: Executes ESLint cleanly with **0 errors**.
3. **`npm run build`**: Compiles production bundles successfully under Next.js 16 with page routers mapped as dynamic/static routes.
4. **`npm run crawler:test`**: Verifies pipeline execution successfully. Adapters run completely in offline mock mode, and webhooks output mock messages to console without triggering external network requests.

---

## 6. Important Remaining Risks & Next Steps
Before promoting the project to staging/production, the following integration items must be completed:

* **Supabase remote DB integration**: Wire live PostgreSQL DB credentials in production (currently using fallback mock JSON).
* **Google Sheets API integration**: Replace mock spreadsheet loaders with live Google API oauth tokens.
* **Affiliate credentials integration**: Connect real Coupang Partners Access/Secret keys and Naver Shopping developer keys.
* **OliveYoung Production Scans**: Verify Playwright headless runtime dependencies on the target deployment server.
* **Discord Webhook Configuration**: Set a real Discord incoming webhook URL in the production variables.
* **Edge Runtime Portability Audits**: Run compatibility tests (e.g. OpenNext / Cloudflare runtime compatibility) since edge environments do not support Node-specific globals.
* **Current Prices cleanup**: Regenerate the `current_prices` aggregate tables when moving from mock data to the live Supabase instance.

---

## 7. Current Working Tree Review
- **Modified Tracked Files (18)**: Core configuration and pipeline updates (`DESIGN.md`, `package.json`, `app/globals.css`, `app/page.tsx`, `crawler/*`, `lib/*`).
- **Untracked Directories/Files (9)**: Newly added MVP routes, components, and edge routing proxy (`app/admin`, `app/api`, `app/c`, `app/go`, `app/p`, `app/pick`, `app/skin`, `components`, `proxy.ts`).
- **Design Document updates**: `DESIGN.md` updated from version 3.5 to 3.6 to record Olive Young Curator eligibility terms (comparison sites allowed under content guidelines, but simple link listing prohibited, requiring genuine recommendations).
- **Task/Walkthrough artifact mapping**: `task.md` and `walkthrough.md` were written strictly to local agent artifacts under the `.gemini` folder to keep the workspace clean of local workspace files.

---

## 8. Suggested Commit Groups
To commit these modifications, follow these recommended semantic commit groups:

1. **`feat(auth): protect admin status page and api revalidate routes`**
   - File changes: `proxy.ts`, `app/api/revalidate/route.ts`
2. **`fix(price): enforce strict base price filtering and handle placeholder display`**
   - File changes: `lib/queries/index.ts`, `lib/format.ts`, `components/product/*`
3. **`feat(seo): enable dynamic alternates and conditional JSON-LD schema`**
   - File changes: `app/p/[slug]/page.tsx`
4. **`security(mock): restrict crawler execution and hardener environments`**
   - File changes: `crawler/adapters/*`, `crawler/core/notify.ts`, `.env.example`
5. **`feat(mvp): initialize app routers, page components and seed mock database`**
   - File changes: `app/*`, `components/*`, `lib/data/db_mock.json`
6. **`docs(worklog): document design specs and pass walkthrough report`**
   - File changes: `DESIGN.md`, `docs/*`

---

## 9. Security & Agent Workflow Guidance
Refer to [GEMINI.md](file:///c:/Users/yua12/Desktop/Project/viewty-pick/GEMINI.md) at the repository root for security guidelines regarding personal access tokens (PATs), credential protection, and safe git workflows.
