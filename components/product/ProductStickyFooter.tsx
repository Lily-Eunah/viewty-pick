'use client';

import React from 'react';
import { won } from '../../lib/format';
import { UIStorePrice } from '../../lib/types';

interface ProductStickyFooterProps {
  cheapestStore: UIStorePrice | null;
}

export default function ProductStickyFooter({ cheapestStore }: ProductStickyFooterProps) {
  const handleLikeClick = () => {
    alert('관심상품 저장 기능은 준비 중입니다! (Phase 5 출시 예정)');
  };

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-white border-t border-line p-3 flex gap-3 z-40 shadow-[0_-5px_15px_rgba(0,0,0,0.04)]">
      <button
        onClick={handleLikeClick}
        className="h-[54px] w-[54px] border border-line rounded-btn flex items-center justify-center text-body active:scale-95 transition-transform shrink-0"
        aria-label="관심상품 저장"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
        </svg>
      </button>

      <a
        href={cheapestStore ? cheapestStore.url : '#'}
        target="_blank"
        rel="sponsored nofollow"
        className="flex-grow inline-flex items-center justify-center bg-primary-dark text-white font-extrabold text-[16px] h-[54px] rounded-btn shadow-md active:scale-[0.98] transition-transform"
      >
        {cheapestStore
          ? `${won(cheapestStore.price)}에 최저가 구매`
          : '최저가 구매하기'}
      </a>
    </div>
  );
}
