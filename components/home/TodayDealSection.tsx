"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import ProductImageWithFallback from '../common/ProductImageWithFallback';
import Badge from '../common/Badge';
import { won, perMl, pricedStoreNames } from '../../lib/format';
import { UIProduct } from '../../lib/types';

interface TodayDealSectionProps {
  products: UIProduct[];
  loading: boolean;
}

/**
 * 🏆 정가 대비 최저가 픽 — ranks products by how far a verified seller beats the
 * 정가(MSRP) per-unit price (real metric; no mock ratings / drop badges).
 */
export default function TodayDealSection({ products, loading }: TodayDealSectionProps) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const toggleLike = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setLiked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className="px-4 py-4 bg-bg">
      <div className="mb-3.5 px-1 flex flex-col gap-0.5">
        <h3 className="text-[15px] font-black text-title tracking-tight flex items-center gap-1.5">
          <span>🏆 정가 대비 최저가 픽</span>
        </h3>
        <p className="text-[11px] text-text-secondary font-semibold">
          정가 대비 할인폭이 큰 제품
        </p>
      </div>

      {loading ? (
        <div className="w-full h-32 flex justify-center items-center text-sub font-bold">로딩 중...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {products.map((prod, idx) => {
            const rank = idx + 1;
            const bestStore = prod.stores.find((s) => s.isBest);
            const mlUnit = bestStore?.unitPrice; // shown only when reliable (non-null)
            const shortDesc = prod.features && prod.features.length > 0
              ? `${prod.features.slice(0, 2).join(' / ')} / ${prod.volume}`
              : `${prod.description} / ${prod.volume}`;
            const sellerNames = pricedStoreNames(prod);

            return (
              <Link
                key={prod.id}
                href={`/p/${prod.slug}`}
                className="relative flex items-center bg-surface border border-line rounded-[18px] p-3 shadow-[0_8px_24px_rgba(65,0,22,0.06)] active:scale-[0.99] transition-transform duration-200 min-h-[140px] overflow-hidden"
              >
                <div className="relative w-[104px] h-[104px] rounded-xl overflow-hidden shrink-0">
                  <div className="absolute top-0 left-0 bg-primary text-white text-[10px] font-black w-5.5 h-5.5 flex items-center justify-center rounded-br-md z-10 shadow-sm">
                    {rank}
                  </div>
                  <ProductImageWithFallback src={prod.image} alt={prod.name} className="w-full h-full" category={prod.category} />
                </div>

                <div className="flex-grow flex flex-col justify-between pl-3.5 pr-8 py-0.5 min-h-[104px] overflow-hidden">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {prod.badges.slice(0, 2).map((badgeName, i) => (
                        <Badge key={i} className="px-1.5 py-0.5 text-[9.5px]">{badgeName}</Badge>
                      ))}
                    </div>
                    <span className="text-[10px] font-black text-text-secondary mt-1 leading-none uppercase tracking-wider">
                      {prod.brand}
                    </span>
                    <h4 className="text-[13.5px] font-black text-title tracking-tight line-clamp-1 leading-snug mt-0.5">
                      {prod.name}
                    </h4>
                    {mlUnit != null && mlUnit > 0 && (
                      <span className="text-[10px] text-text-secondary font-bold leading-none mt-1">{perMl(mlUnit)}</span>
                    )}
                    <span className="text-[10.5px] text-text-secondary font-semibold leading-none mt-1 truncate">{shortDesc}</span>
                  </div>

                  <div className="flex flex-col gap-1 mt-1.5">
                    {(prod.discountVsRegular != null && prod.discountVsRegular > 0) ? (
                      <span className="self-start text-[10px] font-black text-discount bg-accent-soft px-2 py-0.5 rounded-full leading-none">
                        정가 대비 {prod.discountVsRegular}% 할인
                      </span>
                    ) : null}
                    <div className="flex items-end gap-1.5 leading-none">
                      <span className="text-[15px] font-black text-primary">
                        {won(prod.lowestPrice)}{prod.bestIsMultipack ? <span className="text-[10px] font-bold"> /개</span> : null}
                      </span>
                      {prod.regularPrice != null && prod.regularPrice > 0 ? (
                        <span className="text-[11px] text-muted font-bold">정가 {won(prod.regularPrice)}</span>
                      ) : null}
                    </div>
                    {sellerNames && (
                      <span className="text-[10px] text-text-secondary font-black tracking-tight max-w-[170px] truncate leading-none">
                        {sellerNames} 비교
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => toggleLike(e, prod.id)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:scale-110 active:scale-95 transition-all text-text-secondary cursor-pointer z-10"
                  aria-label="관심 상품 등록"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill={liked[prod.id] ? '#8A1238' : 'none'} viewBox="0 0 24 24" strokeWidth={2.5} stroke={liked[prod.id] ? '#8A1238' : '#6F6667'} className="w-5.5 h-5.5 transition-colors duration-200">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
              </Link>
            );
          })}
          {products.length === 0 && (
            <div className="w-full text-center py-12 text-sub font-bold border border-dashed border-line rounded-card bg-white">
              정가 대비 할인 폭이 큰 제품을 준비 중입니다.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
