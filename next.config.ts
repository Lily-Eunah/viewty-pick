import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // P0 cannibalization fix: these slugs were 100% product-identical to their targets.
      // 301 consolidates link equity and removes index duplication.
      { source: '/best/acne-pad', destination: '/best/pad-best', permanent: true },
      { source: '/best/men-allinone', destination: '/best/allinone-best', permanent: true },
    ];
  },
};

export default nextConfig;

// Enables OpenNext's Cloudflare bindings (env, ISR cache, etc.) during
// `next dev` so local dev matches the deployed Worker runtime.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
