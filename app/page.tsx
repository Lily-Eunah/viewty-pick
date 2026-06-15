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

  const skinTypes = [
    { name: '건성', icon: (color: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-5 h-5 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M4.75 12h1.5M17.75 12h1.5M6.85 6.85l1.06 1.06M16.09 16.09l1.06 1.06M6.85 17.15l1.06-1.06M16.09 7.91l1.06-1.06" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5z" />
      </svg>
    )},
    { name: '지성', icon: (color: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-5 h-5 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75h4.5v4.5h-4.5z" />
      </svg>
    )},
    { name: '복합성', icon: (color: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-5 h-5 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
      </svg>
    )},
    { name: '민감성', icon: (color: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-5 h-5 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
      </svg>
    )},
    { name: '수부지', icon: (color: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-5 h-5 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 3h.008" />
      </svg>
    )}
  ];

  const homeCategories = [
    { slug: 'sunscreen', name: '선크림', icon: (color: string, accentColor: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-6 h-6 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M4.75 12h1.5M17.75 12h1.5" />
        <path strokeLinecap="round" strokeLinejoin="round" stroke={accentColor} d="M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
      </svg>
    ), path: '/c/sunscreen' },
    { slug: 'toner', name: '스킨/토너', icon: (color: string, accentColor: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-6 h-6 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1 1 15 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" stroke={accentColor} d="M12 8.25v3" />
      </svg>
    ), path: '/c/toner' },
    { slug: 'lotion', name: '로션', icon: (color: string, accentColor: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-6 h-6 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75h4.5v4.5h-4.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" stroke={accentColor} d="M6.75 5.25h10.5v13.5H6.75V5.25z" />
      </svg>
    ), path: 'alert' },
    { slug: 'cream', name: '크림', icon: (color: string, accentColor: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-6 h-6 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.625a2.25 2.25 0 01-2.24 2.125H6.615a2.25 2.25 0 01-2.24-2.125L3.75 7.5h16.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" stroke={accentColor} d="M8.25 3.75h7.5v3.75h-7.5z" />
      </svg>
    ), path: '/c/cream' },
    { slug: 'serum', name: '세럼', icon: (color: string, accentColor: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-6 h-6 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v11.896M14.25 3.104v11.896" />
        <path strokeLinecap="round" strokeLinejoin="round" stroke={accentColor} d="M7.5 15c0 2.485 2.015 4.5 4.5 4.5s4.5-2.015 4.5-4.5" />
      </svg>
    ), path: '/c/serum' },
    { slug: 'cleansing', name: '클렌징', icon: (color: string, accentColor: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-6 h-6 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v7.5" />
        <path strokeLinecap="round" strokeLinejoin="round" stroke={accentColor} d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75" />
      </svg>
    ), path: '/c/cleansing' },
    { slug: 'mask', name: '마스크', icon: (color: string, accentColor: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-6 h-6 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" stroke={accentColor} d="M20.25 12c0 4.556-3.694 8.25-8.25 8.25S3.75 16.556 3.75 12 7.444 3.75 12 3.75" />
      </svg>
    ), path: 'alert' },
    { slug: 'more', name: '더보기', icon: (color: string, accentColor: string) => (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke={color} className="w-6 h-6 transition-colors duration-150">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25Z" />
      </svg>
    ), path: 'alert' }
  ];

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

  const handleCategoryClick = (e: React.MouseEvent, path: string, name: string) => {
    if (path === 'alert') {
      e.preventDefault();
      alert(`"${name}" 카테고리는 준비 중입니다! (Phase 5 출시 예정)`);
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

      {/* Skin Type Shortcuts (Figma UI §1) */}
      <section className="px-4 py-3 bg-bg flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h3 className="text-[14px] font-black text-title tracking-tight">
            내 피부 타입은?
          </h3>
          <button className="text-[11px] font-bold text-text-secondary hover:text-primary transition-colors">
            수정 &gt;
          </button>
        </div>
        
        <div className="flex justify-around items-center py-2 bg-surface rounded-card border border-line p-4 shadow-sm">
          {skinTypes.map((skin) => {
            const isSelected = selectedSkin === skin.name;
            const iconColor = isSelected ? '#410016' : '#6F6667';
            
            return (
              <button
                key={skin.name}
                onClick={() => handleSkinFilter(skin.name)}
                className="flex flex-col items-center gap-2 group focus:outline-none"
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-200 active:scale-95 ${
                    isSelected
                      ? 'bg-accent-soft border-accent shadow-sm'
                      : 'bg-surface border-border hover:bg-surface-soft hover:border-accent'
                  }`}
                >
                  {skin.icon(iconColor)}
                </div>
                <span className={`text-[12px] font-bold transition-colors ${
                  isSelected ? 'text-primary font-black' : 'text-text-secondary group-hover:text-primary'
                }`}>
                  {skin.name}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Categories Grid (Figma UI §1) */}
      <section className="px-4 py-3 bg-bg flex flex-col gap-3">
        <h3 className="text-[14px] font-black text-title tracking-tight">
          카테고리
        </h3>
        <div className="grid grid-cols-4 gap-2.5">
          {homeCategories.map((cat) => {
            const isAlert = cat.path === 'alert';
            const defaultIconColor = '#410016';
            const defaultAccentColor = '#CA9BAA';
            
            return (
              <Link
                key={cat.slug}
                href={isAlert ? '#' : cat.path}
                onClick={(e) => isAlert && handleCategoryClick(e, cat.path, cat.name)}
                className="flex flex-col items-center justify-center gap-2 bg-surface border border-line rounded-card p-3.5 hover:bg-accent-soft hover:border-accent group transition-all duration-200 active:scale-[0.96] shadow-sm text-center"
              >
                <div className="w-10 h-10 flex items-center justify-center rounded-full bg-bg group-hover:bg-surface transition-colors">
                  {cat.icon(defaultIconColor, defaultAccentColor)}
                </div>
                <span className="text-[12px] font-black text-text-secondary group-hover:text-primary transition-colors truncate w-full">
                  {cat.name}
                </span>
              </Link>
            );
          })}
        </div>
      </section>trokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5 text-sub">
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
