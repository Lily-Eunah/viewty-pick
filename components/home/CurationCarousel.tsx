'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';

interface CurationItem {
  id: string;
  badge: string;
  category: string;
  title: string;
  subtitle: string;
  emoji: string;
  gradient: string;
}

const curations: CurationItem[] = [
  {
    id: 'directorpi-sunscreen',
    badge: 'directorpi',
    category: 'sunscreen',
    title: '피부에 밸런스를,\n가격에는 합리성을',
    subtitle: '화장품 성분 전문가 안심 오리지널 픽',
    emoji: '🧴',
    gradient: 'linear-gradient(135deg, #F6E7EC 0%, #FBF7F1 52%, #F7EFE7 100%)',
  },
  {
    id: 'hwahae-sunscreen',
    badge: 'hwahae',
    category: 'sunscreen',
    title: '랭킹과 성분으로\n검증된 선케어 비교',
    subtitle: '광고 제로! 진짜 평점 순위와 최저가',
    emoji: '☀️',
    gradient: 'linear-gradient(135deg, #EAF0F3 0%, #FBF7F1 52%, #FFFDF9 100%)',
  },
  {
    id: 'directorpi-skincare',
    badge: 'directorpi',
    category: 'skincare',
    title: '피부 장벽 탄탄,\n수분 집중 안심 케어',
    subtitle: '민감 피부 탈출을 위한 솔루션 픽',
    emoji: '💦',
    gradient: 'linear-gradient(135deg, #F6E7EC 0%, #FFFDF9 50%, #EAF0F3 100%)',
  },
  {
    id: 'directorpi-cleansing-care',
    badge: 'directorpi',
    category: 'cleansing-care',
    title: '자극 없이 깨끗하게,\n촉촉한 안심 세안',
    subtitle: '유해성분 없는 순한 세안제 추천 리스트',
    emoji: '🧼',
    gradient: 'linear-gradient(135deg, #F7EFE7 0%, #FBF7F1 52%, #FAEEF2 100%)',
  },
];

export default function CurationCarousel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollLeft, clientWidth } = containerRef.current;
    if (clientWidth === 0) return;
    const newIndex = Math.round(scrollLeft / clientWidth);
    setActiveIndex(newIndex);
  };

  const scrollTo = (index: number) => {
    if (!containerRef.current) return;
    const { clientWidth } = containerRef.current;
    containerRef.current.scrollTo({
      left: index * clientWidth,
      behavior: 'smooth',
    });
    setActiveIndex(index);
  };

  const slide = (direction: 'left' | 'right') => {
    if (!containerRef.current) return;
    const { clientWidth, scrollLeft } = containerRef.current;
    const targetScroll = direction === 'left'
      ? scrollLeft - clientWidth
      : scrollLeft + clientWidth;
    containerRef.current.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
    }
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  return (
    <section className="px-4 py-4 bg-bg relative group">
      {/* Curation Section Header */}
      <div className="flex justify-between items-center mb-3 px-1">
        <h3 className="text-[15px] font-black text-title tracking-tight">
          뷰티 PICK 추천 가이드
        </h3>
        <Link
          href="/pick"
          className="text-[11px] text-[#A8A0A0] hover:text-primary font-black transition-colors flex items-center gap-0.5"
          aria-label="추천 가이드 전체보기"
        >
          <span>전체보기</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-2.5 h-2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      </div>

      {/* Scrollable snap container */}
      <div
        ref={containerRef}
        className="flex w-full overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar rounded-card-lg border border-line shadow-[0_8px_24px_rgba(65,0,22,0.04)]"
      >
        {curations.map((item) => (
          <div
            key={item.id}
            className="w-full shrink-0 snap-center select-none"
            style={{ contentVisibility: 'auto' }}
          >
            <Link
              href={`/pick/${item.badge}/${item.category}`}
              className="relative block w-full p-5 flex flex-col justify-between hover:opacity-98 active:scale-[0.99] transition-all overflow-hidden min-h-[190px]"
              style={{ background: item.gradient }}
            >
              <div className="flex flex-col gap-2 z-10 max-w-[65%]">
                <h2 className="text-[20px] font-black text-primary leading-tight tracking-tight whitespace-pre-line">
                  {item.title}
                </h2>
                <p className="text-[12px] text-text-secondary font-bold leading-relaxed mt-1">
                  {item.subtitle}
                </p>
                
                <div className="mt-4">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-[11px] font-extrabold rounded-full shadow-sm hover:bg-primary-hover transition-colors">
                    <span>추천 제품 보기</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-2.5 h-2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </span>
                </div>
              </div>

              {/* Right decoration */}
              <div className="absolute right-4 bottom-5 w-[100px] h-[100px] opacity-90 pointer-events-none select-none flex items-end justify-center">
                <span className="text-[72px] leading-none">{item.emoji}</span>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* Subtle Navigation Arrows (Appear on hover) */}
      <button
        onClick={() => slide('left')}
        disabled={activeIndex === 0}
        className={`absolute left-7 top-[58%] -translate-y-1/2 bg-black/25 hover:bg-black/55 text-white p-2 rounded-full backdrop-blur-[2px] transition-all duration-200 cursor-pointer shadow-sm z-20 ${
          activeIndex === 0 ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'
        }`}
        aria-label="이전 큐레이션 보기"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
      </button>

      <button
        onClick={() => slide('right')}
        disabled={activeIndex === curations.length - 1}
        className={`absolute right-7 top-[58%] -translate-y-1/2 bg-black/25 hover:bg-black/55 text-white p-2 rounded-full backdrop-blur-[2px] transition-all duration-200 cursor-pointer shadow-sm z-20 ${
          activeIndex === curations.length - 1 ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'
        }`}
        aria-label="다음 큐레이션 보기"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3.5} stroke="currentColor" className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Interactive Dots indicator */}
      <div className="absolute bottom-9 right-8 z-10">
        <div className="flex gap-1.5 items-center bg-black/15 px-2.5 py-1.5 rounded-full backdrop-blur-[2px]">
          {curations.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollTo(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                activeIndex === idx ? 'bg-primary scale-125' : 'bg-white/60 hover:bg-white/90'
              }`}
              aria-label={`${idx + 1}번 큐레이션으로 이동`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
