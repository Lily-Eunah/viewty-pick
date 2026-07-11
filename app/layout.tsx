import type { Metadata } from "next";
import "./globals.css";
import { isSiteIndexable, SITE_URL } from "../lib/seo/indexable";
import NavigationTracker from "../components/layout/NavigationTracker";

export function generateMetadata(): Metadata {
  const indexable = isSiteIndexable();
  // Search Console / Naver site-ownership tokens, supplied via Cloudflare env so no
  // secret lands in the repo. Empty until the operator pastes the tokens — the meta
  // tags simply don't render, and verification activates the moment they're set.
  const googleToken = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const naverToken = process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION?.trim();
  return {
    metadataBase: new URL(SITE_URL),
    // 브랜드명 "뷰티픽"(한글)을 홈 title 앞 + 모든 하위 페이지 접미사로 반복 노출해
    // 한국어 브랜드 검색("뷰티픽")에 강하게 매칭. ViewtyPick(영문)·화장품 최저가 비교는
    // 동명 서비스(btpick 이미지몰)·글로우픽과 문맥 분리용.
    title: {
      default: "뷰티픽 ViewtyPick - 화장품 최저가 비교 | 올리브영·쿠팡·네이버",
      template: "%s | 뷰티픽",
    },
    description:
      "화장품 최저가는 뷰티픽! 올리브영·쿠팡·네이버 등 검증된 판매처 가격을 한 번에 비교해 믿고 사는 뷰티 최저가를 찾아드려요. 성분으로 검증한 추천 화장품만 큐레이션합니다.",
    // Default (team-verification): noindex, nofollow site-wide. Flipped to
    // index/follow only when SITE_INDEXABLE=true at public launch.
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      siteName: "뷰티픽 ViewtyPick",
      title: "뷰티픽 ViewtyPick - 화장품 최저가 비교",
      description: "올리브영·쿠팡·네이버 검증된 판매처 최저가를 한눈에. 성분으로 검증한 추천 화장품 큐레이션.",
      type: "website",
      locale: "ko_KR",
      url: SITE_URL,
    },
    verification: {
      // <meta name="google-site-verification" ...> — Search Console domain/URL-prefix property.
      ...(googleToken ? { google: googleToken } : {}),
      // <meta name="naver-site-verification" ...> — Naver Search Advisor.
      ...(naverToken ? { other: { 'naver-site-verification': naverToken } } : {}),
    },
  };
}

// Organization + WebSite entity — teaches search engines the brand's Korean name
// (뷰티픽) alongside the English (ViewtyPick), and enables Google's sitelinks
// searchbox via SearchAction. Rendered site-wide (valid on any page).
const BRAND_JSON_LD = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: '뷰티픽',
    alternateName: 'ViewtyPick',
    url: SITE_URL,
    description: '검증된 판매처(올리브영·쿠팡·네이버) 기준 화장품 최저가를 비교하는 뷰티 큐레이션 서비스',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: '뷰티픽',
    alternateName: 'ViewtyPick',
    url: SITE_URL,
    inLanguage: 'ko-KR',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NavigationTracker />
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BRAND_JSON_LD) }} />
      </body>
    </html>
  );
}

