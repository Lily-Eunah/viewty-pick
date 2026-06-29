import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AppShell from '../../../components/layout/AppShell';
import Header from '../../../components/layout/Header';
import ProductListCard from '../../../components/product/ProductListCard';
import Badge from '../../../components/common/Badge';
import { getSeoPageData } from '../../../lib/queries';
import { MIN_SEO_PRODUCTS } from '../../../lib/seo/match';
import { SEO_PAGE_SPECS } from '../../../lib/seo/specs';
import { isSiteIndexable, SITE_URL } from '../../../lib/seo/indexable';
import type { UIProduct } from '../../../lib/types';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Known slugs (no DB hit at build); dynamicParams renders any extra active rows on demand.
export function generateStaticParams() {
  return SEO_PAGE_SPECS.map((s) => ({ slug: s.slug }));
}

// Revalidate hourly so freshly-imported pages/prices appear without a redeploy.
export const revalidate = 3600;

const FAQS = (h1: string) => [
  {
    q: `${h1.replace(' 최저가 비교', '')}는 어떻게 선정하나요?`,
    a: '광고나 협찬이 아니라 성분 안전성, 유해 우려 성분 배제, 사용감·피부 타입 적합도를 종합 검토해 합격한 제품만 추천합니다.',
  },
  {
    q: '최저가는 어떻게 집계되나요?',
    a: '쿠팡·올리브영·네이버 브랜드스토어 등 공식 판매처 가격을 매일 새벽 자동 수집해 노출합니다. 쿠폰·카드 등 조건부 할인은 혼선을 막기 위해 기본 최저가에서 제외하고 별도 표기합니다.',
  },
  {
    q: '1+1, 기획 구성 가격도 비교되나요?',
    a: '단순 판매가뿐 아니라 1+1·N개 기획의 개당 실질가와 ml(g)당 가격까지 자동 계산해 구매 효율을 정확히 비교할 수 있습니다.',
  },
];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { page, products } = await getSeoPageData(slug);
  if (!page || products.length < MIN_SEO_PRODUCTS) {
    return { title: 'ViewtyPick', robots: { index: false, follow: false } };
  }
  const url = `${SITE_URL}/best/${slug}`;
  const title = page.title || page.h1 || 'ViewtyPick 추천';
  const description = page.description || `${page.h1} — 쿠팡·올리브영·네이버 최저가 비교`;
  const indexable = isSiteIndexable();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'ViewtyPick' },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

function schemaPrice(p: UIProduct): number {
  return p.lowestBasePrice && p.lowestBasePrice > 0 ? p.lowestBasePrice : p.lowestPrice;
}

export default async function BestPage({ params }: PageProps) {
  const { slug } = await params;
  const { page, products } = await getSeoPageData(slug);

  // Thin-content guard: a page must back >= MIN_SEO_PRODUCTS products to exist.
  if (!page || products.length < MIN_SEO_PRODUCTS) notFound();

  const h1 = page.h1 || page.title || '추천 최저가 비교';
  const faqs = FAQS(h1);
  const url = `${SITE_URL}/best/${slug}`;

  // JSON-LD: ItemList (the ranked products) + FAQPage + BreadcrumbList for rich results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: page.title || h1,
        numberOfItems: products.length,
        itemListElement: products.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Product',
            name: p.name,
            brand: p.brand,
            ...(p.image ? { image: p.image } : {}),
            url: `${SITE_URL}/p/${p.slug}`,
            ...(schemaPrice(p) > 0
              ? {
                  offers: {
                    '@type': 'Offer',
                    price: schemaPrice(p),
                    priceCurrency: 'KRW',
                    availability: 'https://schema.org/InStock',
                    url: `${SITE_URL}/p/${p.slug}`,
                  },
                }
              : {}),
          },
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '홈', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: page.title || h1, item: url },
        ],
      },
    ],
  };

  return (
    <AppShell activeTab="category">
      <Header showBack title="추천 가이드" />

      {/* JSON-LD structured data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* SEO hero */}
      <section className="bg-background-warm px-4 py-8 border-b border-line rounded-b-[28px] shadow-sm">
        <div className="flex flex-col gap-1.5">
          <Badge type="accent" className="w-fit">2026 베스트 추천 · 실시간 최저가</Badge>
          <h1 className="text-[22px] font-black text-title leading-tight tracking-tight mt-1">{h1}</h1>
          {page.description && (
            <p className="text-[12px] text-body opacity-85 mt-2 font-semibold leading-relaxed">{page.description}</p>
          )}
          <p className="text-[11px] text-sub font-bold mt-1">
            성분 검증을 통과한 추천 제품 {products.length}개를 쿠팡·올리브영·네이버 가격으로 비교했어요.
          </p>
        </div>
      </section>

      {/* Ranked product list */}
      <section className="px-4 py-5 bg-bg flex flex-col gap-3.5">
        <h2 className="text-[15px] font-black text-title tracking-tight">추천 제품 리스트 ({products.length}개)</h2>
        <div className="flex flex-col gap-3">
          {products.map((prod, idx) => (
            <ProductListCard key={prod.id} product={prod} rank={idx + 1} />
          ))}
        </div>
      </section>

      {/* Why ViewtyPick (promo) */}
      <section className="px-4 py-4 bg-bg">
        <div className="bg-white border border-line rounded-card p-4.5 flex flex-col gap-2">
          <h2 className="text-[13px] font-black text-primary-dark">✓ 왜 뷰티픽에서 비교하나요?</h2>
          <p className="text-[11px] text-sub font-semibold leading-relaxed">
            - 가품 우려가 있는 비공식 오픈마켓은 빼고, 검증된 공식 판매처·대형 직매입 링크의 최저가만 모았어요.<br />
            - 1+1·기획 구성의 개당 실질가와 ml(g)당 가격까지 자동 계산해 진짜 싼 곳을 보여줘요.<br />
            - 매일 새벽 가격을 갱신해 지금 가장 싸게 살 수 있는 판매처로 바로 연결해 드려요.
          </p>
        </div>
      </section>

      {/* FAQ (rich result) */}
      <section className="px-4 py-4.5 bg-bg flex flex-col gap-3">
        <h2 className="text-[14px] font-black text-title tracking-tight">자주 묻는 질문 (FAQ)</h2>
        <div className="flex flex-col gap-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white border border-line rounded-card p-4 flex flex-col gap-1.5 shadow-sm">
              <h3 className="text-[13px] font-black text-title leading-snug">Q. {faq.q}</h3>
              <p className="text-[12px] text-body opacity-85 font-semibold leading-relaxed pt-1.5 border-t border-[#F8F6EE]">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Internal links to other guides */}
      <section className="px-4 py-6 bg-[#F0EEE2] text-center border-t border-line text-[11px] text-[#A2A08E] font-bold">
        <p className="mb-2">다른 추천 가이드 둘러보기</p>
        <Link href="/best" className="underline hover:text-primary">전체 추천 가이드 보기 →</Link>
      </section>
    </AppShell>
  );
}
