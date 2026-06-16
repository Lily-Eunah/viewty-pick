import type { Metadata } from "next";
import "./globals.css";
import { isSiteIndexable, SITE_URL } from "../lib/seo/indexable";

export function generateMetadata(): Metadata {
  const indexable = isSiteIndexable();
  return {
    metadataBase: new URL(SITE_URL),
    title: "ViewtyPick | 믿고 사는 뷰티 최저가",
    description: "검증된 추천 제품을 보고, 가장 싸게 사는 뷰티 큐레이션",
    // Default (team-verification): noindex, nofollow site-wide. Flipped to
    // index/follow only when SITE_INDEXABLE=true at public launch.
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
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

