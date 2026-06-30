import React from 'react';
import Link from 'next/link';
import AppShell from '../../../../components/layout/AppShell';
import Header from '../../../../components/layout/Header';
import ProductListCard from '../../../../components/product/ProductListCard';
import Badge from '../../../../components/common/Badge';
import { getSkinPageData } from '../../../../lib/queries';

// ISR: serve from cache, regenerate at most daily (+ on-demand via revalidateTag
// ('products') from the crawler). Product data is computed once globally.
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ type: string; category: string }>;
}

function getSkinDescription(slug: string, skinName: string): string {
  if (slug === 'sensitive') return '자극에 취약해 쉽게 붉어지는 민감성 피부를 위해 유해 가능 성분을 배제한 안전 선크림 목록입니다.';
  if (slug === 'oily') return '과다 피지 분비와 유분기가 고민인 지성 피부를 위한 보송보송하고 번들거림 없는 산뜻 케어 제품입니다.';
  if (slug === 'dry') return '피부 속 당김 and 각질 부각이 잦은 건성 타입을 위한 고보습 오일 함유 물광 스킨 케어 제품입니다.';
  return `${skinName} 피부에 최적화된 저자극 안심 추천 리스트입니다.`;
}

export default async function SkinPage({ params }: PageProps) {
  const { type: skinTypeSlug, category: categorySlug } = await params;
  const { category, products, skinName } = await getSkinPageData(skinTypeSlug, categorySlug);

  const faqs = [
    {
      q: `Q. ${skinName} 피부에 안전한 제품들인가요?`,
      a: `네, 뷰티픽의 추천 리스트는 성분 유해 물질 배제 기준을 통과하고, 실제 ${skinName} 피부 자극 인체적용시험 적합 판정을 완료한 검증 제품 위주로 구성되어 있습니다.`,
    },
    {
      q: 'Q. 이 제품들도 1+1 실질 최저가 비교가 되나요?',
      a: '물론입니다. 단품 판매가뿐 아니라 올리브영 1+1 묶음 구성 등의 개당 실효 가격을 자동 계산하여 보여드리므로, 낱개 구매 시와 기획세트 구매 시의 혜택을 완벽하게 저울질할 수 있습니다.',
    },
  ];

  return (
    <AppShell activeTab="category">
      <Header showBack title="피부타입 솔루션" />

      {/* SEO Banner Hero */}
      <section className="bg-background-warm px-4 py-8 border-b border-line rounded-b-[28px] shadow-sm">
        <div className="flex flex-col gap-1.5">
          <Badge type="trust" className="w-fit bg-white text-primary-dark">
            {skinName} 맞춤 추천
          </Badge>
          <h2 className="text-[22px] font-black text-title leading-tight tracking-tight mt-1">
            {skinName} 피부 추천 {category?.name || '화장품'}<br />
            실시간 최저가 비교
          </h2>
          <p className="text-[12px] text-body opacity-85 mt-2 font-semibold leading-relaxed">
            {getSkinDescription(skinTypeSlug, skinName)}
          </p>
        </div>
      </section>

      {/* Product list */}
      <section className="px-4 py-5 bg-bg flex flex-col gap-3.5">
        <h3 className="text-[15px] font-black text-title tracking-tight">
          추천 제품 리스트 ({products.length}개)
        </h3>

        <div className="flex flex-col gap-3">
          {products.map((prod, idx) => (
            <ProductListCard key={prod.id} product={prod} rank={idx + 1} />
          ))}
          {products.length === 0 && (
            <div className="w-full text-center py-12 text-sub font-bold border border-dashed border-line rounded-card bg-white">
              제품 목록을 준비하고 있습니다.
            </div>
          )}
        </div>
      </section>

      {/* SEO FAQ */}
      <section className="px-4 py-4.5 bg-bg flex flex-col gap-3">
        <h3 className="text-[14px] font-black text-title tracking-tight">
          자주 묻는 질문 (FAQ)
        </h3>
        
        <div className="flex flex-col gap-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-white border border-line rounded-card p-4 flex flex-col gap-1.5 shadow-sm">
              <h4 className="text-[13px] font-black text-title leading-snug">
                {faq.q}
              </h4>
              <p className="text-[12px] text-body opacity-85 font-semibold leading-relaxed pt-1.5 border-t border-[#F8F6EE]">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Related links */}
      <section className="px-4 py-6 bg-[#F0EEE2] text-center border-t border-line text-[11px] text-[#A2A08E] font-bold">
        <p className="mb-2">다른 피부 타입 맞춤형 가이드 둘러보기</p>
        <div className="flex justify-center gap-3.5 flex-wrap">
          <Link href="/skin/oily/sunscreen" className="underline hover:text-primary">지성 선크림 가이드</Link>
          <Link href="/skin/dry/sunscreen" className="underline hover:text-primary">건성 선크림 가이드</Link>
          <Link href="/best/directorpi-sunscreen" className="underline hover:text-primary">디렉터파이 전체 선크림</Link>
        </div>
      </section>
    </AppShell>
  );
}
