import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ViewtyPick | 믿고 사는 뷰티 최저가",
  description: "검증된 추천 제품을 보고, 가장 싸게 사는 뷰티 큐레이션",
};

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

