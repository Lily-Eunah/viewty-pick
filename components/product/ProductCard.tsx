import React from 'react';
import Link from 'next/link';
import ProductImage from '../common/ProductImage';
import Badge from '../common/Badge';
import PriceText from '../common/PriceText';
import { UIProduct } from '../../lib/types';

interface ProductCardProps {
  product: UIProduct;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      href={`/p/${product.slug}`}
      className="flex flex-col w-[170px] bg-surface border border-line rounded-card overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.02)] active:scale-[0.98] transition-transform duration-200"
    >
      {/* 1. Product Image */}
      <ProductImage
        src={product.image}
        alt={product.name}
        brand={product.brand}
        className="w-full"
      />

      {/* 2. Content Info */}
      <div className="p-3 flex flex-col flex-grow justify-between gap-1 bg-white">
        <div className="flex flex-col gap-1">
          {/* Badge */}
          <div className="flex flex-wrap gap-1">
            {product.badges.slice(0, 1).map((b, idx) => (
              <Badge key={idx} type="trust">
                {b}
              </Badge>
            ))}
          </div>

          {/* Brand & Title */}
          <span className="text-[11px] font-black text-sub mt-0.5 leading-none">
            {product.brand}
          </span>
          <h4 className="text-[13px] font-bold text-title tracking-tight line-clamp-2 leading-snug min-h-[36px]">
            {product.name}
          </h4>
        </div>

        {/* Price & CTA */}
        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-[#F8F6EE]">
          <div className="flex flex-col">
            <span className="text-[10px] text-sub font-black leading-none">
              최저가
            </span>
            <PriceText price={product.lowestPrice} size="sm" className="mt-0.5" />
          </div>
          
          <div className="w-full text-center py-1.5 bg-primary-light hover:bg-[#E2EAD9] text-primary-dark text-[11px] font-extrabold rounded-md transition-colors select-none">
            가격비교 보기
          </div>
        </div>
      </div>
    </Link>
  );
}
