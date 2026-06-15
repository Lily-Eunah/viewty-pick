'use client';

import React, { useState } from 'react';
import StorePriceCard from './StorePriceCard';
import { UIStorePrice } from '../../lib/types';

interface StorePriceListProps {
  stores: UIStorePrice[];
}

export default function StorePriceList({ stores }: StorePriceListProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleStores = expanded ? stores : stores.slice(0, 5);
  const hasMore = stores.length > 5;

  return (
    <div className="flex flex-col gap-2">
      <div className="bg-surface border border-line rounded-card overflow-hidden shadow-sm divide-y divide-divider flex flex-col">
        {visibleStores.map((store, idx) => (
          <StorePriceCard key={idx} store={store} rank={idx + 1} />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2.5 flex items-center justify-center gap-1 text-[13px] font-bold text-primary hover:bg-surface-soft transition-colors mt-0.5 rounded-lg border border-transparent hover:border-line select-none cursor-pointer"
        >
          <span>{expanded ? '접기' : '더보기'}</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      )}
    </div>
  );
}
