import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import kvNextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/kv-next-tag-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

// OpenNext Cloudflare adapter config.
//
// Durable incremental cache (DESIGN §3.1, docs/cloudflare-cache-setup.md):
//   - incrementalCache: ISR/SSG page output + unstable_cache data → R2 bucket
//     (NEXT_INC_CACHE_R2_BUCKET), fronted by an in-colo Cache API layer
//     (regional cache) to cut TTFB and R2 Class B reads.
//   - tagCache: revalidateTag / revalidatePath support → KV (NEXT_TAG_CACHE_KV).
//   - queue: ISR revalidation request dedup, isolate-local (fine at this scale).
//   - enableCacheInterception: serve cache hits without invoking the route handler.
const config = defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "short-lived" }),
  tagCache: kvNextTagCache,
  queue: memoryQueue,
  enableCacheInterception: true,
});

// Next 16 builds with Turbopack by default. The OpenNext Cloudflare adapter's
// Turbopack runtime support is still new; a webpack production build produces
// the most reliable Worker bundle today. Drive the Next build through webpack.
config.buildCommand = "next build --webpack";

export default config;
