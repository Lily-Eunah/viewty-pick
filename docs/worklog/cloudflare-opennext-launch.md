# Worklog — chore/cloudflare-opennext-launch

Launch phase 1: migrate hosting to **Cloudflare (Workers + OpenNext)** and connect
**viewtypick.com** for team verification, with the site **publicly reachable but
not indexable** (`noindex`). Indexing, legal pages, AdSense, monetization, and
Search Console submission are deferred to the public-launch phase.

## Scope of this branch (agent / code side)
- OpenNext Cloudflare build + compatibility verification (§1 gate).
- `wrangler` / OpenNext build config and deploy scripts.
- `SITE_INDEXABLE` flag → `robots.txt` / `sitemap.xml` / per-page meta robots.
- Worklog + runbook for the operator (account/secrets/domain steps).

Operator-only steps (need Cloudflare/Spaceship credentials the agent cannot
access): creating the Worker, entering secrets, and connecting the custom
domain. These are documented below, not executed here.

---

## 1. OpenNext compatibility verification (§1 gate) — PASSED

Verified with `@opennextjs/cloudflare@1.19.11` + `wrangler@4.100`, Next `16.2.9`,
on the local `opennextjs-cloudflare preview` (workerd) runtime.

Two Next 16-specific incompatibilities were found and fixed:

### 1a. Node.js `proxy.ts` is not supported → use Edge `middleware.ts`
Next 16 renamed `middleware` → `proxy`, and **`proxy` runs only on the Node.js
runtime, which OpenNext Cloudflare does not support** (build fails with
`Node.js middleware is not currently supported`; ref opennextjs-cloudflare#962,
workers-sdk#13755). `proxy` also forbids route-segment runtime config, so it
cannot be switched to Edge.

Fix: renamed `proxy.ts` → `middleware.ts` and the export `proxy` → `middleware`.
The deprecated `middleware.ts` (Edge runtime) is still supported by Next 16 and
by OpenNext. The gate only uses Edge-safe APIs (`NextResponse`, `process.env`,
`atob`), so behavior is unchanged (Basic-Auth gate on `/admin/status`).

### 1b. Turbopack production bundle fails at runtime → build with webpack
Next 16's `next build` defaults to **Turbopack**. The Turbopack-produced worker
bundle builds successfully but **throws at module instantiation in workerd**
(every dynamic route → HTTP 500, no stack; static assets still serve). Switching
the production build to **webpack** resolves it completely.

Fix: `open-next.config.ts` sets `config.buildCommand = "next build --webpack"`,
so `opennextjs-cloudflare build` drives a webpack build. (This is a real runtime
incompatibility, not just a local Windows artifact — it would fail on Cloudflare
too.)

> Note: local previews must run on **npm** (not pnpm) and the host is flagged by
> OpenNext as "not fully compatible with Windows"; force-killing stale
> `workerd.exe` is sometimes needed before a rebuild (`EBUSY` on `.open-next`).

### Verification results (local workerd preview, webpack build)
| Check | Route | Result |
| --- | --- | --- |
| Home render + noindex meta + affiliate disclosure | `/` | 200, `<meta name="robots" content="noindex, nofollow">`, disclosure present |
| Category render (Supabase/mock read) | `/c/sunscreen` | 200 |
| Affiliate redirect (302/307 + `affiliate_clicks` insert path) | `/go/1` | 307 → `link.coupang.com/...` |
| On-demand revalidation secret gate | `/api/revalidate` | bad secret → 401, correct → 200 `revalidated:true` |
| Admin Basic-Auth gate (Edge middleware) | `/admin/status` | 401 without credentials |
| Dynamic robots | `/robots.txt` | `Disallow: /` (noindex phase) |
| Dynamic sitemap | `/sitemap.xml` | empty urlset (noindex phase) |
| Indexability toggle | `SITE_INDEXABLE=true` | robots → `Allow: /` (+ admin/api/go disallow, Host, Sitemap); sitemap → homepage URL |

External `<img>` from `ads-partners.coupang.com` renders unchanged (plain `<img>`,
no `next/image` optimization), so no OpenNext image config is needed.

---

## 2. Build / config (added in this branch)
- `wrangler.jsonc` — Worker name `viewtypick`, `main: .open-next/worker.js`,
  `compatibility_date 2025-03-25`, `compatibility_flags: ["nodejs_compat"]`,
  `ASSETS` static binding, observability on. No secrets in file.
- `open-next.config.ts` — default (in-memory) incremental cache for this phase;
  `buildCommand = "next build --webpack"`.
- `next.config.ts` — `initOpenNextCloudflareForDev()` for `next dev` parity.
- `package.json` scripts: `cf:build`, `cf:preview`, `cf:deploy`, `cf:typegen`.
- `.gitignore` — `/.open-next/`, `/.wrangler/`, `.dev.vars*`, `cloudflare-env.d.ts`.

### Secrets (operator enters in Cloudflare dashboard — never committed)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, RLS read-only)
- `SUPABASE_SERVICE_ROLE_KEY` (server only: `/go` insert, `/api/revalidate`)
- `REVALIDATE_SECRET`
- `SITE_INDEXABLE` — omit or `false` ⇒ noindex; set `true` only at public launch
- Crawler secrets (coupang/naver/google/discord) stay in **GitHub Actions only**.

---

## 3. Deploy runbook
Local build is verified; the actual deploy requires the operator's Cloudflare auth.

1. Operator: create the Worker / connect repo, set the secrets above.
2. Build + deploy: `npm run cf:deploy` (runs `opennextjs-cloudflare build` →
   webpack Next build → `deploy`). First deploy targets `*.workers.dev`.
3. Smoke test the `*.workers.dev` URL (same checks as §1).
4. **Custom domain** (operator): Cloudflare zone for `viewtypick.com` is already
   Active. Attach `viewtypick.com` (+ `www`) to the Worker as a custom domain;
   TLS is automatic. Verify apex + www resolve and serve.

## 4. noindex status
- Default for this phase: **noindex**. `SITE_INDEXABLE` unset/`false` ⇒
  `robots.txt` `Disallow: /`, empty sitemap, and `<meta robots noindex,nofollow>`
  site-wide.
- `robots.txt` / `sitemap.xml` are `force-dynamic`, so flipping the env flag
  changes crawl rules **immediately** (no rebuild).
- The per-page `<meta robots>` tag is baked into statically-prerendered pages at
  build time. **At public launch, set `SITE_INDEXABLE=true` AND redeploy** so the
  static pages re-bake with `index,follow`. (Launch is a redeploy anyway.)
- Affiliate disclosure remains globally visible (AppShell + home footer).
- Search Console / sitemap submission is intentionally NOT done in this phase.

## 5. Remaining / TODO (public-launch phase)
- Durable incremental cache (R2 + KV/DO tag cache) so on-demand revalidation
  propagates across all isolates (operator must provision R2).
- Full sitemap URL enumeration (categories/products from Supabase).
- `SITE_INDEXABLE=true` + redeploy, Search Console submission.
- Legal pages (privacy policy / ToS), AdSense, monetization, daily cron + Discord.
- Revisit `middleware.ts` → `proxy.ts` once OpenNext supports Node proxy.
