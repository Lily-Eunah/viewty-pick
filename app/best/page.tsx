import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import AppShell from '../../components/layout/AppShell';
import Header from '../../components/layout/Header';
import { getActiveSeoPages, getProducts } from '../../lib/queries';
import { matchSeoProducts, MIN_SEO_PRODUCTS } from '../../lib/seo/match';
import { isSiteIndexable, SITE_URL } from '../../lib/seo/indexable';
import { SEO_PAGE_SPECS } from '../../lib/seo/specs';

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

const GROUP_META: Record<string, { label: string; intro: string }> = {
  category: {
    label: '카테고리별',
    intro: '토너·세럼·쿠션·클렌징 등 제품 카테고리별로 성분 검증을 통과한 추천 제품을 모아 최저가를 비교합니다.',
  },
  skin: {
    label: '피부 타입별',
    intro: '건성·민감성·지성·수부지 등 피부 타입에 맞는 제품만 추려 가격을 비교했어요. 내 피부 타입에 최적화된 추천 리스트를 확인하세요.',
  },
  keyword: {
    label: '고민·성분별',
    intro: '여드름·진정·PDRN·블랙헤드·남성 등 고민과 성분 키워드로 제품을 추리고, 각 판매처 최저가를 한눈에 비교합니다.',
  },
  curation: {
    label: '큐레이션',
    intro: '성분 전문가·크리에이터가 직접 검증한 특별 큐레이션 리스트입니다. 무기자차 선크림, 톤업 선크림 등 테마별로 추천 제품을 모았어요.',
  },
};

export default async function BestIndexPage() {
  const [pages, products] = await Promise.all([getActiveSeoPages(), getProducts({ sortBy: 'recommend' })]);

  // Only list pages that actually back >= MIN_SEO_PRODUCTS products (matches the
  // per-page thin-content guard, so the hub never links to a 404).
  const live = pages
    .map((p) => {
      const spec = SEO_PAGE_SPECS.find((s) => s.slug === p.slug);
      const matched = matchSeoProducts(products, { category: p.category, skinType: p.skin_type, badge: p.badge_type, keywords: p.keywords, seller: spec?.seller });
      const lowestPrice = matched
        .filter((prod) => prod.hasAnyPrice !== false && prod.lowestPrice > 0)
        .map((prod) => prod.lowestPrice)
        .sort((a, b) => a - b)[0] ?? null;
      return { page: p, n: matched.length, lowestPrice };
    })
    .filter((x) => x.n >= MIN_SEO_PRODUCTS);

  const knownTypes = Object.keys(GROUP_META);
  const groups = knownTypes
    .map((type) => ({ type, items: live.filter((x) => (x.page.page_type || 'category') === type) }))
    .filter((g) => g.items.length > 0);
  const other = live.filter((x) => !knownTypes.includes(x.page.page_type || 'category'));
  if (other.length) groups.push({ type: 'other', items: other });

  return (
    <AppShell activeTab="category">
      <Header showBack title="추천 가이드" />

      <section className="bg-background-warm px-4 py-7 border-b border-line rounded-b-[28px] shadow-sm">
        <h1 className="text-[20px] font-black text-title leading-tight tracking-tight">뷰티 추천 최저가 비교 가이드</h1>
        <p className="text-[12px] text-body opacity-85 mt-2 font-semibold leading-relaxed">
          성분으로 검증한 추천 제품을 카테고리·피부 타입·고민별로 모아 쿠팡·올리브영·네이버 최저가를 비교했어요.
        </p>
        <p className="text-[11px] text-sub font-bold mt-1.5">
          총 <strong>{live.length}개</strong> 가이드 · 매일 가격 갱신
        </p>
      </section>

      <div className="px-4 py-5 bg-bg flex flex-col gap-7">
        {groups.map((g) => {
          const meta = GROUP_META[g.type];
          return (
            <section key={g.type} className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-1">
                <h2 className="text-[14px] font-black text-title tracking-tight">
                  {meta?.label || '기타'}
                </h2>
                {meta?.intro && (
                  <p className="text-[11px] text-sub font-semibold leading-relaxed">{meta.intro}</p>
                )}
              </div>
              <ul className="flex flex-col gap-2">
                {g.items.map(({ page, n, lowestPrice }) => (
                  <li key={page.slug}>
                    <Link
                      href={`/best/${page.slug}`}
                      className="flex items-center justify-between bg-surface border border-line rounded-card px-4 py-3 shadow-sm active:scale-[0.99] transition-transform"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[13px] font-bold text-title truncate">{page.h1 || page.title}</span>
                        {lowestPrice && (
                          <span className="text-[10px] text-sub font-semibold">
                            최저 {lowestPrice.toLocaleString('ko-KR')}원~
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-black text-sub shrink-0 ml-3">{n}개 →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
