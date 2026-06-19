import React from 'react';
import { UIStorePrice } from '../../lib/types';
import { won, perMl } from '../../lib/format';

interface StorePriceCardProps {
  store: UIStorePrice;
  rank: number;
}

export default function StorePriceCard({ store, rank }: StorePriceCardProps) {
  const isCheapest = store.isBest;
  const linkOnly = store.hasPrice === false;
  const qty = store.quantity ?? 1;
  const isMultipack = qty > 1 && store.effectiveUnitPrice != null;

  return (
    <div className="flex items-center justify-between py-3.5 px-4 bg-surface hover:bg-surface-soft transition-colors duration-150">
      {/* Left: Rank & Store name */}
      <div className="flex items-center gap-3">
        {/* Rank / Icon */}
        <div className="w-5 flex justify-center items-center">
          {rank === 1 ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-[15px] h-[15px] text-[#B78A3B] shrink-0"
            >
              <path d="M2 19h20v2H2v-2zM2 5l5 3.5L12 2l5 6.5L22 5v12H2V5z" />
            </svg>
          ) : (
            <span className="text-[13px] font-bold text-text-secondary">{rank}</span>
          )}
        </div>

        {/* Store Name & Official/Rocket tag (+ 판매처별 용량) */}
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-extrabold text-text-primary">
            {store.name}
          </span>
          {store.volumeMl != null && store.volumeMl > 0 && (
            <span className="text-[10px] font-bold text-text-secondary shrink-0">{store.volumeMl}ml</span>
          )}
          {store.isRocket && (
            <span className="text-[9px] bg-sky-100 text-sky-700 font-extrabold px-1.5 py-0.5 rounded-[2px] leading-none shrink-0">
              로켓
            </span>
          )}
          {store.isOfficial && (
            <span className="text-[9px] bg-primary-soft text-primary font-extrabold px-1.5 py-0.5 rounded-[2px] leading-none shrink-0">
              공식
            </span>
          )}
        </div>
      </div>

      {/* Right: Price & CTA */}
      <div className="flex items-center gap-4">
        {/* Price info */}
        <div className="flex flex-col items-end">
          {linkOnly ? (
            <span className="text-[12px] font-bold text-sub">가격 확인</span>
          ) : (
            <>
              <span className={`text-[14px] font-black ${isCheapest ? 'text-primary' : 'text-text-primary'}`}>
                {won(store.price)}
              </span>
              {isMultipack ? (
                <span className="text-[10px] text-text-secondary font-bold leading-none mt-0.5">
                  개당 {won(store.effectiveUnitPrice!)} · {qty}개
                </span>
              ) : store.composition ? (
                <span className="text-[10px] text-discount font-bold leading-none mt-0.5">{store.composition}</span>
              ) : null}
              {/* ml당 — representative ranking metric when sizes differ per retailer */}
              {store.unitPrice != null && store.unitPrice > 0 && (
                <span className="text-[10px] text-text-secondary font-bold leading-none mt-0.5">{perMl(store.unitPrice)}</span>
              )}
            </>
          )}
        </div>

        {/* Purchase / view CTA */}
        <a
          href={store.url}
          target="_blank"
          rel="sponsored nofollow"
          className="px-3.5 py-1.5 rounded-lg text-[12px] font-black border border-accent text-primary bg-surface hover:bg-accent-soft transition-all duration-150 active:scale-95 flex items-center gap-0.5 select-none"
        >
          <span>{linkOnly ? `${store.name}에서 보기` : '구매하기'}</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-2.5 h-2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </a>
      </div>
    </div>
  );
}
