'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '../components/layout/AppShell';
import Header from '../components/layout/Header';
import SearchBar from '../components/common/SearchBar';
import ProductCarousel from '../components/product/ProductCarousel';
import ProductListCard from '../components/product/ProductListCard';
import { getRecommendedProducts, getTodayBestPriceProducts, getProducts } from '../lib/queries';
import { UIProduct } from '../lib/types';
import { SkinTypeAndCategorySection } from '../components/home/SkinTypeAndCategorySection';
import TodayDealSection from '../components/home/TodayDealSection';

export default function Home() {
  const [selectedSkin, setSelectedSkin] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<UIProduct[]>([]);
  const [bestDrops, setBestDrops] = useState<UIProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const recs = await getRecommendedProducts(8);
        const drops = await getTodayBestPriceProducts(5);
        setRecommended(recs);
        setBestDrops(drops);
        
        // Load default filtered items
        const allProds = await getProducts();
        setFilteredProducts(allProds);
      } catch (e) {
        console.error('Failed to load home data', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Handle skin filter click
  const handleSkinFilter = async (skin: string) => {
    const nextSkin = selectedSkin === skin ? null : skin;
    setSelectedSkin(nextSkin);
    
    setLoading(true);
    try {
      const prods = await getProducts({ skinType: nextSkin || undefined });
      setFilteredProducts(prods);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchRedirect = () => {
    alert('검색 기능은 준비 중입니다! (Phase 5 출시 예정)');
  };

  return (
    <AppShell activeTab="home">
      <Header />
      
      {/* Search Bar section */}
      <section className="px-4 py-2 bg-bg">
        <SearchBar onClick={handleSearchRedirect} readOnly />
      </section>

      {/* Hero Banner (Figma UI §1) */}
      <section className="px-4 py-4 bg-bg">
        <Link
          href="/pick/directorpi/sunscreen"
          className="relative block w-full rounded-card-lg p-5 flex flex-col justify-between hover:opacity-98 active:scale-[0.99] transition-all shadow-[0_8px_24px_rgba(65,0,22,0.04)] overflow-hidden border border-line"
          style={{ background: 'linear-gradient(135deg, #F6E7EC 0%, #FBF7F1 52%, #F7EFE7 100%)' }}
        >
          <div className="flex flex-col gap-2 z-10 max-w-[65%]">
            <h2 className="text-[20px] font-black text-primary leading-tight tracking-tight">
              피부에 밸런스를,<br />
              가격에는 합리성을
            </h2>
            <p className="text-[12px] text-text-secondary font-bold leading-relaxed mt-1">
              매일 똑똑하게 뷰티 쇼핑하세요
            </p>
            
            <div className="mt-4">
              <span className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-primary text-white text-[12px] font-extrabold rounded-full shadow-sm hover:bg-primary-hover transition-colors">
                <span>추천 선크림 보기</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </span>
            </div>
          </div>

          {/* Right decoration (mock image of sunscreen bottles) */}
          <div className="absolute right-2 bottom-4 w-[110px] h-[110px] opacity-90 pointer-events-none select-none flex items-end justify-center">
            <span className="text-[72px] leading-none">🧴</span>
          </div>

          {/* Page Indicators (Bottom Left / Bottom Right) */}
          <div className="mt-8 flex items-center justify-between z-10">
            {/* Dots */}
            <div className="flex gap-1.5 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#D9C8C9]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#D9C8C9]" />
            </div>
            
            {/* Badge */}
            <span className="px-2 py-0.5 bg-[rgba(41,39,42,0.55)] text-white text-[10px] font-bold rounded-full">
              1/5
            </span>
          </div>
        </Link>
      </section>

      {/* Skin Type and Category Section */}
      <SkinTypeAndCategorySection selectedSkin={selectedSkin} onSkinSelect={handleSkinFilter} />

      {/* TOP 10 Carousel section */}
      {!selectedSkin && recommended.length > 0 && (
        <section className="py-4 bg-bg flex flex-col gap-3">
          <h3 className="px-4 text-[15px] font-black text-title tracking-tight flex items-center gap-1.5">
            <span>🔥 디렉터파이 추천 TOP</span>
            <span className="text-xs bg-accent-light text-[#7A5B00] px-2 py-0.5 rounded-full font-extrabold leading-none">
              실시간 랭킹
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
          {loading ? (
            <div className="w-full h-32 flex justify-center items-center text-sub font-bold">
              로딩 중...
            </div>
          ) : (
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
          )}
        </section>
      ) : (
        <TodayDealSection products={bestDrops} loading={loading} />
      )}

      {/* Bottom Legal disclaimer (DESIGN.md §12.3) */}
      <footer className="px-4 py-8 bg-[#F0EEE2] text-center flex flex-col gap-1.5 border-t border-line text-[11px] text-[#A2A08E] font-bold">
        <p>ViewtyPick은 판매처가 아니며, 제휴 수수료를 제공받을 수 있습니다.</p>
        <p>구매 전 최종 결제 가격과 프로모션 조건은 판매처에서 확인 바랍니다.</p>
        <p className="mt-3 text-[10px]">© 2026 ViewtyPick. All rights reserved.</p>
      </footer>
    </AppShell>
  );
}
