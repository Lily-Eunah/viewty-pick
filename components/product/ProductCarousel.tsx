import React from 'react';
import ProductCard from './ProductCard';
import { UIProduct } from '../../lib/types';

interface ProductCarouselProps {
  products: UIProduct[];
}

export default function ProductCarousel({ products }: ProductCarouselProps) {
  return (
    <div className="w-full overflow-x-auto no-scrollbar scroll-smooth flex gap-3.5 px-4 pb-2 select-none">
      {products.map((product) => (
        <div key={product.id} className="shrink-0">
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  );
}
