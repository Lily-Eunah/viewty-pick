import React from 'react';
import AppShell from '../../../components/layout/AppShell';
import Header from '../../../components/layout/Header';
import ProductImage from '../../../components/common/ProductImage';
import Badge from '../../../components/common/Badge';
import PriceText from '../../../components/common/PriceText';
import RecommendationReasonBox from '../../../components/product/RecommendationReasonBox';
import StorePriceCard from '../../../components/product/StorePriceCard';
import PriceTable from '../../../components/product/PriceTable';
import ProductCard from '../../../components/product/ProductCard';
import ProductStickyFooter from '../../../components/product/ProductStickyFooter';
import { getProductBySlug, getProducts } from '../../../lib/queries';
import { priceDrop } from '../../../lib/format';
import { UIProduct } from '../../../lib/types';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: '제품 없음 - ViewtyPick',
      description: '요청하신 제품 상세 정보를 찾을 수 없습니다.',
    };
  }

  return {
    title: `${product.brand} ${product.name} 실시간 최저가 비교 - ViewtyPick`,
    description: `${product.brand} ${product.name} (${product.volume}) 제품의 실시간 최저가비교 및 뷰티 스코어 분석 정보입니다.`,
    alternates: {
      canonical: `https://viewtypick.com/p/${slug}`,
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;

  const product = await getProductBySlug(slug);
  let relatedProducts: UIProduct[] = [];

  if (product) {
    try {
      const allProds = await getProducts({ category: product.category });
      relatedProducts = allProds.filter((p) => p.id !== product.id).slice(0, 4);
    } catch (e) {
      console.error('Failed to load related products', e);
    }
  }

  if (!product) {
    return (
      <AppShell activeTab="category">
        <Header showBack title="제품 없음" />
        <div className="w-full h-80 flex flex-col justify-center items-center gap-3 bg-bg">
          <span className="text-[32px]">🕵️‍♀️</span>
          <span className="text-sub font-black">해당 제품 정보를 찾을 수 없습니다.</span>
        </div>
      </AppShell>
    );
  }

  // Get cheapest store to feed the sticky buy button
  const cheapestStore = product.stores.find((s) => s.isBest) || product.stores[0] || null;

  // JSON-LD structured data (Product + AggregateOffer)
  const displayableOffers = product.stores;
  const basePrices = displayableOffers.map((s) => s.price).filter((p) => p > 0);
  const lowPrice = basePrices.length > 0 ? Math.min(...basePrices) : null;
  const highPrice = basePrices.length > 0 ? Math.max(...basePrices) : null;
  const offerCount = basePrices.length;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': product.name,
    'image': product.image,
    'description': product.description,
    'brand': {
      '@type': 'Brand',
      'name': product.brand,
    },
  };

  if (lowPrice !== null && lowPrice > 0) {
    jsonLd.offers = {
      '@type': 'AggregateOffer',
      'priceCurrency': 'KRW',
      'lowPrice': lowPrice,
      'highPrice': highPrice,
      'offerCount': offerCount,
      'offers': displayableOffers.map((store) => ({
        '@type': 'Offer',
        'price': store.price,
        'priceCurrency': 'KRW',
        'url': `https://viewtypick.com${store.url}`,
        'availability': 'https://schema.org/InStock',
        'seller': {
          '@type': 'Organization',
          'name': store.name,
        },
      })),
    };
  }

  return (
    <AppShell activeTab="category" showTabBar={false}>
      {/* Dynamic JSON-LD injection */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* 1. Header */}
      <Header
        showBack
        title={product.brand}
        subtitle="최저가 비교"
      />

      {/* 2. Large Image View */}
      <section className="w-full bg-white border-b border-line">
        <ProductImage
          src={product.image}
          alt={product.name}
          className="w-full max-h-[360px] aspect-square object-contain"
        />
      </section>

      {/* 3. Product Basic Info */}
      <section className="bg-white px-4 py-5 flex flex-col gap-2 rounded-b-[24px] border-b border-line shadow-sm">
        <div className="flex items-center gap-1.5 flex-wrap">
          {product.badges.map((b, idx) => (
            <Badge key={idx} type="trust">
              {b}
            </Badge>
          ))}
          {product.viewtyScore >= 90 && (
            <Badge type="accent">뷰티스코어 {product.viewtyScore}점</Badge>
          )}
        </div>

        <div className="flex flex-col mt-1">
          <span className="text-[12px] font-black text-sub">{product.brand}</span>
          <h2 className="text-[19px] font-black text-title leading-tight tracking-tight mt-0.5">
            {product.name}
          </h2>
          <span className="text-[13px] text-body opacity-80 mt-1 font-semibold">
            용량/규격: {product.volume}
          </span>
        </div>

        {/* Pricing area */}
        <div className="flex flex-col gap-1 mt-4 pt-4 border-t border-[#F8F6EE]">
          <span className="text-[11px] text-sub font-black leading-none">실시간 대표 최저가</span>
          <div className="flex items-baseline gap-2 mt-1">
            <PriceText price={product.lowestPrice} size="xl" />
            
            {product.priceDropAmount && product.priceDropAmount > 0 ? (
              <span className="text-[12px] text-price bg-price-bg font-extrabold px-2.5 py-1 rounded-full">
                {priceDrop(product.priceDropAmount)}
              </span>
            ) : null}
          </div>
          
          {/* Info helper */}
          <span className="text-[10px] text-sub font-semibold mt-1">
            * 갱신 기준: 매일 KST 04:00 자동 집계 · 실제 가격은 판매처 정보와 상이할 수 있습니다.
          </span>
        </div>
      </section>

      {/* 4. Recommendation Checklist Box */}
      <section className="px-4 py-4.5 bg-bg">
        <RecommendationReasonBox reasons={product.reasonItems} />
      </section>

      {/* 5. Retailer Comparison Cards */}
      <section className="px-4 py-3 bg-bg flex flex-col gap-3">
        <h3 className="text-[15px] font-black text-title tracking-tight">
          판매처별 최저가 비교
        </h3>
        
        <div className="flex flex-col gap-2.5">
          {product.stores.length === 0 ? (
            <div className="text-center py-8 text-sub font-bold bg-white border border-line rounded-card">
              현재 구매 가능한 활성 판매처가 없습니다.
            </div>
          ) : (
            product.stores.map((store, idx) => (
              <StorePriceCard key={idx} store={store} />
            ))
          )}
        </div>
      </section>

      {/* 6. Comparison Table (detailed breakdown) */}
      {product.stores.length > 0 && (
        <section className="px-4 py-4 bg-bg flex flex-col gap-3">
          <h3 className="text-[15px] font-black text-title tracking-tight">
            상세 혜택 분석표
          </h3>
          <PriceTable stores={product.stores} />
        </section>
      )}

      {/* 7. Related comparison products */}
      {relatedProducts.length > 0 && (
        <section className="px-4 py-5 bg-[#F0EEE2] flex flex-col gap-3.5 border-t border-line pb-[100px]">
          <h3 className="text-[15px] font-black text-title tracking-tight">
            함께 비교하기 좋은 제품
          </h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {relatedProducts.map((p) => (
              <div key={p.id} className="shrink-0 scale-95 origin-left">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 8. Sticky bottom purchase CTA */}
      <ProductStickyFooter cheapestStore={cheapestStore} />
    </AppShell>
  );
}
