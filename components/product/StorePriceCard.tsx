import React from 'react';
import Badge from '../common/Badge';
import PriceText from '../common/PriceText';
import { UIStorePrice } from '../../lib/types';

interface StorePriceCardProps {
  store: UIStorePrice;
}

export default function StorePriceCard({ store }: StorePriceCardProps) {
  const isCheapest = store.isBest;

  return (
    <div
      className={`flex items-center justify-between p-3.5 bg-white border rounded-card shadow-sm transition-shadow hover:shadow-md ${
        isCheapest ? 'border-accent ring-1 ring-accent' : 'border-line'
      }`}
    >
      <div className="flex flex-col gap-1">
        {/* Store Name & Badges */}
        <div className="flex items-center gap-2">
          {isCheapest && (
            <span className="text-[12px]" aria-label="cheapest">
              🏆
            </span>
          )}
          <span className="text-[14px] font-black text-title tracking-tight">
            {store.name}
          </span>
          {store.isRocket && (
            <span className="text-[9px] bg-sky-100 text-sky-700 font-extrabold px-1 rounded-sm">
              로켓
            </span>
          )}
          {store.isOfficial && (
            <span className="text-[9px] bg-primary-light text-primary-dark font-extrabold px-1 rounded-sm">
              공식
            </span>
          )}
        </div>

        {/* Price & Promo Labels */}
        <div className="flex items-baseline gap-2 flex-wrap">
          <PriceText price={store.price} size="md" />
          
          {store.effectiveUnitPrice !== undefined && store.effectiveUnitPrice !== null && store.effectiveUnitPrice < store.price && (
            <span className="text-[12px] text-price font-extrabold bg-price-bg px-2 py-0.5 rounded-full">
              혜택가: {store.effectiveUnitPrice.toLocaleString('ko-KR')}원
            </span>
          )}
          
          {store.promoText && (
            <Badge type={isCheapest ? 'accent' : 'default'}>
              {store.promoText}
            </Badge>
          )}
        </div>

        {/* Per Ml Price helper */}
        {store.unitPrice !== undefined && store.unitPrice !== null && store.unitPrice > 0 && (
          <span className="text-[11px] text-sub font-black">
            (ml당 {Math.round(store.unitPrice).toLocaleString('ko-KR')}원)
          </span>
        )}
      </div>

      {/* Action Button */}
      <a
        href={store.url}
        target="_blank"
        rel="sponsored nofollow"
        className={`px-4 py-2.5 rounded-lg text-[13px] font-black tracking-tight transition-transform active:scale-95 flex items-center gap-1 ${
          isCheapest
            ? 'bg-accent text-[#7A5B00] hover:bg-opacity-95'
            : 'bg-primary-light text-primary-dark hover:bg-[#E2EAD9]'
        }`}
      >
        <span>구매하기</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
        </svg>
      </a>
    </div>
  );
}
