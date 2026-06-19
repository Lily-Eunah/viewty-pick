import AppShell from '../../components/layout/AppShell';
import Header from '../../components/layout/Header';
import SearchClient from '../../components/search/SearchClient';
import { getProducts, getCategories } from '../../lib/queries';
import { SearchableProduct } from '../../lib/search';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  // Same exposable set as every list (getProducts already drops link-less products).
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  // UIProduct only carries the category slug — resolve display names once here so
  // the client can match/show 카테고리명 without re-fetching categories.
  const categoryNameBySlug = new Map(categories.map((c) => [c.slug, c.name]));
  const items: SearchableProduct[] = products.map((product) => ({
    product,
    categoryName: categoryNameBySlug.get(product.category) || '',
  }));

  return (
    <AppShell activeTab="search">
      <Header showBack title="검색" rightAction={<div className="w-5" />} />
      <SearchClient items={items} initialQuery={q ?? ''} />
    </AppShell>
  );
}
