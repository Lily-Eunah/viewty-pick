import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext Cloudflare adapter config.
//
// For the team-verification phase we run with the default in-memory
// incremental cache: ISR + on-demand revalidation work within each Worker
// isolate, which is enough to verify rendering and the /api/revalidate route.
//
// Public-launch follow-up (DESIGN §3.1): wire a durable incremental cache
// (R2 + KV/DO tag cache) so on-demand revalidation propagates across all
// isolates. That requires the operator to provision an R2 bucket, so it is
// intentionally deferred out of this phase.
const config = defineCloudflareConfig({});

// Next 16 builds with Turbopack by default. The OpenNext Cloudflare adapter's
// Turbopack runtime support is still new; a webpack production build produces
// the most reliable Worker bundle today. Drive the Next build through webpack.
config.buildCommand = "next build --webpack";

export default config;
