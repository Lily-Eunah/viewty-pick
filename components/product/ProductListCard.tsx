import React from 'react';
import Link from 'next/link';
import ProductImage from '../common/ProductImage';
import Badge from '../common/Badge';
import PriceText from '../common/PriceText';
import { UIProduct } from '../../lib/types';
import FavoriteButton from './FavoriteButton';

// Sellers we ship a logo for. Others (zigzag/ably) are skipped rather than
// falling back to text, so the row stays a fixed width and never wraps.
const SELLER_LOGOS: Record<string, string> = {
  naver: '/images/sellers/naver.png',
  coupang: '/images/sellers/coupang.png',
  oliveyoung: '/images/sellers/oliveyoung.png',
};

interface ProductListCardProps {
  product: UIProduct;
  rank?: number;
}

export default function ProductListCard({ product, rank }: ProductListCardProps) {
  // Logos stand in for the old "○○ · ○○ 비교" tagline; priced sellers only.
  const logoSellers = product.stores
    .filter((s) => s.hasPrice && SELLER_LOGOS[s.sellerSlug])
    .slice(0, 3);
  const discount =
    product.discountVsRegular && product.discountVsRegular > 0 ? product.discountVsRegular : null;

  return (
    <div className="relative w-full">
      <Link
        href={`/p/${product.slug}`}
        className="flex items-center gap-3.5 bg-surface border border-line rounded-card p-3 shadow-[0_8px_24px_rgba(65,0,22,0.06)] active:scale-[0.99] transition-transform duration-200"
      >
      {/* 1. Rank Label (optional) */}
      {rank !== undefined && (
        <div className={`flex justify-center items-center w-6 h-6 rounded-md text-[12px] font-black shrink-0 ${
          rank === 1
            ? 'bg-primary text-white'
            : rank <= 3
            ? 'bg-accent text-primary'
            : 'bg-secondary-soft text-secondary-dark'
        }`}>
          {rank}
        </div>
      )}

      {/* 2. Left Product Image */}
      <ProductImage
        src={product.image}
        alt={product.name}
        brand={product.brand}
        className="w-[92px] h-[92px] rounded-lg shrink-0 overflow-hidden"
        category={product.majorCategory || product.category}
      />

      {/* 3. Right Details */}
      <div className="flex-grow flex flex-col justify-between py-0.5 min-h-[92px] overflow-hidden">
        {/* pr-10 is on this block only — the favorite button is pinned to the card's
            top-right, so the price row below can use the full width. */}
        <div className="flex flex-col gap-0.5 pr-10">
          {/* Badge & Tags — product traits only; the discount lives with the price
              below, so this row keeps room for future badges (화해/올영 랭킹). */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {product.badges.slice(0, 1).map((b, idx) => (
              <Badge key={idx} type="trust" className="py-0.5">
                {b}
              </Badge>
            ))}
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
        <div className="flex justify-between items-end mt-1.5 pt-1.5 border-t border-divider">
          <div className="flex flex-col">
            <span className="text-[9px] text-text-secondary font-black leading-none">
              {product.hasAnyPrice === false ? '가격 확인 필요' : product.bestIsMultipack ? '개당 최저' : '최저가'}
            </span>
            {product.hasAnyPrice === false ? (
              <span className="text-[13px] font-black text-sub mt-0.5">판매처에서 보기</span>
            ) : (
              <div className="flex items-baseline gap-1 mt-0.5">
                {discount ? (
                  <span className="text-[11px] text-[#8A1238] font-black">{discount}%↓</span>
                ) : null}
                <PriceText price={product.lowestPrice} size="sm" />
                {product.bestIsMultipack && <span className="text-[9px] text-sub font-bold">/개</span>}
              </div>
            )}
          </div>

          {logoSellers.length > 0 && (
            <div className="flex items-center gap-[3px] shrink-0">
              {logoSellers.map((s) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={s.sellerSlug}
                  src={SELLER_LOGOS[s.sellerSlug]}
                  alt={s.name}
                  width={20}
                  height={20}
                  className="block w-5 h-5"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
    <FavoriteButton slug={product.slug} className="absolute top-3 right-3 z-10" />
  </div>
  );
}
