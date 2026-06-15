'use client';

import React, { useState, useMemo } from 'react';
import Chip from '../common/Chip';
import ProductListCard from './ProductListCard';
import { UIProduct } from '../../lib/types';

interface Props {
  initialProducts: UIProduct[];
}

const SKIN_TYPES = ['민감성', '지성', '건성', '수부지'] as const;
const SORT_OPTIONS = [
  { key: 'recommend', label: '추천순' },
  { key: 'price_asc', label: '최저가순' },
  { key: 'price_drop', label: '가격하락순' },
] as const;

type SortKey = typeof SORT_OPTIONS[number]['key'];

export default function CategoryProductList({ initialProducts }: Props) {
  const [selectedSkin, setSelectedSkin] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('recommend');

  const products = useMemo(() => {
    const result = selectedSkin
      ? initialProducts.filter((p) => p.skinTypes.includes(selectedSkin))
      : initialProducts;

    const copy = [...result];
    if (sortBy === 'recommend') {
      copy.sort((a, b) => b.viewtyScore - a.viewtyScore);
    } else if (sortBy === 'price_asc') {
      copy.sort((a, b) => a.lowestPrice - b.lowestPrice);
    } else if (sortBy === 'price_drop') {
      copy.sort((a, b) => (b.priceDropAmount || 0) - (a.priceDropAmount || 0));
    }
    return copy;
  }, [initialProducts, selectedSkin, sortBy]);

  return (
    <>
      {/* Filter chips — sticky */}
      <section className="bg-bg py-2.5 flex flex-col gap-2 border-b border-line sticky top-14 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.01)]">
        <div className="w-full overflow-x-auto no-scrollbar flex gap-2 px-4">
          {SKIN_TYPES.map((skin) => (
            <Chip
              key={skin}
              label={skin}
              selected={selectedSkin === skin}
              onClick={() => setSelectedSkin(selectedSkin === skin ? null : skin)}
            />
          ))}
        </div>
        <div className="w-full overflow-x-auto no-scrollbar flex gap-2 px-4 mt-0.5 border-t border-[#F8F6EE] pt-2">
          {SORT_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              label={opt.label}
              selected={sortBy === opt.key}
              variant="sort"
              onClick={() => setSortBy(opt.key)}
            />
          ))}
        </div>
      </section>

      {/* Product list */}
      <section className="px-4 py-4 bg-bg flex-grow">
        <div className="flex flex-col gap-2.5">
          {products.map((prod, idx) => (
            <ProductListCard
              key={prod.id}
              product={prod}
              rank={sortBy === 'recommend' ? idx + 1 : undefined}
            />
          ))}
          {products.length === 0 && (
            <div className="w-full text-center py-16 text-sub font-extrabold border border-dashed border-line rounded-card bg-white mt-4">
              필터 조건에 부합하는 제품이 없습니다.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
