'use client';

import React from 'react';
import Link from 'next/link';

interface BottomTabBarProps {
  activeTab: 'home' | 'category' | 'search' | 'wishlist' | 'my';
}

export default function BottomTabBar({ activeTab }: BottomTabBarProps) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-[72px] bg-surface border-t border-line flex items-center justify-around px-4 z-40 shadow-[0_-4px_10px_rgba(65,0,22,0.03)]">
      {/* 1. 홈 */}
      <Link
        href="/"
        className={`flex flex-col items-center justify-center gap-0.5 w-[68px] py-1.5 rounded-xl transition-all duration-200 ${
          activeTab === 'home' ? 'text-primary bg-accent-soft font-black shadow-[0_2px_8px_rgba(65,0,22,0.03)]' : 'text-[#A8A0A0] hover:text-[#29272A]'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-5.5 h-5.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
        <span className="text-[11px] font-bold">홈</span>
      </Link>

      {/* 2. 카테고리 */}
      <Link
        href="/c"
        className={`flex flex-col items-center justify-center gap-0.5 w-[68px] py-1.5 rounded-xl transition-all duration-200 ${
          activeTab === 'category' ? 'text-primary bg-accent-soft font-black shadow-[0_2px_8px_rgba(65,0,22,0.03)]' : 'text-[#A8A0A0] hover:text-[#29272A]'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-5.5 h-5.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
        </svg>
        <span className="text-[11px] font-bold">카테고리</span>
      </Link>

      {/* 3. 검색 */}
      <Link
        href="/search"
        className={`flex flex-col items-center justify-center gap-0.5 w-[68px] py-1.5 rounded-xl transition-all duration-200 ${
          activeTab === 'search' ? 'text-primary bg-accent-soft font-black shadow-[0_2px_8px_rgba(65,0,22,0.03)]' : 'text-[#A8A0A0] hover:text-[#29272A]'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-5.5 h-5.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
        </svg>
        <span className="text-[11px] font-bold">검색</span>
      </Link>

      {/* 4. 관심상품 */}
      <Link
        href="/wishlist"
        className={`flex flex-col items-center justify-center gap-0.5 w-[68px] py-1.5 rounded-xl transition-all duration-200 ${
          activeTab === 'wishlist' ? 'text-primary bg-accent-soft font-black shadow-[0_2px_8px_rgba(65,0,22,0.03)]' : 'text-[#A8A0A0] hover:text-[#29272A]'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-5.5 h-5.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
        </svg>
        <span className="text-[11px] font-bold">관심상품</span>
      </Link>

      {/* 5. 마이 */}
      <Link
        href="/my"
        className={`flex flex-col items-center justify-center gap-0.5 w-[68px] py-1.5 rounded-xl transition-all duration-200 ${
          activeTab === 'my' ? 'text-primary bg-accent-soft font-black shadow-[0_2px_8px_rgba(65,0,22,0.03)]' : 'text-[#A8A0A0] hover:text-[#29272A]'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-5.5 h-5.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
        <span className="text-[11px] font-bold">마이</span>
      </Link>

    </nav>
  );
}
