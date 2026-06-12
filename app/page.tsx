'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '../components/layout/AppShell';
import Header from '../components/layout/Header';
import SearchBar from '../components/common/SearchBar';
import Chip from '../components/common/Chip';
import ProductCarousel from '../components/product/ProductCarousel';
import ProductListCard from '../components/product/ProductListCard';
import { getRecommendedProducts, getTodayBestPriceProducts, getProducts } from '../lib/queries';
import { UIProduct } from '../lib/types';

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

  const skinTypes = ['민감성', '지성', '건성', '수부지', '복합성', '여드름성'];

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

      {/* Hero Banner (UI_DESIGN.md §4) */}
      <section className="px-4 py-4 bg-bg">
        <Link
          href="/pick/directorpi/sunscreen"
          className="block w-full bg-background-warm rounded-card-lg p-5 flex flex-col justify-between hover:opacity-98 active:scale-[0.99] transition-transform shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
        >
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-black text-primary-dark uppercase tracking-wider">
              Curation Guide
            </span>
            <h2 className="text-[21px] font-black text-title leading-tight tracking-tight">
              디렉터파이 추천 선크림<br />
              최저가 한눈에 비교하기
            </h2>
            <p className="text-[12px] text-body opacity-85 mt-1 font-semibold leading-relaxed">
              성분 검증 완료! 민감성 피부도 안심하고<br />
              참고할 수 있는 합격 제품 가격 비교
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="px-3.5 py-2 bg-primary-dark text-white text-[12px] font-extrabold rounded-md shadow-sm">
              추천 제품 보기
            </span>
            <span className="text-[20px]" aria-hidden="true">☀️</span>
          </div>
        </Link>
      </section>

      {/* Skin Type Filter Chips */}
      <section className="py-3 bg-bg flex flex-col gap-2">
        <h3 className="px-4 text-[14px] font-black text-title tracking-tight">
          내 피부 타입으로 찾기
        </h3>
        <div className="w-full overflow-x-auto no-scrollbar flex gap-2 px-4 pb-1">
          {skinTypes.map((skin) => (
            <Chip
              key={skin}
              label={skin}
              selected={selectedSkin === skin}
              onClick={() => handleSkinFilter(skin)}
            />
          ))}
        </div>
      </section>

      {/* Categories Grid (UI_DESIGN.md §4) */}
      <section className="px-4 py-3 bg-bg flex flex-col gap-3">
        <h3 className="text-[14px] font-black text-title tracking-tight">
          인기 카테고리
        </h3>
        <div className="grid grid-cols-2 gap-2.5">
          <Link
            href="/c/sunscreen"
            className="flex items-center justify-between bg-white border border-line rounded-card p-4 hover:bg-[#FAF9F3] active:scale-[0.98] transition-all shadow-sm"
          >
            <span className="text-[14px] font-extrabold text-title">☀️ 선크림</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5 text-sub">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
          <Link
            href="/c/toner"
            className="flex items-center justify-between bg-white border border-line rounded-card p-4 hover:bg-[#FAF9F3] active:scale-[0.98] transition-all shadow-sm"
          >
            <span className="text-[14px] font-extrabold text-title">💧 토너</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5 text-sub">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
          <Link
            href="/c/cream"
            className="flex items-center justify-between bg-white border border-line rounded-card p-4 hover:bg-[#FAF9F3] active:scale-[0.98] transition-all shadow-sm"
          >
            <span className="text-[14px] font-extrabold text-title">🧴 크림</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5 text-sub">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
          <Link
            href="/c/serum"
            className="flex items-center justify-between bg-white border border-line rounded-card p-4 hover:bg-[#FAF9F3] active:scale-[0.98] transition-all shadow-sm"
          >
            <span className="text-[14px] font-extrabold text-title">✨ 세럼</span>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5 text-sub">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        </div>
      </section>

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

      {/* Dynamic Recommendation list */}
      <section className="px-4 py-4 bg-bg flex flex-col gap-3">
        <h3 className="text-[15px] font-black text-title tracking-tight">
          {selectedSkin ? `피부 고민 [${selectedSkin}] 추천 제품` : '오늘 가격 좋은 제품'}
        </h3>
        
        {loading ? (
          <div className="w-full h-32 flex justify-center items-center text-sub font-bold">
            로딩 중...
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {(selectedSkin ? filteredProducts : bestDrops).map((prod) => (
              <ProductListCard key={prod.id} product={prod} />
            ))}
            {!loading && (selectedSkin ? filteredProducts : bestDrops).length === 0 && (
              <div className="w-full text-center py-12 text-sub font-bold border border-dashed border-line rounded-card bg-white">
                조건에 맞는 제품이 없습니다.
              </div>
            )}
          </div>
        )}
      </section>

      {/* Bottom Legal disclaimer (DESIGN.md §12.3) */}
      <footer className="px-4 py-8 bg-[#F0EEE2] text-center flex flex-col gap-1.5 border-t border-line text-[11px] text-[#A2A08E] font-bold">
        <p>ViewtyPick은 판매처가 아니며, 제휴 수수료를 제공받을 수 있습니다.</p>
        <p>구매 전 최종 결제 가격과 프로모션 조건은 판매처에서 확인 바랍니다.</p>
        <p className="mt-3 text-[10px]">© 2026 ViewtyPick. All rights reserved.</p>
      </footer>
    </AppShell>
  );
}
