'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
}

export default function Header({
  title,
  subtitle,
  showBack = false,
  rightAction,
}: HeaderProps) {
  const router = useRouter();

  if (!showBack) {
    // 1. Home / Branding Header (UI_DESIGN.md §4)
    return (
      <header className="w-full bg-bg px-4 pt-5 pb-3 flex justify-between items-center z-30">
        <div className="flex flex-col">
          <h1 className="text-[22px] font-black text-primary tracking-tight leading-tight">
            ViewtyPick
          </h1>
          <span className="text-[12px] text-sub font-medium leading-none mt-0.5">
            {subtitle || '믿고 사는 뷰티 최저가'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {rightAction || (
            <Link
              href="/wishlist"
              className="p-2 text-[#29272A] hover:text-primary active:scale-95 transition-transform"
              aria-label="관심상품 이동"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </Link>
          )}
        </div>
      </header>
    );
  }

  // 2. Subpage Header (with Back button)
  return (
    <header className="w-full h-14 bg-bg border-b border-divider px-4 flex items-center justify-between sticky top-0 z-35">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1 text-title hover:bg-bg-warm rounded-full transition-colors active:scale-95"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        {title && (
          <h2 className="text-[17px] font-extrabold text-title tracking-tight truncate max-w-[240px]">
            {title}
          </h2>
        )}
      </div>
      <div className="flex items-center gap-2">
        {rightAction || (
          <button
            onClick={() => alert('공유 기능은 준비 중입니다!')}
            className="p-2 text-title hover:text-primary active:scale-95 transition-transform"
            aria-label="Share"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
}
