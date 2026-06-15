"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import ProductImageWithFallback from '../common/ProductImageWithFallback';
import Badge from '../common/Badge';
import { won } from '../../lib/format';
import { UIProduct } from '../../lib/types';

interface TodayDealSectionProps {
  products: UIProduct[];
  loading: boolean;
}

export default function TodayDealSection({ products, loading }: TodayDealSectionProps) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const toggleLike = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="px-4 py-4 bg-bg">
      {/* Section Header */}
      <div className="mb-3.5 px-1 flex items-center justify-between">
        <h3 className="text-[15px] font-black text-title tracking-tight flex items-center gap-1.5">
          <span>🔥 오늘 가격 좋은 제품</span>
          <span className="text-[10px] bg-accent-light text-[#8A1238] px-2 py-0.5 rounded-full font-black leading-none">
            실시간 비교
          </span>
        </h3>
      </div>

      {loading ? (
        <div className="w-full h-32 flex justify-center items-center text-sub font-bold">
          로딩 중...
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((prod, idx) => {
            const rank = idx + 1;
            const rating = (prod.viewtyScore ? (prod.viewtyScore / 20).toFixed(1) : "4.5");
            const reviewsCount = (prod.viewtyScore ? prod.viewtyScore * 13 + (Number(prod.id) || 1) * 7 : 1234);

            // Format features list cleanly
            const shortDesc = prod.features && prod.features.length > 0
              ? `${prod.features.slice(0, 2).join(' / ')} / ${prod.volume}`
              : `${prod.description} / ${prod.volume}`;

            return (
              <Link
                key={prod.id}
                href={`/p/${prod.slug}`}
                className="relative flex items-center bg-surface border border-line rounded-[18px] p-3 shadow-[0_8px_24px_rgba(65,0,22,0.06)] active:scale-[0.99] transition-transform duration-200 min-h-[142px] max-h-[150px] overflow-hidden"
              >
                {/* 1. Left Product Image Area with Ribbon/Rank */}
                <div className="relative w-[110px] h-[110px] rounded-xl overflow-hidden shrink-0">
                  {/* Rank Ribbon Badge */}
                  <div className="absolute top-0 left-0 bg-primary text-white text-[10px] font-black w-5.5 h-5.5 flex items-center justify-center rounded-br-md z-10 shadow-sm">
                    {rank}
                  </div>
                  <ProductImageWithFallback
                    src={prod.image}
                    alt={prod.name}
                    className="w-full h-full"
                  />
                </div>

                {/* 2. Right Product Info Details */}
                <div className="flex-grow flex flex-col justify-between pl-3.5 pr-8 py-0.5 min-h-[110px] overflow-hidden">
                  <div className="flex flex-col gap-0.5">
                    {/* Top Badges */}
                    <div className="flex flex-wrap items-center gap-1">
                      {prod.badges.slice(0, 2).map((badgeName, index) => (
                        <Badge key={index} className="px-1.5 py-0.5 text-[9.5px]">
                          {badgeName}
                        </Badge>
                      ))}
                    </div>

                    {/* Brand & Name */}
                    <span className="text-[10px] font-black text-text-secondary mt-1 leading-none uppercase tracking-wider">
                      {prod.brand}
                    </span>
                    <h4 className="text-[13.5px] font-black text-title tracking-tight line-clamp-1 leading-snug mt-0.5">
                      {prod.name}
                    </h4>

                    {/* Product Specs / Features Description */}
                    <span className="text-[10.5px] text-text-secondary font-semibold leading-none mt-1 truncate">
                      {shortDesc}
                    </span>
                  </div>

                  {/* Rating, Price & Price Drop */}
                  <div className="flex flex-col gap-1 mt-1.5">
                    {/* Stars and reviews */}
                    <div className="flex items-center text-[10px] text-text-secondary font-black gap-0.5 leading-none">
                      <span className="text-amber-500">★</span>
                      <span>{rating}</span>
                      <span className="text-muted">({reviewsCount.toLocaleString()})</span>
                    </div>

                    {/* Pricing Row */}
                    <div className="flex items-end justify-between mt-1">
                      <div className="flex items-center leading-none">
                        {/* Discount Rate */}
                        {prod.priceDropRate && prod.priceDropRate > 0 ? (
                          <span className="text-[14px] font-black text-discount mr-1.5">
                            {prod.priceDropRate}%
                          </span>
                        ) : null}
                        {/* Lowest Price */}
                        <span className="text-[15px] font-black text-primary">
                          {won(prod.lowestPrice)}
                        </span>
                        {/* Previous Price Strikethrough */}
                        {prod.previousPrice && prod.previousPrice > prod.lowestPrice ? (
                          <span className="text-[11px] text-muted line-through ml-1.5 font-bold">
                            {won(prod.previousPrice)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Like (Heart) Icon at right center */}
                <button
                  type="button"
                  onClick={(e) => toggleLike(e, prod.id)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:scale-110 active:scale-95 transition-all text-text-secondary cursor-pointer z-10"
                  aria-label="관심 상품 등록"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill={liked[prod.id] ? '#8A1238' : 'none'}
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke={liked[prod.id] ? '#8A1238' : '#6F6667'}
                    className="w-5.5 h-5.5 transition-colors duration-200"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                    />
                  </svg>
                </button>
              </Link>
            );
          })}
          {products.length === 0 && (
            <div className="w-full text-center py-12 text-sub font-bold border border-dashed border-line rounded-card bg-white">
              조건에 맞는 제품이 없습니다.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
