import { categories } from '../data/categories';
import { products } from '../data/products';
import { Category, UIProduct } from '../types';

/**
 * Fetch all categories.
 */
export async function getCategories(): Promise<Category[]> {
  // Simulates an async DB call
  return [...categories].sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * Fetch a single category by its slug.
 */
export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const category = categories.find((c) => c.slug === slug);
  return category || null;
}

/**
 * Query products with options for category filtering, skin type filtering, and sorting.
 */
export async function getProducts(filters?: {
  category?: string;
  skinType?: string;
  sortBy?: 'recommend' | 'price_asc' | 'price_desc' | 'price_drop' | 'popularity';
}): Promise<UIProduct[]> {
  let result = [...products];

  // 1. Filter by category
  if (filters?.category) {
    result = result.filter((p) => p.category === filters.category);
  }

  // 2. Filter by skin type
  if (filters?.skinType) {
    result = result.filter((p) => p.skinTypes.includes(filters.skinType!));
  }

  // 3. Sort products
  const sortBy = filters?.sortBy || 'recommend';
  if (sortBy === 'recommend') {
    result.sort((a, b) => b.viewtyScore - a.viewtyScore);
  } else if (sortBy === 'price_asc') {
    result.sort((a, b) => a.lowestPrice - b.lowestPrice);
  } else if (sortBy === 'price_desc') {
    result.sort((a, b) => b.lowestPrice - a.lowestPrice);
  } else if (sortBy === 'price_drop') {
    result.sort((a, b) => (b.priceDropAmount || 0) - (a.priceDropAmount || 0));
  } else if (sortBy === 'popularity') {
    // In MVP, popularity sorts by viewtyScore as well
    result.sort((a, b) => b.viewtyScore - a.viewtyScore);
  }

  return result;
}

/**
 * Fetch a single product by its slug.
 */
export async function getProductBySlug(slug: string): Promise<UIProduct | null> {
  const product = products.find((p) => p.slug === slug);
  return product || null;
}

/**
 * Get top recommended products based on Viewty Score.
 */
export async function getRecommendedProducts(limit = 10): Promise<UIProduct[]> {
  const result = [...products]
    .sort((a, b) => b.viewtyScore - a.viewtyScore)
    .slice(0, limit);
  return result;
}

/**
 * Get products that have the best price drops today.
 */
export async function getTodayBestPriceProducts(limit = 6): Promise<UIProduct[]> {
  const result = [...products]
    .filter((p) => (p.priceDropAmount || 0) > 0)
    .sort((a, b) => (b.priceDropAmount || 0) - (a.priceDropAmount || 0))
    .slice(0, limit);
  return result;
}
