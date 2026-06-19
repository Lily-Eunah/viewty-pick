'use client';

import React from 'react';
import Link from 'next/link';
import AppShell from '../layout/AppShell';
import Header from '../layout/Header';
import ProductListCard from './ProductListCard';
import Badge from '../common/Badge';
import { useFavorites } from '../../lib/favorites';
import { UIProduct } from '../../lib/types';

interface WishlistClientProps {
  products: UIProduct[];
}

export default function WishlistClient({ products }: WishlistClientProps) {
  const { favorites, isMounted } = useFavorites();

  // Filter products by favorite status and keep the exact favorite order (recently added first)
  const favoritedProducts = React.useMemo(() => {
    if (!isMounted) return [];
    return favorites
      .map((slug) => products.find((p) => p.slug === slug))
      .filter((p): p is UIProduct => !!p);
  }, [favorites, products, isMounted]);

  return (
    <AppShell activeTab="wishlist">
      <Header showBack title="관심상품" rightAction={<div className="w-5" />} />

      {isMounted && favoritedProducts.length > 0 ? (
        <>
          {/* SEO Curation Banner */}
          <section className="bg-background-warm px-4 py-8 border-b border-line rounded-b-[28px] shadow-sm">
            <div className="flex flex-col gap-1.5">
              <Badge type="accent" className="w-fit">
                관심상품
              </Badge>
              <h2 className="text-[22px] font-black text-title leading-tight tracking-tight mt-1">
                내가 찜한 뷰티픽<br />
                실시간 최저가 비교
              </h2>
              <p className="text-[12px] text-body opacity-85 mt-2 font-semibold leading-relaxed">
                광고 없는 성분 검증 추천 픽! 찜해둔 제품들의 판매처별 실시간 최저가를 모아봅니다. 매일 아침 가격비교 자동 갱신.
              </p>
            </div>
          </section>

          {/* Product List */}
          <section className="px-4 py-5 bg-bg flex flex-col gap-3.5 pb-24">
            <h3 className="text-[15px] font-black text-title tracking-tight">
              찜한 상품 ({favoritedProducts.length}개)
            </h3>

            <div className="flex flex-col gap-3">
              {favoritedProducts.map((prod) => (
                <ProductListCard key={prod.id} product={prod} />
              ))}
            </div>
          </section>
        </>
      ) : (
        /* Empty State (shown after mount if empty, or during SSR/mount loading to avoid layout shifts) */
        <div className="flex-grow flex flex-col items-center justify-center py-24 px-4 text-center bg-bg min-h-[50vh]">
          <div className="w-16 h-16 rounded-full bg-accent-soft flex items-center justify-center text-[#DE4B6C] mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
              />
            </svg>
          </div>
          <h3 className="text-[16px] font-black text-title">관심상품이 없어요</h3>
          <p className="text-[12px] text-sub font-semibold mt-1.5 max-w-[240px] leading-relaxed">
            마음에 드는 제품의 하트 단추를 눌러 관심상품으로 추가해 보세요!
          </p>
          <Link
            href="/"
            className="mt-6 px-6 py-3 bg-primary text-white font-black text-[12px] rounded-btn shadow-[0_4px_12px_rgba(65,0,22,0.15)] hover:bg-primary-hover active:scale-95 transition-all duration-200"
          >
            제품 둘러보러 가기
          </Link>
        </div>
      )}
    </AppShell>
  );
}
