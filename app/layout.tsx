import type { Metadata } from "next";
import "./globals.css";
import { isSiteIndexable, SITE_URL } from "../lib/seo/indexable";

export function generateMetadata(): Metadata {
  const indexable = isSiteIndexable();
  // Search Console / Naver site-ownership tokens, supplied via Cloudflare env so no
  // secret lands in the repo. Empty until the operator pastes the tokens — the meta
  // tags simply don't render, and verification activates the moment they're set.
  const googleToken = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const naverToken = process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION?.trim();
  return {
    metadataBase: new URL(SITE_URL),
    title: "ViewtyPick | 믿고 사는 뷰티 최저가",
    description: "검증된 추천 제품을 보고, 가장 싸게 사는 뷰티 큐레이션",
    // Default (team-verification): noindex, nofollow site-wide. Flipped to
    // index/follow only when SITE_INDEXABLE=true at public launch.
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    verification: {
      // <meta name="google-site-verification" ...> — Search Console domain/URL-prefix property.
      ...(googleToken ? { google: googleToken } : {}),
      // <meta name="naver-site-verification" ...> — Naver Search Advisor.
      ...(naverToken ? { other: { 'naver-site-verification': naverToken } } : {}),
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

