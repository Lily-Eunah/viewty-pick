import React from 'react';
import Link from 'next/link';
import ProductImage from '../common/ProductImage';
import Badge from '../common/Badge';
import PriceText from '../common/PriceText';
import { priceDrop, priceDropRate } from '../../lib/format';
import { UIProduct } from '../../lib/types';

interface ProductListCardProps {
  product: UIProduct;
  rank?: number;
}

export default function ProductListCard({ product, rank }: ProductListCardProps) {
  // Retailer checklist tag: E.g., "쿠팡 / 올리브영 비교"
  const storeNames = product.stores.map((s) => s.name).slice(0, 3).join(' · ');

  return (
    <Link
      href={`/p/${product.slug}`}
      className="flex items-center gap-3.5 bg-surface border border-line rounded-card p-3 shadow-[0_2px_8px_rgba(0,0,0,0.01)] active:scale-[0.99] transition-transform duration-200"
    >
      {/* 1. Rank Label (optional) */}
      {rank !== undefined && (
        <div className="flex justify-center items-center w-6 text-[15px] font-black text-primary-dark">
          {rank}
        </div>
      )}

      {/* 2. Left Product Image */}
      <ProductImage
        src={product.image}
        alt={product.name}
        brand={product.brand}
        className="w-[92px] h-[92px] rounded-lg shrink-0 overflow-hidden"
      />

      {/* 3. Right Details */}
      <div className="flex-grow flex flex-col justify-between py-0.5 min-h-[92px] overflow-hidden">
        <div className="flex flex-col gap-0.5">
          {/* Badge & Tags */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {product.badges.slice(0, 1).map((b, idx) => (
              <Badge key={idx} type="trust" className="py-0.5">
                {b}
              </Badge>
            ))}
            {product.priceDropRate && product.priceDropRate > 10 ? (
              <Badge type="accent" className="py-0.5">
                {priceDropRate(product.priceDropRate)}↓
              </Badge>
            ) : null}
          </div>

          {/* Brand & Name */}
          <span className="text-[10px] font-extrabold text-sub mt-0.5">
            {product.brand}
          </span>
          <h4 className="text-[14px] font-extrabold text-title tracking-tight line-clamp-1">
            {product.name}
          </h4>

          {/* Skin types bullet */}
          <span className="text-[11px] text-body opacity-85 mt-0.5 font-semibold">
            {product.skinTypes.join(' · ')}
          </span>
        </div>

        {/* Pricing & Comparison Tagline */}
        <div className="flex justify-between items-end mt-1.5 pt-1.5 border-t border-[#F8F6EE]">
          <div className="flex flex-col">
            <span className="text-[9px] text-sub font-black leading-none">최저가</span>
            <PriceText price={product.lowestPrice} size="sm" className="mt-0.5" />
          </div>

          <div className="flex flex-col items-end">
            {product.priceDropAmount && product.priceDropAmount > 0 ? (
              <span className="text-[10px] font-black text-price bg-price-bg px-2 py-0.5 rounded-full leading-none mb-0.5">
                {priceDrop(product.priceDropAmount, true)}
              </span>
            ) : null}
            <span className="text-[10px] text-sub font-black tracking-tight max-w-[150px] truncate leading-none">
              {storeNames} 비교
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
