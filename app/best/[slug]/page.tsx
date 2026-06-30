import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AppShell from '../../../components/layout/AppShell';
import Header from '../../../components/layout/Header';
import ProductListCard from '../../../components/product/ProductListCard';
import Badge from '../../../components/common/Badge';
import PriceText from '../../../components/common/PriceText';
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

// Common FAQs shared across all pages (applies to any /best/[slug] page).
const COMMON_FAQS = [
  {
    q: '최저가는 어떻게 집계되나요?',
    a: '쿠팡·올리브영·네이버 브랜드스토어 등 공식 판매처 가격을 매일 새벽 자동 수집해 노출합니다. 쿠폰·카드 등 조건부 할인은 혼선을 막기 위해 기본 최저가에서 제외하고 별도 표기합니다.',
  },
  {
    q: '1+1, 기획 구성 가격도 비교되나요?',
    a: '단순 판매가뿐 아니라 1+1·N개 기획의 개당 실질가와 ml(g)당 가격까지 자동 계산해 구매 효율을 정확히 비교할 수 있습니다.',
  },
];

// Merge page-specific unique FAQs first, then shared common ones.
function buildFaqs(h1: string, uniqueFaqs?: Array<{ q: string; a: string }>) {
  const selectionFaq = {
    q: `${h1.replace(' 최저가 비교', '')}는 어떻게 선정하나요?`,
    a: '광고나 협찬이 아니라 성분 안전성, 유해 우려 성분 배제, 사용감·피부 타입 적합도를 종합 검토해 합격한 제품만 추천합니다.',
  };
  return [...(uniqueFaqs ?? []), selectionFaq, ...COMMON_FAQS];
}

function schemaPrice(p: UIProduct): number {
  return p.lowestBasePrice && p.lowestBasePrice > 0 ? p.lowestBasePrice : p.lowestPrice;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { page, products } = await getSeoPageData(slug);
  if (!page || products.length < MIN_SEO_PRODUCTS) {
    return { title: 'ViewtyPick', robots: { index: false, follow: false } };
  }
  const url = `${SITE_URL}/best/${slug}`;
  const spec = SEO_PAGE_SPECS.find((s) => s.slug === slug);
  const title = page.title || page.h1 || 'ViewtyPick 추천';
  // Enrich meta description with product count and top brand for uniqueness/CTR.
  const topBrand = products[0]?.brand;
  const count = products.length;
  const baseDesc = page.description || `${page.h1} — 쿠팡·올리브영·네이버 최저가 비교`;
  const description = spec
    ? `${baseDesc} 총 ${count}개 제품 · ${topBrand ? topBrand + ' 등 ' : ''}성분 검증 추천.`
    : baseDesc;
  const indexable = isSiteIndexable();
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website', siteName: 'ViewtyPick' },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function BestPage({ params }: PageProps) {
  const { slug } = await params;
  const { page, products } = await getSeoPageData(slug);

  // Thin-content guard: a page must back >= MIN_SEO_PRODUCTS products to exist.
  if (!page || products.length < MIN_SEO_PRODUCTS) notFound();

  const h1 = page.h1 || page.title || '추천 최저가 비교';
  const spec = SEO_PAGE_SPECS.find((s) => s.slug === slug);
  const faqs = buildFaqs(h1, spec?.uniqueFaqs);
  const url = `${SITE_URL}/best/${slug}`;

  // Last updated: find the freshest crawled_at among products with a price.
  const lastUpdated = products
    .map((p) => p.lastUpdated)
    .filter(Boolean)
    .sort()
    .at(-1);

  // TOP3 products (priced) for the summary block.
  const top3 = products.filter((p) => p.hasAnyPrice !== false).slice(0, 3);

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
            brand: { '@type': 'Brand', name: p.brand },
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
          { '@type': 'ListItem', position: 2, name: '추천 가이드', item: `${SITE_URL}/best` },
          { '@type': 'ListItem', position: 3, name: page.title || h1, item: url },
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
          <div className="flex items-center justify-between">
            <Badge type="accent" className="w-fit">2026 베스트 추천 · 실시간 최저가</Badge>
            {lastUpdated && (
              <span className="text-[10px] text-sub font-semibold">
                가격 업데이트: {formatDate(lastUpdated)}
              </span>
            )}
          </div>
          <h1 className="text-[22px] font-black text-title leading-tight tracking-tight mt-1">{h1}</h1>
          {page.description && (
            <p className="text-[12px] text-body opacity-85 mt-1 font-semibold leading-relaxed">{page.description}</p>
          )}
          {/* P1: per-page unique intro from spec */}
          {spec?.intro && (
            <p className="text-[12px] text-body opacity-75 mt-1.5 font-medium leading-relaxed border-t border-line pt-2">
              {spec.intro}
            </p>
          )}
          <p className="text-[11px] text-sub font-bold mt-1.5">
            성분 검증을 통과한 추천 제품 <strong>{products.length}개</strong>를 쿠팡·올리브영·네이버 가격으로 비교했어요.
          </p>
        </div>
      </section>

      {/* P1: TOP3 최저가 요약 블록 */}
      {top3.length >= 3 && (
        <section className="px-4 pt-4 pb-0 bg-bg">
          <div className="bg-white border border-line rounded-card p-4 shadow-sm">
            <h2 className="text-[12px] font-black text-primary-dark mb-2.5">현재 최저가 TOP 3</h2>
            <div className="flex flex-col divide-y divide-divider">
              {top3.map((p, i) => (
                <Link
                  key={p.id}
                  href={`/p/${p.slug}`}
                  className="flex items-center justify-between py-2 gap-2 active:opacity-70 transition-opacity"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`flex-none w-5 h-5 flex items-center justify-center rounded text-[11px] font-black ${
                      i === 0 ? 'bg-primary text-white' : i === 1 ? 'bg-accent text-primary' : 'bg-secondary-soft text-secondary-dark'
                    }`}>{i + 1}</span>
                    <span className="text-[12px] font-bold text-title truncate">{p.name}</span>
                  </div>
                  <div className="flex-none flex flex-col items-end">
                    <PriceText price={p.lowestPrice} size="sm" />
                    {p.bestIsMultipack && (
                      <span className="text-[9px] text-sub font-bold">/개</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Ranked product list */}
      <section className="px-4 py-5 bg-bg flex flex-col gap-3.5">
        <h2 className="text-[15px] font-black text-title tracking-tight">추천 제품 리스트 ({products.length}개)</h2>
        <div className="flex flex-col gap-3">
          {products.map((prod, idx) => (
            <div key={prod.id} className="flex flex-col gap-0">
              <ProductListCard product={prod} rank={idx + 1} />
              {/* P1: show first reason item below card as unique content signal */}
              {prod.reasonItems.length > 0 && (
                <div className="bg-[#F8F6EE] border border-t-0 border-line rounded-b-card px-3 py-1.5">
                  <p className="text-[11px] text-body font-semibold leading-snug">
                    <span className="text-primary font-black">✓ </span>
                    {prod.reasonItems[0]}
                  </p>
                </div>
              )}
            </div>
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

      {/* FAQ (rich result — also useful for AI Overview citation) */}
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

      {/* Internal links to related guides */}
      <section className="px-4 py-6 bg-[#F0EEE2] text-center border-t border-line text-[11px] text-[#A2A08E] font-bold">
        <p className="mb-2">다른 추천 가이드 둘러보기</p>
        <Link href="/best" className="underline hover:text-primary">전체 추천 가이드 보기 →</Link>
      </section>
    </AppShell>
  );
}
