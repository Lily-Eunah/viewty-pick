import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import AppShell from '../../components/layout/AppShell';
import Header from '../../components/layout/Header';
import { getActiveSeoPages, getProducts } from '../../lib/queries';
import { matchSeoProducts, MIN_SEO_PRODUCTS } from '../../lib/seo/match';
import { isSiteIndexable, SITE_URL } from '../../lib/seo/indexable';
import { SEO_PAGE_SPECS } from '../../lib/seo/specs';
import type { SeoPage } from '../../lib/types';
import { GuideIcon, guideIconName } from '../../components/seo/GuideIcon';
import {
  DrySkinIcon,
  OilySkinIcon,
  CombinationSkinIcon,
  SensitiveSkinIcon,
  DehydratedOilyIcon,
} from '../../components/home/BeautyIcons';

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

// ── helpers ───────────────────────────────────────────────────────────
type LiveEntry = { page: SeoPage; seller?: string; n: number; lowestPrice: number | null };

/** Card label = h1 minus the "올리브영/추천/최저가 비교/2026" boilerplate. */
function cardLabel(page: SeoPage): string {
  const base = (page.h1 || page.title || '').trim();
  const s = base
    .replace(/^올리브영\s*/, '')
    .replace(/\s*2026$/, '')
    .replace(/\s*(추천\s*)?최저가\s*비교$/, '')
    .replace(/\s*추천$/, '')
    .trim();
  return s || base;
}

const MAJOR: Record<string, string> = {
  sunscreen: 'suncare', sunstick: 'suncare', suncushion: 'suncare', suncare: 'suncare',
  toner: 'skincare', lotion: 'skincare', serum: 'skincare', cream: 'skincare', allinone: 'skincare', skincare: 'skincare',
  cleansing: 'cleansing-care', 'cleansing-oil': 'cleansing-care', 'cleansing-water': 'cleansing-care', 'cleansing-care': 'cleansing-care',
  'sheet-mask': 'maskpack', pad: 'maskpack', maskpack: 'maskpack',
  shower: 'bodycare', 'body-lotion': 'bodycare', bodycare: 'bodycare',
  cushion: 'base-makeup', foundation: 'base-makeup', 'base-makeup': 'base-makeup',
};

/** Big illustration path (major-category PNG) for the featured hero. */
function majorIllust(category?: string | null): string | null {
  if (!category) return null;
  const m = MAJOR[category];
  return m ? `/images/categories/${m}.png` : null;
}

const SKIN_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  건성: DrySkinIcon,
  지성: OilySkinIcon,
  복합성: CombinationSkinIcon,
  민감성: SensitiveSkinIcon,
  수부지: DehydratedOilyIcon,
};

function priceMeta(e: LiveEntry): string {
  return e.lowestPrice ? `${e.n}개 · 최저 ${e.lowestPrice.toLocaleString('ko-KR')}원~` : `${e.n}개`;
}

function SectionHead({ bar, title, sub }: { bar: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[3px] h-4 rounded-full shrink-0" style={{ background: bar }} />
      <h2 className="text-[14px] font-black text-title tracking-tight">{title}</h2>
      {sub && <span className="text-[10px] text-sub font-semibold">{sub}</span>}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────
export default async function BestIndexPage() {
  const [pages, products] = await Promise.all([getActiveSeoPages(), getProducts({ sortBy: 'recommend' })]);

  // Only list pages that actually back >= MIN_SEO_PRODUCTS products (matches the
  // per-page thin-content guard, so the hub never links to a 404).
  const live: LiveEntry[] = pages
    .map((p) => {
      const spec = SEO_PAGE_SPECS.find((s) => s.slug === p.slug);
      const matched = matchSeoProducts(products, { category: p.category, skinType: p.skin_type, badge: p.badge_type, keywords: p.keywords, seller: spec?.seller });
      const lowestPrice = matched
        .filter((prod) => prod.hasAnyPrice !== false && prod.lowestPrice > 0)
        .map((prod) => prod.lowestPrice)
        .sort((a, b) => a - b)[0] ?? null;
      return { page: p, seller: spec?.seller, n: matched.length, lowestPrice };
    })
    .filter((x) => x.n >= MIN_SEO_PRODUCTS);

  // Partition: 올리브영(seller) is its own band; the rest group by page_type.
  const oliveyoung = live.filter((x) => x.seller === 'oliveyoung');
  const rest = live.filter((x) => x.seller !== 'oliveyoung');
  const typeOf = (x: LiveEntry) => x.page.page_type || 'category';
  const featured = rest.filter((x) => typeOf(x) === 'curation');
  const concern = rest.filter((x) => typeOf(x) === 'keyword');
  const skin = rest.filter((x) => typeOf(x) === 'skin');
  const known = new Set(['curation', 'keyword', 'skin', 'category']);
  const category = rest.filter((x) => typeOf(x) === 'category' || !known.has(typeOf(x)));

  const heroPrimary = featured[0];
  const heroSecondary = featured.slice(1, 3);

  return (
    <AppShell activeTab="category">
      <Header showBack title="추천 가이드" />

      {/* Compact SEO hero (keeps on-page H1) */}
      <section className="bg-background-warm px-4 pt-5 pb-4 border-b border-line">
        <h1 className="text-[19px] font-black text-title leading-tight tracking-tight">뷰티 추천 최저가 비교 가이드</h1>
        <p className="text-[11px] text-body opacity-85 mt-1.5 font-semibold leading-relaxed">
          성분으로 검증한 추천 제품을 고민·피부 타입·판매처별로 모아 쿠팡·올리브영·네이버 최저가를 비교했어요.
        </p>
        <p className="text-[10.5px] text-sub font-bold mt-1.5">
          총 <strong>{live.length}개</strong> 가이드 · 매일 가격 갱신
        </p>
      </section>

      {/* ① 에디터 픽 (curation) — 여기서만 있는 큐레이션 */}
      {heroPrimary && (
        <section className="px-4 pt-4">
          <p className="text-[10px] tracking-[0.12em] font-black text-accent mb-2.5">에디터 픽 · 이 시즌 추천</p>
          <Link
            href={`/best/${heroPrimary.page.slug}`}
            className="flex items-center gap-3 bg-primary rounded-[20px] p-4 shadow-sm active:scale-[0.99] transition-transform"
          >
            {majorIllust(heroPrimary.page.category) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={majorIllust(heroPrimary.page.category)!} alt="" width={64} height={64} className="w-16 h-16 shrink-0 object-contain bg-white rounded-2xl p-1" />
            )}
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1 bg-white/20 rounded-md px-2 py-0.5 text-[9px] font-bold text-white mb-1.5">전문가 큐레이션</span>
              <h3 className="text-[15px] font-black text-white leading-snug mb-2 line-clamp-2">{cardLabel(heroPrimary.page)}</h3>
              <div className="flex items-center justify-between">
                {heroPrimary.lowestPrice ? (
                  <span className="text-[11px] text-white/90">최저 <strong className="text-[13px] font-black">{heroPrimary.lowestPrice.toLocaleString('ko-KR')}원</strong>~</span>
                ) : <span />}
                <span className="bg-white/20 rounded-full px-3 py-1 text-[10px] font-bold text-white">{heroPrimary.n}개 →</span>
              </div>
            </div>
          </Link>

          {heroSecondary.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {heroSecondary.map((s) => (
                <li key={s.page.slug}>
                  <Link
                    href={`/best/${s.page.slug}`}
                    className="flex items-center gap-3 bg-surface border border-line rounded-[18px] px-3.5 py-3 shadow-sm active:scale-[0.99] transition-transform"
                  >
                    {majorIllust(s.page.category) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={majorIllust(s.page.category)!} alt="" width={36} height={36} className="w-9 h-9 shrink-0 object-contain" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-accent font-bold mb-0.5">전문가 큐레이션</p>
                      <p className="text-[13px] font-black text-title leading-tight truncate">{cardLabel(s.page)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {s.lowestPrice && <p className="text-[11px] text-title font-black">{s.lowestPrice.toLocaleString('ko-KR')}원~</p>}
                      <p className="text-[10px] text-sub font-semibold">{s.n}개</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ② 고민·성분별 (keyword) */}
      {concern.length > 0 && (
        <section className="px-4 pt-5">
          <SectionHead bar="#CA9BAA" title="고민 · 성분별" sub="카테고리 필터로 못 얻는 추천" />
          <ul className="grid grid-cols-2 gap-2 mt-3">
            {concern.map((c) => (
              <li key={c.page.slug}>
                <Link
                  href={`/best/${c.page.slug}`}
                  className="flex flex-col h-full bg-surface border border-line rounded-2xl p-3 shadow-sm active:scale-[0.99] transition-transform"
                >
                  <span className="w-9 h-9 rounded-xl bg-accent-soft flex items-center justify-center text-[#B36A82] mb-2">
                    <GuideIcon name={guideIconName(c.page)} className="w-[18px] h-[18px]" />
                  </span>
                  <span className="text-[12px] font-black text-title leading-snug mb-1 line-clamp-2">{cardLabel(c.page)}</span>
                  <span className="text-[10px] text-sub font-semibold mt-auto">{priceMeta(c)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ③ 피부 타입별 (skin) */}
      {skin.length > 0 && (
        <section className="pt-5">
          <div className="px-4">
            <SectionHead bar="#A4B4BE" title="피부 타입별 추천" sub="내 피부에 맞는" />
          </div>
          <ul className="mt-3 flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1">
            {skin.map((s) => {
              const Icon = SKIN_ICON[s.page.skin_type || ''];
              return (
                <li key={s.page.slug} className="shrink-0">
                  <Link
                    href={`/best/${s.page.slug}`}
                    className="flex flex-col w-[108px] h-full bg-secondary-soft rounded-2xl p-3 active:scale-[0.99] transition-transform"
                  >
                    <span className="mb-1.5 block">
                      {Icon ? <Icon className="w-6 h-6" /> : <GuideIcon name={guideIconName(s.page)} className="w-6 h-6 text-[#4A7A90]" />}
                    </span>
                    <span className="text-[11px] font-black text-[#1E4A5C] leading-snug line-clamp-2">{cardLabel(s.page)}</span>
                    <span className="text-[10px] text-[#6F838F] font-semibold mt-0.5">{s.n}개</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ④ 올리브영 (seller band) */}
      {oliveyoung.length > 0 && (
        <section className="px-4 pt-5">
          <div className="bg-[#F0F7F4] border border-[#CDE5DB] rounded-[18px] p-3.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="bg-[#007556] text-white text-[9px] font-black rounded px-1.5 py-0.5 tracking-wide">OLIVE YOUNG</span>
              <span className="text-[12.5px] font-black text-[#0A4A38]">올리브영 최저가</span>
            </div>
            <p className="text-[10px] text-[#4E8571] font-semibold mb-2.5">올리브영 입점 제품만 카테고리별로</p>
            <ul className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {oliveyoung.map((o) => (
                <li key={o.page.slug} className="shrink-0">
                  <Link
                    href={`/best/${o.page.slug}`}
                    className="flex flex-col items-center min-w-[64px] bg-white border border-[#CDE5DB] rounded-xl px-1.5 py-2 text-[#0A6E52] active:scale-[0.97] transition-transform"
                  >
                    <GuideIcon name={guideIconName(o.page)} className="w-7 h-7 mb-1" />
                    <span className="text-[10px] font-black text-[#0A4A38]">{cardLabel(o.page)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ⑤ 카테고리별 (탭과 중복 · SEO 색인용 하단 chip) */}
      {category.length > 0 && (
        <section className="mt-5 bg-surface-soft border-t border-divider px-4 pt-4 pb-6">
          <h2 className="text-[11px] font-black text-body mb-0.5">카테고리별 최저가</h2>
          <p className="text-[9.5px] text-sub font-medium mb-2.5">카테고리 탭에서도 볼 수 있어요 · 검색 유입용 색인</p>
          <ul className="flex flex-wrap gap-1.5">
            {category.map((c) => (
              <li key={c.page.slug}>
                <Link
                  href={`/best/${c.page.slug}`}
                  className="inline-flex items-center gap-1.5 bg-surface border border-line rounded-full pl-2 pr-3 py-1.5 text-[#8A8877] active:scale-[0.97] transition-transform"
                >
                  <GuideIcon name={guideIconName(c.page)} className="w-4 h-4" />
                  <span className="text-[10px] font-bold text-body">{cardLabel(c.page)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
