import React from 'react';
import { getProducts } from '../../lib/queries';
import WishlistClient from '../../components/product/WishlistClient';

export const metadata = {
  title: '관심상품 - ViewtyPick',
  description: '내가 찜한 뷰티 제품들의 최저가를 한눈에 비교하고 모아보세요.',
};

export default async function WishlistPage() {
  // Fetch all active products
  const products = await getProducts();

  return <WishlistClient products={products} />;
}
