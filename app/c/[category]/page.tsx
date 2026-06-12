'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import AppShell from '../../../components/layout/AppShell';
import Header from '../../../components/layout/Header';
import Chip from '../../../components/common/Chip';
import ProductListCard from '../../../components/product/ProductListCard';
import { getProducts, getCategoryBySlug } from '../../../lib/queries';
import { UIProduct, Category } from '../../../lib/types';

export default function CategoryPage() {
  const params = useParams();
  const categorySlug = params.category as string;

  const [category, setCategory] = useState<Category | null>(null);
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [selectedSkin, setSelectedSkin] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'recommend' | 'price_asc' | 'price_desc' | 'price_drop'>('recommend');
  const [loading, setLoading] = useState(true);

  // Load category details and products
  useEffect(() => {
    async function loadCategoryData() {
      setLoading(true);
      try {
        const cat = await getCategoryBySlug(categorySlug);
        setCategory(cat);

        const prods = await getProducts({
          category: categorySlug,
          skinType: selectedSkin || undefined,
          sortBy: sortBy,
        });
        setProducts(prods);
      } catch (e) {
        console.error('Failed to load category products', e);
      } finally {
        setLoading(false);
      }
    }
    loadCategoryData();
  }, [categorySlug, selectedSkin, sortBy]);

  const skinTypes = ['민감성', '지성', '건성', '수부지'];
  const sortOptions = [
    { key: 'recommend', label: '추천순' },
    { key: 'price_asc', label: '최저가순' },
    { key: 'price_drop', label: '가격하락순' },
  ] as const;

  // Render friendly category tagline
  const getCategoryTagline = () => {
    if (categorySlug === 'sunscreen') return '민감한 피부도 안심하고 사용할 수 있는 검증된 추천 선크림';
    if (categorySlug === 'toner') return '피부 결 정돈과 즉각적 수분 수급을 위한 진정 토너 리스트';
    if (categorySlug === 'cream') return '보습 장벽 강화 및 피부 밀착 보습을 돕는 안심 크림 리스트';
    return `${category?.name || '제품'} 카테고리의 최저가 비교 리스트입니다.`;
  };

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
          {getCategoryTagline()}
        </p>
      </section>

      {/* Filter Chips (Skin type & Sorting options) */}
      <section className="bg-bg py-2.5 flex flex-col gap-2 border-b border-line sticky top-14 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.01)]">
        {/* Skin chips */}
        <div className="w-full overflow-x-auto no-scrollbar flex gap-2 px-4">
          {skinTypes.map((skin) => (
            <Chip
              key={skin}
              label={skin}
              selected={selectedSkin === skin}
              onClick={() => setSelectedSkin(selectedSkin === skin ? null : skin)}
            />
          ))}
        </div>
        
        {/* Sort chips */}
        <div className="w-full overflow-x-auto no-scrollbar flex gap-2 px-4 mt-0.5 border-t border-[#F8F6EE] pt-2">
          {sortOptions.map((opt) => (
            <Chip
              key={opt.key}
              label={opt.label}
              selected={sortBy === opt.key}
              variant="sort"
              onClick={() => setSortBy(opt.key)}
            />
          ))}
        </div>
      </section>

      {/* Product List Section */}
      <section className="px-4 py-4 bg-bg flex-grow">
        {loading ? (
          <div className="w-full h-40 flex justify-center items-center text-sub font-bold">
            제품 로딩 중...
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {products.map((prod, idx) => (
              <ProductListCard
                key={prod.id}
                product={prod}
                rank={sortBy === 'recommend' ? idx + 1 : undefined}
              />
            ))}
            
            {products.length === 0 && (
              <div className="w-full text-center py-16 text-sub font-extrabold border border-dashed border-line rounded-card bg-white mt-4">
                필터 조건에 부합하는 제품이 없습니다.
              </div>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
