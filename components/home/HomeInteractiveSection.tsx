'use client';

import React, { useState, useMemo, useEffect } from 'react';
import SearchBar from '../common/SearchBar';
import CurationCarousel from './CurationCarousel';
import { SkinTypeAndCategorySection } from './SkinTypeAndCategorySection';
import ProductCarousel from '../product/ProductCarousel';
import TodayDealSection from './TodayDealSection';
import { UIProduct } from '../../lib/types';

interface Props {
  allProducts: UIProduct[];
  recommended: UIProduct[];
  officialPicks: UIProduct[];
}

export default function HomeInteractiveSection({ allProducts, recommended, officialPicks }: Props) {
  const [selectedSkin, setSelectedSkin] = useState<string | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Sync skin type selection with localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('selectedSkinType');
    if (saved) {
      setSelectedSkin(saved);
    }
  }, []);

  // Filter recommended products based on selected skin type, falling back to all recommended products
  const carouselProducts = useMemo(() => {
    if (!selectedSkin) return recommended;
    // Get top recommended products matching skin type
    return [...allProducts]
      .filter((p) => p.skinTypes.includes(selectedSkin))
      .sort((a, b) => b.viewtyScore - a.viewtyScore)
      .slice(0, 8);
  }, [allProducts, recommended, selectedSkin]);

  const handleSkinFilter = (skin: string) => {
    setSelectedSkin((prev) => {
      const next = prev === skin ? null : skin;
      if (next) {
        localStorage.setItem('selectedSkinType', next);
        // Dispatch custom event to notify other components (e.g. category list)
        window.dispatchEvent(new Event('selectedSkinTypeChanged'));
      } else {
        localStorage.removeItem('selectedSkinType');
        window.dispatchEvent(new Event('selectedSkinTypeChanged'));
      }
      return next;
    });
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

      {/* Skin Type Section (Categories removed) */}
      <SkinTypeAndCategorySection selectedSkin={selectedSkin} onSkinSelect={handleSkinFilter} />

      {/* Dynamic Recommended Products Carousel */}
      {carouselProducts.length > 0 && (
        <section className="py-4 bg-bg flex flex-col gap-3">
          <h3 className="px-4 text-[15px] font-black text-title tracking-tight flex items-center gap-1.5">
            <span>
              뷰티 PICK 오늘의 {selectedSkin ? `[${selectedSkin}] ` : ''}상품
            </span>
            <button
              onClick={() => setIsInfoOpen(true)}
              className="text-[#6F6667] hover:text-primary transition-colors cursor-pointer inline-flex items-center"
              aria-label="뷰티 스코어 산정 기준 보기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
            </button>
            <span className="text-xs bg-accent-light text-[#7A5B00] px-2 py-0.5 rounded-full font-extrabold leading-none ml-auto">
              매일 갱신
            </span>
          </h3>
          <ProductCarousel products={carouselProducts} />
        </section>
      )}

      {/* Always render deals/history at the bottom - not wiped out by skin filter */}
      <TodayDealSection products={officialPicks} loading={false} />

      {/* Viewty Score explanation modal */}
      {isInfoOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-line rounded-[28px] max-w-[360px] w-full p-6 shadow-floating animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-start mb-3">
              <h4 className="text-[16px] font-black text-primary">뷰티 PICK 점수 (Viewty Score) 기준</h4>
              <button
                onClick={() => setIsInfoOpen(false)}
                className="text-text-secondary hover:text-primary transition-colors cursor-pointer p-0.5"
                aria-label="닫기"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-[11.5px] text-text-secondary font-semibold leading-relaxed mb-5">
              뷰티 PICK의 추천 순위는 광고를 배제하고 전문가 추천, 실사용 만족도, 판매처별 최저 가격 혜택을 자체 알고리즘으로 평가한 점수입니다.
            </p>
            
            <div className="flex flex-col gap-4">
              {/* Item 1 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[12px] font-black">
                  <span className="text-title">1. 추천 신뢰성 (Credibility)</span>
                  <span className="text-primary">50%</span>
                </div>
                <div className="w-full bg-[#EFE6DF] h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '50%' }} />
                </div>
                <span className="text-[10px] text-text-secondary font-bold leading-none">디렉터파이 합격템, 화해 랭킹, 올영 베스트 선정 여부</span>
              </div>

              {/* Item 2 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[12px] font-black">
                  <span className="text-title">2. 가격 경쟁력 (Competitiveness)</span>
                  <span className="text-primary">35%</span>
                </div>
                <div className="w-full bg-[#EFE6DF] h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '35%' }} />
                </div>
                <span className="text-[10px] text-text-secondary font-bold leading-none">동일 용량 대비 최저가 상위 비율, 공식몰 대비 할인폭</span>
              </div>

              {/* Item 3 */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[12px] font-black">
                  <span className="text-title">3. 판매처 다양성 (Availability)</span>
                  <span className="text-primary">15%</span>
                </div>
                <div className="w-full bg-[#EFE6DF] h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '15%' }} />
                </div>
                <span className="text-[10px] text-text-secondary font-bold leading-none">올리브영, 쿠팡, 네이버 3대 쇼핑몰 동시 입점 및 가격 갱신</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
