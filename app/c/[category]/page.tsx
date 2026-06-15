import AppShell from '../../../components/layout/AppShell';
import Header from '../../../components/layout/Header';
import CategoryProductList from '../../../components/product/CategoryProductList';
import { getCategoryPageData } from '../../../lib/queries';

interface PageProps {
  params: Promise<{ category: string }>;
}

function getCategoryTagline(slug: string, categoryName: string): string {
  if (slug === 'sunscreen') return '민감한 피부도 안심하고 사용할 수 있는 검증된 추천 선크림';
  if (slug === 'toner') return '피부 결 정돈과 즉각적 수분 수급을 위한 진정 토너 리스트';
  if (slug === 'cream') return '보습 장벽 강화 및 피부 밀착 보습을 돕는 안심 크림 리스트';
  return `${categoryName} 카테고리의 최저가 비교 리스트입니다.`;
}

export default async function CategoryPage({ params }: PageProps) {
  const { category: categorySlug } = await params;
  const { category, products } = await getCategoryPageData(categorySlug);

  return (
    <AppShell activeTab="category">
      {/* Dynamic Back Header */}
      <Header
        showBack
        title={category?.name || '카테고리'}
        rightAction={<div className="w-5" />} // Spacer
      />

      {/* Category Hero / Header */}
      <section className="bg-bg px-4 py-4.5 border-b border-line">
        <h2 className="text-[20px] font-black text-title leading-tight tracking-tight">
          {category?.name || '뷰티 제품'}
        </h2>
        <p className="text-[12px] text-body opacity-85 font-semibold mt-1 leading-relaxed">
          {getCategoryTagline(categorySlug, category?.name || '')}
        </p>
      </section>

      <CategoryProductList initialProducts={products} />
    </AppShell>
  );
}
