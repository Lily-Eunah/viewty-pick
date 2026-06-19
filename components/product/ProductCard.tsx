import React from 'react';
import Link from 'next/link';
import ProductImage from '../common/ProductImage';
import Badge from '../common/Badge';
import PriceText from '../common/PriceText';
import { UIProduct } from '../../lib/types';
import FavoriteButton from './FavoriteButton';

interface ProductCardProps {
  product: UIProduct;
}

export default function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="relative w-[170px] shrink-0">
      <Link
        href={`/p/${product.slug}`}
        className="flex flex-col w-full h-full bg-surface border border-line rounded-card overflow-hidden shadow-[0_8px_24px_rgba(65,0,22,0.06)] active:scale-[0.98] transition-transform duration-200"
      >
        {/* 1. Product Image */}
        <ProductImage
          src={product.image}
          alt={product.name}
          brand={product.brand}
          className="w-full"
        />

      {/* 2. Content Info */}
      <div className="p-3 flex flex-col flex-grow justify-between gap-1 bg-surface">
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
        <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-divider">
          <div className="flex flex-col">
            <span className="text-[10px] text-text-secondary font-black leading-none">
              최저가
            </span>
            <PriceText price={product.lowestPrice} size="sm" className="mt-0.5" />
            {/* 할인 배지: 정가 대비 */}
            {product.regularPrice && product.discountVsRegular && product.discountVsRegular > 0 ? (
              <span className="text-[10px] text-discount font-extrabold leading-none mt-0.5">
                정가 대비 {product.discountVsRegular}% 할인
              </span>
            ) : product.discountVsOfficial && product.discountVsOfficial > 0 ? (
              <span className="text-[10px] text-discount font-extrabold leading-none mt-0.5">
                정가 대비 {product.discountVsOfficial}% 할인
              </span>
            ) : null}
          </div>
          
          <div className="w-full text-center py-1.5 bg-surface border border-accent text-primary hover:bg-accent-soft hover:border-accent text-[11px] font-black rounded-md transition-all select-none duration-150">
            가격비교 보기
          </div>
        </div>
      </div>
    </Link>
    <FavoriteButton slug={product.slug} className="absolute top-2 right-2 z-10" />
  </div>
  );
}
