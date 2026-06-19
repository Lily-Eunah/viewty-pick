'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import SearchBar from '../common/SearchBar';
import CurationCarousel from './CurationCarousel';
import { SkinTypeAndCategorySection } from './SkinTypeAndCategorySection';
import ProductCarousel from '../product/ProductCarousel';
import ProductListCard from '../product/ProductListCard';
import TodayDealSection from './TodayDealSection';
import { UIProduct } from '../../lib/types';

interface Props {
  allProducts: UIProduct[];
  recommended: UIProduct[];
  officialPicks: UIProduct[];
}

export default function HomeInteractiveSection({ allProducts, recommended, officialPicks }: Props) {
  const [selectedSkin, setSelectedSkin] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    if (!selectedSkin) return [];
    return allProducts.filter((p) => p.skinTypes.includes(selectedSkin));
  }, [allProducts, selectedSkin]);

  const handleSkinFilter = (skin: string) => {
    setSelectedSkin((prev) => (prev === skin ? null : skin));
  };

  const handleSearchRedirect = () => {
    alert('검색 기능은 준비 중입니다! (Phase 5 출시 예정)');
  };

  return (
    <>
      {/* Search Bar section */}
      <section className="px-4 py-2 bg-bg">
        <SearchBar onClick={handleSearchRedirect} readOnly />
      </section>

      {/* Curation Carousel Banners */}
      <CurationCarousel />

      {/* Skin Type and Category Section */}
      <SkinTypeAndCategorySection selectedSkin={selectedSkin} onSkinSelect={handleSkinFilter} />

      {/* TOP 10 Carousel section */}
      {!selectedSkin && recommended.length > 0 && (
        <section className="py-4 bg-bg flex flex-col gap-3">
          <h3 className="px-4 text-[15px] font-black text-title tracking-tight flex items-center gap-1.5">
            <span>🔥 디렉터파이 추천 TOP</span>
            <span className="text-xs bg-accent-light text-[#7A5B00] px-2 py-0.5 rounded-full font-extrabold leading-none">
              매일 갱신
            </span>
          </h3>
          <ProductCarousel products={recommended} />
        </section>
      )}

      {/* Today Deal Section / Skin recommendation list */}
      {selectedSkin ? (
        <section className="px-4 py-4 bg-bg flex flex-col gap-3">
          <h3 className="text-[15px] font-black text-title tracking-tight">
            피부 고민 [{selectedSkin}] 추천 제품
          </h3>
          <div className="flex flex-col gap-2.5">
            {filteredProducts.map((prod) => (
              <ProductListCard key={prod.id} product={prod} />
            ))}
            {filteredProducts.length === 0 && (
              <div className="w-full text-center py-12 text-sub font-bold border border-dashed border-line rounded-card bg-white">
                조건에 맞는 제품이 없습니다.
              </div>
            )}
          </div>
        </section>
      ) : (
        <TodayDealSection products={officialPicks} loading={false} />
      )}
    </>
  );
}
