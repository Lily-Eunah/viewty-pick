import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Enables OpenNext's Cloudflare bindings (env, ISR cache, etc.) during
// `next dev` so local dev matches the deployed Worker runtime.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
