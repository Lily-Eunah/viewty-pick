import React from 'react';
import AppShell from '../../../components/layout/AppShell';
import Header from '../../../components/layout/Header';
import ProductImage from '../../../components/common/ProductImage';
import Badge from '../../../components/common/Badge';
import PriceText from '../../../components/common/PriceText';
import RecommendationReasonBox from '../../../components/product/RecommendationReasonBox';
import StorePriceList from '../../../components/product/StorePriceList';
import PriceTable from '../../../components/product/PriceTable';
import ProductCard from '../../../components/product/ProductCard';
import ProductStickyFooter from '../../../components/product/ProductStickyFooter';
import AffiliateDisclosure from '../../../components/common/AffiliateDisclosure';
import HistoryTracker from '../../../components/product/HistoryTracker';
import FavoriteButton from '../../../components/product/FavoriteButton';
import { getProductDetailPageData, getActiveProductSlugs } from '../../../lib/queries';
import { won, updatedAt } from '../../../lib/format';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Prerender every active product at BUILD time — the build runs off-Worker, so it
// is not subject to the Workers free-plan 10ms CPU budget that intermittently kills
// on-demand SSR (exceededCpu → 1102/503). dynamicParams (default) still renders
// brand-new slugs on demand until the next nightly build picks them up.
export async function generateStaticParams() {
  const slugs = await getActiveProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

// Prices change once a day (dawn crawl → rebuild/deploy refreshes the whole cache).
// Daily ISR is only the safety net for a missed deploy.
export const revalidate = 86400;

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const { product } = await getProductDetailPageData(slug);

  if (!product) {
    return {
      title: '제품 없음',
      description: '요청하신 제품 상세 정보를 찾을 수 없습니다.',
    };
  }

  return {
    title: `${product.brand} ${product.name} 최저가 비교`,
    description: `${product.brand} ${product.name} (${product.volume}) 제품의 판매처별 최저가 비교 및 뷰티 스코어 분석 정보입니다. 매일 갱신.`,
    alternates: {
      canonical: `https://viewtypick.com/p/${slug}`,
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const { product, related: relatedProducts } = await getProductDetailPageData(slug);

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

  // Volume context: when the cheapest seller's size differs from the product's
  // representative volume, show it next to the 최저가 so a big-pack 최저가 (and a
  // large 정가-대비 %) reads in context. Unit label drives "ml/매/g".
  const volLabel = product.volumeUnit ?? 'ml';
  const baseVolume = product.volumeMl ?? null;
  const bestVolume = cheapestStore?.volumeMl ?? null;
  const bestVolumeDiffers = bestVolume != null && bestVolume > 0 && baseVolume != null && bestVolume !== baseVolume;

  // Per-retailer volume: when priced sellers carry different sizes, the headline /
  // ranking is by ml당 (총가 비교는 작은 용량이 싸 보이는 착시). Surface a hint.
  const pricedVolumes = new Set(
    product.stores.filter((s) => s.hasPrice !== false && s.volumeMl != null && s.volumeMl > 0).map((s) => s.volumeMl)
  );
  const sizesDiffer = pricedVolumes.size > 1;

  // 정가 역전 가드: 1개 기준 최저가가 정가보다 높으면 그 정가는 신뢰할 수 없는 값(오기입 또는
  // 기획/증량 구성)이라 "정가보다 비싼 최저가"로 오독된다 → 정가·할인 표기를 숨긴다.
  // (도메인 원칙: 잘못된 가격은 no-price보다 나쁘다.)
  const regularPriceValid =
    product.regularPrice != null && product.regularPrice > 0 &&
    !(product.lowestBasePrice != null && product.lowestBasePrice > 0 && product.lowestBasePrice > product.regularPrice);

  // 상세 혜택 분석표는 구성(1+1/묶음)·로켓 등 비교 카드에 없는 정보를 펼칠 때만 가치가 있다.
  // 전 판매처가 단품·프로모션 없음이면 카드와 순수 중복이므로 섹션을 숨긴다.
  const tableAddsInfo = product.stores.some((s) => s.composition || s.isRocket || (s.quantity ?? 1) > 1);

  // JSON-LD structured data (Product + AggregateOffer) — priced offers only.
  const displayableOffers = product.stores.filter((s) => s.hasPrice !== false && s.price > 0);
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
      <HistoryTracker
        product={{
          id: product.id,
          slug: product.slug,
          brand: product.brand,
          name: product.name,
          image: product.image,
          lowestPrice: product.lowestPrice,
          volume: product.volume,
          viewtyScore: product.viewtyScore,
          category: product.category,
          majorCategory: product.majorCategory,
        }}
      />
      {/* Dynamic JSON-LD injection — only when the Product carries offers. A
          price-less (link-only) product would emit an offer-less Product, which
          Google rejects (needs offers/review/aggregateRating). Skip it instead. */}
      {jsonLd.offers && (
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
          category={product.majorCategory || product.category}
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

        <div className="flex justify-between items-start gap-4 mt-1">
          <div className="flex flex-col">
            <span className="text-[12px] font-black text-sub">{product.brand}</span>
            <h2 className="text-[19px] font-black text-title leading-tight tracking-tight mt-0.5">
              {product.name}
            </h2>
          </div>
          <FavoriteButton slug={product.slug} size={22} className="shrink-0 mt-0.5" />
        </div>
        <span className="text-[13px] text-body opacity-80 mt-1 font-semibold">
          용량/규격: {product.volume}
          {regularPriceValid ? (
            <span className="text-sub"> · 정가 {won(product.regularPrice!)}</span>
          ) : null}
        </span>

        {/* Pricing area */}
        <div className="flex flex-col gap-1 mt-4 pt-4 border-t border-[#F8F6EE]">
          {product.hasAnyPrice === false ? (
            <div className="flex flex-col gap-1">
              <span className="text-[16px] font-black text-sub">가격 확인 필요</span>
              <span className="text-[11px] text-text-secondary font-semibold">
                현재 수집된 판매처 가격이 없어요. 아래 판매처에서 직접 확인하세요.
              </span>
            </div>
          ) : (
            <div className="flex items-end gap-4 flex-wrap">
              <div className="flex flex-col">
                <span className="text-[11px] text-sub font-black leading-none">
                  {product.bestIsMultipack ? '개당 최저가' : '최저가'}
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <PriceText price={product.lowestPrice} size="xl" />
                  {product.bestIsMultipack && <span className="text-[12px] text-sub font-bold">/개</span>}
                  {bestVolumeDiffers && (
                    <span className="text-[12px] text-sub font-bold">({bestVolume}{volLabel})</span>
                  )}
                </div>
              </div>
              {product.bestIsMultipack && product.lowestBasePrice ? (
                <div className="flex flex-col">
                  <span className="text-[10px] text-sub font-bold leading-none">1개 기준 최저</span>
                  <span className="text-[15px] font-black text-title mt-1">{won(product.lowestBasePrice)}</span>
                </div>
              ) : null}
              {/* 할인 배지: 정가(시트 입력) 기준 — 정가는 용량/규격 옆에 표기, 여기선 % 만 */}
              {regularPriceValid && product.discountVsRegular != null && product.discountVsRegular > 0 ? (
                <div className="flex flex-col justify-end">
                  <span className="text-[12px] text-discount bg-accent-soft font-extrabold px-2.5 py-1 rounded-full">
                    정가 대비 {product.discountVsRegular}% 할인
                  </span>
                </div>
              ) : null}
            </div>
          )}

          {/* 판매처별 용량이 다를 때: ml당 기준 비교 안내 */}
          {sizesDiffer && (
            <span className="text-[10px] text-primary font-bold mt-2 leading-relaxed">
              판매처마다 용량이 달라요 · 최저가는 {volLabel}당 기준으로 비교했어요.
            </span>
          )}

          {/* Freshness (결제가·프로모션 안내는 아래 제휴 고지 박스로 이동) */}
          <span className="text-[10px] text-sub font-semibold mt-2 leading-relaxed">
            {product.lastUpdated ? `매일 오전 갱신 · 마지막 갱신 ${updatedAt(product.lastUpdated)}` : '매일 오전 자동 집계'}
          </span>
        </div>
      </section>

      {/* 4. Recommendation Checklist Box */}
      <section className="px-4 py-4.5 bg-bg">
        <RecommendationReasonBox
          features={product.features}
          reasons={product.reasonItems}
          verifiedNotes={product.badgeReasons}
        />
      </section>

      {/* Affiliate disclosure — directly above the price comparison (per-platform). */}
      {product.stores.length > 0 && (
        <section className="px-4 pt-3 bg-bg">
          <AffiliateDisclosure sellerSlugs={product.stores.map((s) => s.sellerSlug)} />
        </section>
      )}

      {/* 5. Retailer Comparison Cards */}
      <section className="px-4 py-3 bg-bg flex flex-col gap-3">
        <h3 className="text-[15px] font-black text-title tracking-tight">
          판매처별 최저가 비교
        </h3>
        
        {product.stores.length === 0 ? (
          <div className="text-center py-8 text-sub font-bold bg-surface border border-line rounded-card">
            현재 구매 가능한 활성 판매처가 없습니다.
          </div>
        ) : (
          <StorePriceList stores={product.stores} />
        )}
      </section>

      {/* 6. Comparison Table — only when it adds info beyond the cards (구성/로켓/묶음).
             All-단품·no-promo products would just duplicate the cards, so it's hidden. */}
      {product.stores.length > 0 && tableAddsInfo && (
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
