'use client';

import React from 'react';
import { useFavorites } from '../../lib/favorites';

interface FavoriteButtonProps {
  slug: string;
  className?: string;
  size?: number;
}

export default function FavoriteButton({ slug, className = '', size = 20 }: FavoriteButtonProps) {
  const { isFavorite, toggle, isMounted } = useFavorites();

  const active = isMounted && isFavorite(slug);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(slug);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center justify-center p-2 rounded-full bg-white/80 backdrop-blur-xs border border-line shadow-xs transition-all duration-200 hover:scale-110 active:scale-90 hover:bg-white select-none ${className}`}
      aria-label={active ? '관심상품 해제' : '관심상품 추가'}
      title={active ? '관심상품 해제' : '관심상품 추가'}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={`transition-colors duration-200 ${
          active ? 'fill-[#DE4B6C] stroke-[#DE4B6C]' : 'fill-none stroke-text-secondary'
        }`}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    </button>
  );
}
