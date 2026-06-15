import React from 'react';
import Link from 'next/link';
import AppShell from '../../../../components/layout/AppShell';
import Header from '../../../../components/layout/Header';
import ProductListCard from '../../../../components/product/ProductListCard';
import Badge from '../../../../components/common/Badge';
import { getPickPageData } from '../../../../lib/queries';

interface PageProps {
  params: Promise<{ badge: string; category: string }>;
}

function getBadgeName(slug: string): string {
  if (slug === 'directorpi') return '디렉터파이';
  if (slug === 'hwahae') return '화해 랭킹';
  return slug;
}

const FAQS = [
  {
    q: (badge: string, cat: string) => `Q. ${badge} 추천 ${cat}은 어떤 기준인가요?`,
    a: '성분의 유해성 배제 여부, 사용감 테스트, 피부 타입 적합도 등을 종합 검토하여 엄격하게 선정된 제품만을 참고 및 추천합니다.',
  },
  {
    q: () => 'Q. 가격비교 최저가는 어떻게 집계되나요?',
    a: '국내 온/오프라인 대표 스토어(쿠팡, 올리브영, 네이버 브랜드스토어 등)의 가격 데이터를 매일 새벽 04:00에 수동/자동 파이프라인으로 집계하여 노출합니다.',
  },
  {
    q: () => 'Q. 프로모션 혜택(1+1) 계산 방식이 궁금합니다.',
    a: '단순 판매가뿐 아니라 1+1, 2+1 기획 구성의 개당 실질 가격(effective price) 및 ml당 가격을 별도로 자동 계산해 제공하므로 구매 효율을 정확히 비교할 수 있습니다.',
  },
];

export default async function GuidePage({ params }: PageProps) {
  const { badge: badgeSlug, category: categorySlug } = await params;
  const { category, products } = await getPickPageData(badgeSlug, categorySlug);
  const badgeName = getBadgeName(badgeSlug);

  return (
    <AppShell activeTab="category">
      <Header showBack title="큐레이션 가이드" />

      {/* SEO Banner Hero (UI_DESIGN.md §10) */}
      <section className="bg-background-warm px-4 py-8 border-b border-line rounded-b-[28px] shadow-sm">
        <div className="flex flex-col gap-1.5">
          <Badge type="accent" className="w-fit">
            2026 베스트 추천
          </Badge>
          <h2 className="text-[22px] font-black text-title leading-tight tracking-tight mt-1">
            {badgeName} 추천 {category?.name || '화장품'}<br />
            실시간 최저가 비교
          </h2>
          <p className="text-[12px] text-body opacity-85 mt-2 font-semibold leading-relaxed">
            광고 제외! 성분 검증과 효과가 입증된 오리지널 합격 제품군만 선별해 판매처별 가격 및 1+1 실질 혜택가를 비교합니다.
          </p>
        </div>
      </section>

      {/* Recommended product list */}
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

      {/* Criteria check */}
      <section className="px-4 py-4 bg-bg">
        <div className="bg-white border border-line rounded-card p-4.5 flex flex-col gap-2">
          <h4 className="text-[13px] font-black text-primary-dark">✓ 뷰티픽 큐레이션 가격비교 기준</h4>
          <p className="text-[11px] text-sub font-semibold leading-relaxed">
            - 비공식 오픈마켓이나 스마트스토어 가품 차단을 위해 입증된 공식 판매처 및 대형 직매입 링크만 수집합니다.<br />
            - 쿠폰 할인, 멤버십 혜택, 카드 혜택 등 조건부 할인은 혼선을 주지 않기 위해 기본 최저가 집계에서 제외하고 개별 표기합니다.
          </p>
        </div>
      </section>

      {/* SEO structured FAQ (DESIGN.md §11) */}
      <section className="px-4 py-4.5 bg-bg flex flex-col gap-3">
        <h3 className="text-[14px] font-black text-title tracking-tight">
          자주 묻는 질문 (FAQ)
        </h3>
        
        <div className="flex flex-col gap-3">
          {FAQS.map((faq, idx) => (
            <div key={idx} className="bg-white border border-line rounded-card p-4 flex flex-col gap-1.5 shadow-sm">
              <h4 className="text-[13px] font-black text-title leading-snug">
                {faq.q(badgeName, category?.name || '제품')}
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
          <Link href="/skin/sensitive/sunscreen" className="underline hover:text-primary">민감성 선크림 가이드</Link>
          <Link href="/skin/oily/sunscreen" className="underline hover:text-primary">지성 선크림 가이드</Link>
        </div>
      </section>
    </AppShell>
  );
}
