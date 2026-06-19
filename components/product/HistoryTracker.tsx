'use client';

import { useEffect } from 'react';

interface HistoryProduct {
  id: string;
  slug: string;
  brand: string;
  name: string;
  image: string;
  lowestPrice: number;
  volume: string;
  viewtyScore: number;
}

export default function HistoryTracker({ product }: { product: HistoryProduct }) {
  useEffect(() => {
    try {
      const saved = localStorage.getItem('recentlyViewedProducts');
      let list: HistoryProduct[] = saved ? JSON.parse(saved) : [];
      
      // Filter out if duplicate so it can be unshifted to the front
      list = list.filter((p) => p.slug !== product.slug);
      
      // Unshift new item
      list.unshift(product);
      
      // Limit to max 10 items
      if (list.length > 10) {
        list = list.slice(0, 10);
      }
      
      localStorage.setItem('recentlyViewedProducts', JSON.stringify(list));
    } catch (e) {
      console.error('Failed to update recently viewed products in localStorage:', e);
    }
  }, [product]);

  return null;
}
