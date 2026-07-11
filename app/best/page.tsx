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
import DrillSection, { DrillGroup } from '../../components/seo/DrillSection';
import EditorPickCarousel, { EditorCard } from '../../components/seo/EditorPickCarousel';

// Daily, like every other catalog page: prices change once a day (dawn crawl fires
// revalidateTag('products') on top). The previous hourly window made ~40 /best pages
// expire in sync every hour — a burst of >10ms-CPU SSR renders on the Workers free
// plan (exceededCpu → 1102/503) for no freshness gain.
export const revalidate = 86400;

export function generateMetadata(): Metadata {
  const indexable = isSiteIndexable();
  return {
    title: '뷰티 추천 최저가 비교 가이드 모음',
    description: '선크림·토너·세럼·쿠션 등 카테고리·피부타입별 추천 제품을 쿠팡·올리브영·네이버 최저가로 비교한 가이드 모음.',
    alternates: { canonical: `${SITE_URL}/best` },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

// ── helpers ───────────────────────────────────────────────────────────
type TopProduct = { id: string; brand: string; name: string; image: string | null; price: number | null; regularPrice: number | null; discountPct: number | null; storeName: string | null; storeSlug: string | null };
type LiveEntry = { page: SeoPage; seller?: string; n: number; lowestPrice: number | null; image: string | null; topCandidates: TopProduct[] };

// 7월 여름 시즌 에디터 픽 — slug는 활성 가이드에 매핑되고, 비활성이면 자동 스킵.
// 카테고리가 겹치지 않게(선크림 1장만) 여름의 다른 각도로 구성 → 카드 이미지도 자연히 다양.
// 월별로 이 배열만 바꾸면 시의성이 갱신된다(자동화는 TBD).
const SEASON_PICKS: Array<{ slug: string; label: string; emoji: string; tint: string; pillBg: string; pillColor: string; hook: string }> = [
  { slug: 'toneup-sunscreen', label: '여름 필수', emoji: '2600', tint: '#F6ECDD', pillBg: '#410016', pillColor: '#FFFFFF', hook: 'UV지수 최악의 계절\n안 녹는 톤업 선크림' },
  { slug: 'soothing', label: '자외선 후 진정', emoji: '1f33f', tint: '#E6EFE4', pillBg: '#DCEBD7', pillColor: '#3B6B3A', hook: '태닝·자극 받은 피부\n진정·시카 케어' },
  { slug: 'hydra', label: '수분 충전', emoji: '1f4a7', tint: '#E6EEF2', pillBg: '#DBE7F0', pillColor: '#1E5A8A', hook: '에어컨·장마 속당김\n수분·보습 모음' },
  { slug: 'pdrn', label: '요즘 뜨는 성분', emoji: '1f9ec', tint: '#EDE7F2', pillBg: '#E7DEF2', pillColor: '#5A3C86', hook: '시술 없이 재생 케어\nPDRN 성분 모음' },
];

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

// A drill group is sourced from EITHER a skin_type page filter OR a keyword-slug
// filter. 여드름·블랙헤드(피부 고민)는 피부 타입 섹션에, 진정·수분·PDRN(성분)은
// 고민·성분 섹션에. 남성은 별도 밴드로 분리.
type GroupDef = { key: string; short: string; label: string; emoji: string; skinType?: string; test?: (s: string) => boolean };

// ③ 피부 타입별 — 피부 타입 5종 + 여드름·블랙헤드 피부 고민
const SKIN_SECTION_DEF: GroupDef[] = [
  { key: '지성', short: '지성', label: '지성 추천', emoji: '1fae7', skinType: '지성' },
  { key: '건성', short: '건성', label: '건성 추천', emoji: '1f335', skinType: '건성' },
  { key: '민감성', short: '민감성', label: '민감성 추천', emoji: '1f338', skinType: '민감성' },
  { key: '복합성', short: '복합성', label: '복합성 추천', emoji: '1f317', skinType: '복합성' },
  { key: '수부지', short: '수부지', label: '수부지 추천', emoji: '1f4a6', skinType: '수부지' },
  { key: 'acne', short: '여드름', label: '여드름·트러블', emoji: '1fa79', test: (s) => /acne/.test(s) },
  { key: 'blackhead', short: '블랙헤드', label: '블랙헤드·모공', emoji: '1f50d', test: (s) => /blackhead/.test(s) },
];

// ② 고민·성분별 — 성분/케어 중심
const CONCERN_SECTION_DEF: GroupDef[] = [
  { key: 'soothing', short: '진정', label: '진정·시카', emoji: '1f33f', test: (s) => /soothing/.test(s) },
  { key: 'hydra', short: '수분', label: '수분·보습', emoji: '1f4a7', test: (s) => /hydra/.test(s) },
  { key: 'pdrn', short: 'PDRN', label: 'PDRN·재생', emoji: '1f9ec', test: (s) => /pdrn/.test(s) },
];

function drillItem(e: LiveEntry): { slug: string; label: string; n: number } {
  // Category-less pages are the keyword-only "전체" hub (검색 기준, 카테고리 무관).
  const label = e.page.category ? (CATEGORY_KO[e.page.category] || cardLabel(e.page)) : '전체';
  return { slug: e.page.slug, label, n: e.n };
}
// '전체' 허브(카테고리 없음)를 맨 앞으로, 그다음 카테고리 순.
const drillRank = (x: LiveEntry) => (x.page.category ? catRank(x.page.category) : -1);

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
  // Data-layer rejection (post-crawl transient) must NOT escape the render: OpenNext
  // caches the resulting 500 as the route response, wedging /best until the next
  // revalidate/deploy. Render a degraded (empty) hub instead — ISR (3600s) self-heals.
  let pages: Awaited<ReturnType<typeof getActiveSeoPages>> = [];
  let products: Awaited<ReturnType<typeof getProducts>> = [];
  try {
    [pages, products] = await Promise.all([getActiveSeoPages(), getProducts({ sortBy: 'recommend' })]);
  } catch (e) {
    console.error('[best] data unavailable, rendering degraded hub', e);
  }

  const live: LiveEntry[] = pages
    .map((p) => {
      const spec = SEO_PAGE_SPECS.find((s) => s.slug === p.slug);
      // matchSeoProducts는 입력 순서(=getProducts({sortBy:'recommend'}) 순위)를 그대로 보존한다.
      // 그 가이드 페이지 자체가 보여주는 "1등"과 에디터 픽 스포트라이트가 같은 제품을 가리키도록
      // recommend 순서를 그대로 쓴다(최저가 순 재정렬 금지) — lowestPrice 배지 값만 별도 계산.
      const matched = matchSeoProducts(products, { category: p.category, skinType: p.skin_type, badge: p.badge_type, keywords: p.keywords, seller: spec?.seller });
      const pricedByRecommend = matched.filter((prod) => prod.hasAnyPrice !== false && prod.lowestPrice > 0);
      const lowestPrice = pricedByRecommend.length > 0 ? Math.min(...pricedByRecommend.map((prod) => prod.lowestPrice)) : null;
      const image =
        pricedByRecommend.find((prod) => prod.image && prod.image.startsWith('http'))?.image ??
        matched.find((prod) => prod.image && prod.image.startsWith('http'))?.image ??
        null;
      // 딜 카드 스포트라이트 후보 — recommend 순 상위 5개(카드 dedupe용).
      const topCandidates: TopProduct[] = pricedByRecommend.slice(0, 5).map((t) => {
        const bestStore =
          t.stores.find((s) => s.isBest && s.hasPrice !== false) ??
          [...t.stores].filter((s) => s.hasPrice !== false && s.price > 0).sort((a, b) => a.price - b.price)[0];
        return {
          id: t.id,
          brand: t.brand,
          name: t.name,
          image: t.image && t.image.startsWith('http') ? t.image : null,
          price: t.lowestPrice ?? null,
          regularPrice: t.regularPrice ?? null,
          discountPct: t.discountVsRegular ?? null,
          storeName: bestStore?.name ?? null,
          storeSlug: bestStore?.sellerSlug ?? null,
        };
      });
      return { page: p, seller: spec?.seller, n: matched.length, lowestPrice, image, topCandidates };
    })
    .filter((x) => x.n >= MIN_SEO_PRODUCTS && !REDIRECTED.has(x.page.slug));

  const oliveyoung = live.filter((x) => x.seller === 'oliveyoung');
  const rest = live.filter((x) => x.seller !== 'oliveyoung');
  const typeOf = (x: LiveEntry) => x.page.page_type || 'category';

  const categoryAll = rest.filter((x) => typeOf(x) === 'category');

  // ① 에디터 픽 — 시즌 딜 카드 캐러셀. 시즌 slug ∩ 활성 가이드(비활성 자동 스킵).
  // 가이드끼리 제품 풀이 겹치면(예: 톤업 ⊂ 디렉터파이) 같은 최저가 상품으로 수렴해
  // 카드가 중복돼 보인다. 이미 쓴 상품·브랜드를 추적해 다음 후보로 넘겨 이미지 다양성 확보.
  const bySlug = new Map(live.map((e) => [e.page.slug, e]));
  const usedProductIds = new Set<string>();
  const usedBrands = new Set<string>();
  const editorCards: EditorCard[] = [];
  for (const pk of SEASON_PICKS) {
    const e = bySlug.get(pk.slug);
    if (!e) continue;
    const cands = e.topCandidates;
    // 이미 쓴 상품/브랜드가 아닌 후보 우선 → 상품만 다른 것 → 없으면 원래 최저가.
    const chosen =
      cands.find((c) => !usedProductIds.has(c.id) && (!c.brand || !usedBrands.has(c.brand))) ??
      cands.find((c) => !usedProductIds.has(c.id)) ??
      cands[0] ??
      null;
    if (chosen) {
      usedProductIds.add(chosen.id);
      if (chosen.brand) usedBrands.add(chosen.brand);
    }
    editorCards.push({
      slug: e.page.slug,
      label: pk.label,
      emoji: `/emoji/${pk.emoji}.svg`,
      tint: pk.tint,
      pillBg: pk.pillBg,
      pillColor: pk.pillColor,
      hook: pk.hook,
      n: e.n,
      brand: chosen?.brand ?? null,
      name: chosen?.name ?? null,
      image: chosen?.image ?? e.image ?? null,
      price: chosen?.price ?? e.lowestPrice ?? null,
      regularPrice: chosen?.regularPrice ?? null,
      discountPct: chosen?.discountPct ?? null,
      storeName: chosen?.storeName ?? null,
      storeSlug: chosen?.storeSlug ?? null,
    });
  }
  const featuredSlugs = new Set(editorCards.map((c) => c.slug));

  // 이모지 타일 그룹 빌더 — skinType 필터 또는 keyword-slug 필터에서 아이템 수집
  const buildGroups = (defs: GroupDef[]): DrillGroup[] =>
    defs
      .map((def) => {
        const pool = def.skinType
          ? rest.filter((x) => typeOf(x) === 'skin' && x.page.skin_type === def.skinType)
          : rest.filter((x) => typeOf(x) === 'keyword' && def.test!(x.page.slug));
        return {
          key: def.key,
          label: def.label,
          short: def.short,
          emoji: `/emoji/${def.emoji}.svg`,
          items: pool.sort((a, b) => drillRank(a) - drillRank(b)).map(drillItem),
        };
      })
      .filter((g) => g.items.length > 0);

  // ② 고민·성분별 (성분 중심), ③ 피부 타입별 (피부타입 + 여드름·블랙헤드)
  const concernGroups = buildGroups(CONCERN_SECTION_DEF);
  const skinGroups = buildGroups(SKIN_SECTION_DEF);

  // ④ 남성 밴드 (올리브영처럼 별도 분리)
  const men = rest.filter((x) => typeOf(x) === 'keyword' && /men/.test(x.page.slug)).sort((a, b) => catRank(a.page.category) - catRank(b.page.category));

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

      {/* ① 에디터 픽 — 시즌 딜 카드 캐러셀 */}
      {editorCards.length > 0 && (
        <section className="pt-4">
          <div className="px-4 flex items-center justify-between mb-2.5">
            <span className="text-[14px] font-black text-title tracking-tight">에디터 픽</span>
            <span className="text-[10px] font-black text-accent">7월 여름 · 매일 최저가 갱신</span>
          </div>
          <EditorPickCarousel cards={editorCards} />
        </section>
      )}

      {/* ② 피부 타입별 (이모지 타일) */}
      {skinGroups.length > 0 && (
        <section className="px-4 pt-5">
          <SectionHead bar="#A4B4BE" title="피부 타입별 추천" sub="탭하면 제품 유형까지" />
          <DrillSection groups={skinGroups} accent="skin" />
        </section>
      )}

      {/* ③ 고민·성분별 (이모지 타일) */}
      {concernGroups.length > 0 && (
        <section className="px-4 pt-5">
          <SectionHead bar="#CA9BAA" title="고민 · 성분별" sub="탭하면 제품 유형까지" />
          <DrillSection groups={concernGroups} accent="concern" />
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
