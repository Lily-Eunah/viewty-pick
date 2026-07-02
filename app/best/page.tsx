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
import { GuideIcon, guideIconName, emojiSrc } from '../../components/seo/GuideIcon';
import DrillSection, { DrillGroup } from '../../components/seo/DrillSection';

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
type LiveEntry = { page: SeoPage; seller?: string; n: number; lowestPrice: number | null; image: string | null };

// Slugs 301-redirected in next.config (P0 dup consolidation) — never link to a
// redirect hop from the hub.
const REDIRECTED = new Set(['acne-pad', 'men-allinone']);

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

const CATEGORY_KO: Record<string, string> = {
  sunscreen: '선크림', sunstick: '선스틱', suncushion: '선쿠션',
  toner: '토너', lotion: '로션', serum: '세럼', cream: '크림', allinone: '올인원',
  cushion: '쿠션', foundation: '파운데이션', 'base-makeup': '베이스',
  pad: '토너패드', 'sheet-mask': '마스크팩', maskpack: '마스크팩',
  cleansing: '클렌징', 'cleansing-oil': '클렌징오일', 'cleansing-care': '클렌징',
  bodywash: '바디워시', 'body-lotion': '바디로션', bodycare: '바디',
  device: '뷰티 디바이스', skincare: '스킨케어',
};

const CATEGORY_ORDER = ['sunscreen', 'toner', 'serum', 'cream', 'lotion', 'cushion', 'foundation', 'pad', 'sheet-mask', 'maskpack', 'cleansing', 'cleansing-oil', 'allinone', 'device', 'skincare', 'base-makeup', 'bodycare', 'bodywash', 'body-lotion'];
const catRank = (c?: string | null) => {
  const i = CATEGORY_ORDER.indexOf(c || '');
  return i < 0 ? 999 : i;
};

// 고민·성분 tiles (남성은 별도 밴드로 분리)
const CONCERN_DEF: Array<{ key: string; short: string; label: string; emoji: string; test: (s: string) => boolean }> = [
  { key: 'acne', short: '여드름', label: '여드름·트러블', emoji: '1fa79', test: (s) => /acne/.test(s) },
  { key: 'blackhead', short: '블랙헤드', label: '블랙헤드·모공', emoji: '1f50d', test: (s) => /blackhead/.test(s) },
  { key: 'soothing', short: '진정', label: '진정·시카', emoji: '1f33f', test: (s) => /soothing/.test(s) },
  { key: 'hydra', short: '수분', label: '수분·보습', emoji: '1f4a7', test: (s) => /hydra/.test(s) },
  { key: 'pdrn', short: 'PDRN', label: 'PDRN·재생', emoji: '1f9ec', test: (s) => /pdrn/.test(s) },
];

const SKIN_DEF: Array<{ key: string; short: string; label: string; emoji: string }> = [
  { key: '건성', short: '건성', label: '건성 추천', emoji: '1f335' },
  { key: '민감성', short: '민감성', label: '민감성 추천', emoji: '1f338' },
  { key: '지성', short: '지성', label: '지성 추천', emoji: '1fae7' },
  { key: '수부지', short: '수부지', label: '수부지 추천', emoji: '1f4a6' },
  { key: '복합성', short: '복합성', label: '복합성 추천', emoji: '1f317' },
];

function drillItem(e: LiveEntry): { slug: string; label: string; n: number } {
  return { slug: e.page.slug, label: CATEGORY_KO[e.page.category || ''] || cardLabel(e.page), n: e.n };
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

  const live: LiveEntry[] = pages
    .map((p) => {
      const spec = SEO_PAGE_SPECS.find((s) => s.slug === p.slug);
      const matched = matchSeoProducts(products, { category: p.category, skinType: p.skin_type, badge: p.badge_type, keywords: p.keywords, seller: spec?.seller });
      const priced = matched.filter((prod) => prod.hasAnyPrice !== false && prod.lowestPrice > 0).sort((a, b) => a.lowestPrice - b.lowestPrice);
      const lowestPrice = priced[0]?.lowestPrice ?? null;
      const image =
        priced.find((prod) => prod.image && prod.image.startsWith('http'))?.image ??
        matched.find((prod) => prod.image && prod.image.startsWith('http'))?.image ??
        null;
      return { page: p, seller: spec?.seller, n: matched.length, lowestPrice, image };
    })
    .filter((x) => x.n >= MIN_SEO_PRODUCTS && !REDIRECTED.has(x.page.slug));

  const oliveyoung = live.filter((x) => x.seller === 'oliveyoung');
  const rest = live.filter((x) => x.seller !== 'oliveyoung');
  const typeOf = (x: LiveEntry) => x.page.page_type || 'category';

  // ① 에디터 픽 = 큐레이션 + 인기 카테고리 가이드(제품 많은 순) 혼합, 실제 제품 사진
  const curationPicks = rest.filter((x) => typeOf(x) === 'curation').sort((a, b) => b.n - a.n);
  const categoryAll = rest.filter((x) => typeOf(x) === 'category');
  const categoryPicks = [...categoryAll].sort((a, b) => b.n - a.n);
  const featured = [...curationPicks, ...categoryPicks].slice(0, 4);
  const featuredSlugs = new Set(featured.map((f) => f.page.slug));
  const heroPrimary = featured[0];
  const heroSecondary = featured.slice(1, 4);
  const badgeFor = (e: LiveEntry) => (typeOf(e) === 'curation' ? '전문가 큐레이션' : '인기 BEST');

  // ② 고민·성분별 (남성 제외) — 이모지 타일 + 펼침
  const keyword = rest.filter((x) => typeOf(x) === 'keyword');
  const concernGroups: DrillGroup[] = CONCERN_DEF.map((def) => ({
    key: def.key,
    label: def.label,
    short: def.short,
    emoji: `/emoji/${def.emoji}.svg`,
    items: keyword.filter((k) => def.test(k.page.slug)).sort((a, b) => catRank(a.page.category) - catRank(b.page.category)).map(drillItem),
  })).filter((g) => g.items.length > 0);

  // ③ 피부 타입별 — 이모지 타일 + 펼침
  const skinEntries = rest.filter((x) => typeOf(x) === 'skin');
  const skinGroups: DrillGroup[] = SKIN_DEF.map((def) => ({
    key: def.key,
    label: def.label,
    short: def.short,
    emoji: `/emoji/${def.emoji}.svg`,
    items: skinEntries.filter((s) => s.page.skin_type === def.key).sort((a, b) => catRank(a.page.category) - catRank(b.page.category)).map(drillItem),
  })).filter((g) => g.items.length > 0);

  // ④ 남성 밴드 (올리브영처럼 별도 분리)
  const men = keyword.filter((k) => /men/.test(k.page.slug)).sort((a, b) => catRank(a.page.category) - catRank(b.page.category));

  // ⑥ 카테고리 chip (에디터 픽에 이미 노출된 건 제외)
  const category = categoryAll.filter((c) => !featuredSlugs.has(c.page.slug));

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

      {/* ① 에디터 픽 — 실제 제품 사진 */}
      {heroPrimary && (
        <section className="px-4 pt-4">
          <p className="text-[10px] tracking-[0.12em] font-black text-accent mb-2.5">에디터 픽 · 이 시즌 추천</p>
          <Link
            href={`/best/${heroPrimary.page.slug}`}
            className="flex items-center gap-3.5 bg-primary rounded-[20px] p-4 shadow-sm active:scale-[0.99] transition-transform"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroPrimary.image ?? emojiSrc(heroPrimary.page)}
              alt=""
              width={60}
              height={60}
              className={heroPrimary.image ? 'w-[60px] h-[60px] shrink-0 rounded-2xl object-cover bg-white' : 'w-14 h-14 shrink-0'}
            />
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1 bg-white/20 rounded-md px-2 py-0.5 text-[9px] font-bold text-white mb-1.5">{badgeFor(heroPrimary)}</span>
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.image ?? emojiSrc(s.page)}
                      alt=""
                      width={40}
                      height={40}
                      className={s.image ? 'w-10 h-10 shrink-0 rounded-xl object-cover bg-white border border-line' : 'w-9 h-9 shrink-0'}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-accent font-bold mb-0.5">{badgeFor(s)}</p>
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

      {/* ② 고민·성분별 (이모지 타일) */}
      {concernGroups.length > 0 && (
        <section className="px-4 pt-5">
          <SectionHead bar="#CA9BAA" title="고민 · 성분별" sub="탭하면 제품 유형까지" />
          <DrillSection groups={concernGroups} accent="concern" />
        </section>
      )}

      {/* ③ 피부 타입별 (이모지 타일) */}
      {skinGroups.length > 0 && (
        <section className="px-4 pt-5">
          <SectionHead bar="#A4B4BE" title="피부 타입별 추천" sub="탭하면 제품 유형까지" />
          <DrillSection groups={skinGroups} accent="skin" />
        </section>
      )}

      {/* ④ 남성 밴드 */}
      {men.length > 0 && (
        <section className="px-4 pt-5">
          <div className="bg-[#EEF1F4] border border-[#D5DCE3] rounded-[18px] p-3.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="bg-[#3A4A5A] text-white text-[9px] font-black rounded px-1.5 py-0.5 tracking-wide">MEN</span>
              <span className="text-[12.5px] font-black text-[#2E3A46]">남성 추천</span>
            </div>
            <p className="text-[10px] text-[#5E6B78] font-semibold mb-2.5">남성 피부에 맞춘 기초·올인원</p>
            <ul className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {men.map((m) => (
                <li key={m.page.slug} className="shrink-0">
                  <Link
                    href={`/best/${m.page.slug}`}
                    className="flex flex-col items-center min-w-[76px] bg-white border border-[#D5DCE3] rounded-xl px-2 py-2 text-[#3A4A5A] active:scale-[0.97] transition-transform"
                  >
                    <GuideIcon name={guideIconName(m.page)} className="w-7 h-7 mb-1" />
                    <span className="text-[10px] font-black text-[#2E3A46]">{cardLabel(m.page)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ⑤ 올리브영 */}
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
                    <span className="text-[10px] font-black text-[#0A4A38]">{CATEGORY_KO[o.page.category || ''] || cardLabel(o.page)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ⑥ 카테고리별 최저가 (하단 chip) */}
      {category.length > 0 && (
        <section className="mt-5 bg-surface-soft border-t border-divider px-4 pt-4 pb-6">
          <h2 className="text-[11px] font-black text-body mb-0.5">카테고리별 최저가</h2>
          <p className="text-[9.5px] text-sub font-medium mb-2.5">카테고리 탭에서도 볼 수 있어요</p>
          <ul className="flex flex-wrap gap-1.5">
            {category.map((c) => (
              <li key={c.page.slug}>
                <Link
                  href={`/best/${c.page.slug}`}
                  className="inline-flex items-center gap-1.5 bg-surface border border-line rounded-full pl-2 pr-3 py-1.5 text-[#8A8877] active:scale-[0.97] transition-transform"
                >
                  <GuideIcon name={guideIconName(c.page)} className="w-4 h-4" />
                  <span className="text-[10px] font-bold text-body">{CATEGORY_KO[c.page.category || ''] || cardLabel(c.page)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
