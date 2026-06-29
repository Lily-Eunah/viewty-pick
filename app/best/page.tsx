import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import AppShell from '../../components/layout/AppShell';
import Header from '../../components/layout/Header';
import { getActiveSeoPages, getProducts } from '../../lib/queries';
import { matchSeoProducts, MIN_SEO_PRODUCTS } from '../../lib/seo/match';
import { isSiteIndexable, SITE_URL } from '../../lib/seo/indexable';

export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const indexable = isSiteIndexable();
  return {
    title: '뷰티 추천 최저가 비교 가이드 모음 | ViewtyPick',
    description: '선크림·토너·세럼·쿠션 등 카테고리·피부타입별 추천 제품을 쿠팡·올리브영·네이버 최저가로 비교한 가이드 모음.',
    alternates: { canonical: `${SITE_URL}/best` },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

const GROUP_LABEL: Record<string, string> = {
  category: '카테고리별',
  skin: '피부 타입별',
  keyword: '고민·성분별',
  curation: '큐레이션',
};

export default async function BestIndexPage() {
  const [pages, products] = await Promise.all([getActiveSeoPages(), getProducts({ sortBy: 'recommend' })]);

  // Only list pages that actually back >= MIN_SEO_PRODUCTS products (matches the
  // per-page thin-content guard, so the hub never links to a 404).
  const live = pages
    .map((p) => ({
      page: p,
      n: matchSeoProducts(products, { category: p.category, skinType: p.skin_type, badge: p.badge_type, keywords: p.keywords }).length,
    }))
    .filter((x) => x.n >= MIN_SEO_PRODUCTS);

  const groups = Object.keys(GROUP_LABEL)
    .map((type) => ({ type, items: live.filter((x) => (x.page.page_type || 'category') === type) }))
    .filter((g) => g.items.length > 0);
  // Any page_type not in GROUP_LABEL falls into "기타".
  const known = new Set(Object.keys(GROUP_LABEL));
  const other = live.filter((x) => !known.has(x.page.page_type || 'category'));
  if (other.length) groups.push({ type: 'other', items: other });

  return (
    <AppShell activeTab="category">
      <Header showBack title="추천 가이드" />

      <section className="bg-background-warm px-4 py-7 border-b border-line rounded-b-[28px] shadow-sm">
        <h1 className="text-[20px] font-black text-title leading-tight tracking-tight">뷰티 추천 최저가 비교 가이드</h1>
        <p className="text-[12px] text-body opacity-85 mt-2 font-semibold leading-relaxed">
          성분으로 검증한 추천 제품을 카테고리·피부 타입·고민별로 모아 쿠팡·올리브영·네이버 최저가를 비교했어요.
        </p>
      </section>

      <div className="px-4 py-5 bg-bg flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.type} className="flex flex-col gap-2.5">
            <h2 className="text-[14px] font-black text-title tracking-tight">{GROUP_LABEL[g.type] || '기타'}</h2>
            <ul className="flex flex-col gap-2">
              {g.items.map(({ page, n }) => (
                <li key={page.slug}>
                  <Link
                    href={`/best/${page.slug}`}
                    className="flex items-center justify-between bg-surface border border-line rounded-card px-4 py-3 shadow-sm active:scale-[0.99] transition-transform"
                  >
                    <span className="text-[13px] font-bold text-title">{page.h1 || page.title}</span>
                    <span className="text-[11px] font-black text-sub shrink-0 ml-3">{n}개 →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
