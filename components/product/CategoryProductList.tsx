'use client';

import React, { useState, useMemo } from 'react';
import Chip from '../common/Chip';
import ProductListCard from './ProductListCard';
import { UIProduct, Category } from '../../lib/types';

interface Props {
  initialProducts: UIProduct[];
  minors?: Category[]; // 소분류 sub-filter chips (present on 대분류 pages)
}

const SKIN_TYPES = ['지성', '건성', '수부지', '민감성'] as const;
const SORT_OPTIONS = [
  { key: 'recommend', label: '추천순' },
  { key: 'price_asc', label: '최저가순' },
  { key: 'discount', label: '공식몰대비순' },
] as const;

type SortKey = typeof SORT_OPTIONS[number]['key'];

export default function CategoryProductList({ initialProducts, minors }: Props) {
  const [selectedSkin, setSelectedSkin] = useState<string | null>(null);
  const [selectedMinor, setSelectedMinor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('recommend');

  const products = useMemo(() => {
    let result = initialProducts;
    if (selectedMinor) result = result.filter((p) => p.category === selectedMinor);
    if (selectedSkin) result = result.filter((p) => p.skinTypes.includes(selectedSkin));

    const copy = [...result];
    const askPrice = (p: UIProduct) => (p.lowestPrice > 0 ? p.lowestPrice : Number.POSITIVE_INFINITY);
    if (sortBy === 'recommend') {
      copy.sort((a, b) => b.viewtyScore - a.viewtyScore);
    } else if (sortBy === 'price_asc') {
      copy.sort((a, b) => askPrice(a) - askPrice(b)); // missing price → back
    } else if (sortBy === 'discount') {
      copy.sort((a, b) => (b.discountVsOfficial || 0) - (a.discountVsOfficial || 0));
    }
    return copy;
  }, [initialProducts, selectedSkin, selectedMinor, sortBy]);

  return (
    <>
      {/* Filter chips — sticky */}
      <section className="bg-bg pt-3 pb-2.5 flex flex-col gap-3 border-b border-line sticky top-14 z-30 shadow-[0_2px_4px_rgba(0,0,0,0.01)]">
        {minors && minors.length > 0 && (
          <div className="w-full overflow-x-auto no-scrollbar flex gap-5 px-4 border-b border-[#F8F6EE]">
            <Chip
              label="전체"
              selected={selectedMinor === null}
              variant="tab"
              onClick={() => setSelectedMinor(null)}
            />
            {minors.map((m) => (
              <Chip
                key={m.slug}
                label={m.name}
                selected={selectedMinor === m.slug}
                variant="tab"
                onClick={() => setSelectedMinor(selectedMinor === m.slug ? null : m.slug)}
              />
            ))}
          </div>
        )}
        <div className="w-full overflow-x-auto no-scrollbar flex items-center gap-2 px-4">
          <span className="text-[12px] font-bold text-sub shrink-0 mr-1">피부타입</span>
          <div className="flex gap-2">
            {SKIN_TYPES.map((skin) => (
              <Chip
                key={skin}
                label={skin}
                selected={selectedSkin === skin}
                onClick={() => setSelectedSkin(selectedSkin === skin ? null : skin)}
              />
            ))}
          </div>
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
