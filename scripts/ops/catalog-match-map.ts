/**
 * Catalog match map — READ-ONLY diagnostic (no DB/sheet/sync writes).
 *
 * Runs the REAL fixed matcher (`fix/naver-sku-matching`) against the whole active
 * catalog via the live Naver/Coupang search APIs and classifies every
 * naver / oliveyoung-via-naver / coupang listing, so the operator can fix the
 * SHEET once (typos, multipack URLs, allowlist, demo products) before a full
 * write sync.
 *
 *   - Calls the actual matcher functions (matchNaverOffer / pickOfficialOffer /
 *     classifyOfferComposition / matchesOfficialMall / productIdentityScore) — NOT a
 *     reimplementation, so the map reflects real behaviour.
 *   - Writes ONLY a report (docs/worklog/catalog-match-map.md). No price_snapshots /
 *     current_prices / listings / sheet writes. No crawler:sync / sheets:import.
 *
 * Run: npx tsx -r dotenv/config scripts/ops/catalog-match-map.ts
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseServer, isSupabaseServerConfigured } from '../../lib/supabase/server';
import {
  matchNaverOffer,
  matchOliveYoungOffer,
  classifyOfferComposition,
  matchesOfficialMall,
  isIndividualMallOffer,
  productIdentityScore,
  resolveCuratedProductNo,
  cleanQuery,
  stripHtml,
  NaverShoppingItem,
} from '../../crawler/adapters/naver';
import { CoupangAdapter, extractCoupangProductId, isCoupangShortLink } from '../../crawler/adapters/coupang';
import { extractPackageFromTitle } from '../../crawler/core/packageExtractor';
import { Product, Listing, RetailerAllowlist } from '../../lib/types';

const NAVER_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Anchor-only price policy: price = OK_SINGLE only; everything else is link-only
// (no fuzzy price). NAME_MISMATCH/DEMO/ANCHOR_SET/URL_MULTIPACK/DATA_ERROR are the
// actionable sub-reasons; LINK_ONLY = expected/structural (N not on Naver, or OY).
type Category =
  | 'OK_SINGLE'
  | 'NAME_MISMATCH'
  | 'INSPECT'
  | 'DEMO_SUSPECT'
  | 'DATA_ERROR'
  | 'LINK_ONLY';

interface Row {
  productId: number;
  brand: string;
  name: string;
  seller: string;
  url: string;
  candidateSummary: string;
  matchResult: string;
  category: Category;
  suggestion: string;
}

// Per-product live Naver candidate cache (naver + OY listing of the same product
// share the brand+name query → one fetch per product for the diagnostic view).
const candCache = new Map<number, NaverShoppingItem[]>();
async function naverCandidates(product: Product): Promise<NaverShoppingItem[]> {
  if (candCache.has(product.id)) return candCache.get(product.id)!;
  const q = cleanQuery(product.brand, product.name);
  let items: NaverShoppingItem[] = [];
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(q)}&display=40&sort=sim`,
      { headers: { 'X-Naver-Client-Id': NAVER_ID, 'X-Naver-Client-Secret': NAVER_SECRET } }
    );
    if (res.ok) items = (await res.json()).items || [];
  } catch {
    /* leave empty */
  }
  candCache.set(product.id, items);
  await sleep(120);
  return items;
}

function fmt(n: string | number | null | undefined): string {
  const v = typeof n === 'string' ? parseInt(n, 10) : n;
  return v != null && !isNaN(v) ? Number(v).toLocaleString('ko-KR') : '?';
}

// Diagnose a naver / oliveyoung listing using the REAL matcher + a candidate view.
async function diagnoseNaverLike(
  product: Product,
  seller: 'naver' | 'oliveyoung',
  listing: Listing,
  allowedStoreName: string | null
): Promise<Row> {
  // Tier-1 anchor uses the curated naver URL's channel-product number (naver only;
  // OY's oy.run URL has none → tier-2). Authoritative result from the real matcher.
  const anchorNo = seller === 'naver' ? await resolveCuratedProductNo(listing.url) : null;
  const result =
    seller === 'oliveyoung'
      ? await matchOliveYoungOffer(product, NAVER_ID, NAVER_SECRET) // loose 올리브영 match
      : await matchNaverOffer(product, allowedStoreName, NAVER_ID, NAVER_SECRET, anchorNo); // anchor-only
  await sleep(120);

  // Candidate view (same query) for the "was a single available?" diagnosis.
  const items = await naverCandidates(product);
  const individual = items.filter(isIndividualMallOffer);
  const official = individual.filter((it) => matchesOfficialMall(it.mallName, allowedStoreName, product.brand));
  const officialPassing = official.filter((it) => productIdentityScore(it.title, product.name) >= 0.5);
  const officialSingles = officialPassing.filter((it) => classifyOfferComposition(it.title).kind === 'single');
  // closest real product among ANY individual offer (for a typo hint).
  const closest = [...individual]
    .map((it) => ({ it, s: productIdentityScore(it.title, product.name) }))
    .sort((a, b) => b.s - a.s)[0];
  const anySingleSomewhere = individual.some((it) => classifyOfferComposition(it.title).kind === 'single' && productIdentityScore(it.title, product.name) >= 0.5);

  const candidateSummary =
    `${items.length} hits · official ${official.length} (single ${officialSingles.length}) · ` +
    (closest ? `closest "${stripHtml(closest.it.title).slice(0, 38)}" @${closest.it.mallName} id${closest.s.toFixed(2)}` : 'no individual offers');

  let category: Category;
  let suggestion = '';
  let matchResult: string;

  const tag = /id-anchored/.test(result.reason) ? ' [anchor]' : /올리브영 match/.test(result.reason) ? ' [OY]' : '';
  if (result.matched) {
    const m = result.matched;
    matchResult = `✅ ${fmt(m.lprice)}원 @${m.mallName} — ${stripHtml(m.title).slice(0, 40)}${tag}`;
    category = 'OK_SINGLE';
  } else if (result.needsInspection) {
    // Anchored/matched SKU is a heterogeneous set or an ambiguous OY match → no
    // auto-price; operator inspects / sets a manual_override.
    matchResult = `🔬 inspection — ${result.reason}`;
    category = 'INSPECT';
    suggestion = '이종 2제품 세트 또는 모호한 OY 매칭 — 검수 후 manual_override 또는 단품 URL';
  } else {
    // No price → link-only. Sub-diagnose the WHY for the operator.
    matchResult = `🔗 link-only — ${result.reason}`;
    if (seller === 'oliveyoung') {
      category = 'LINK_ONLY';
      suggestion = '네이버에 올리브영 오퍼 없음 → 링크만(Tier 4); 중요 제품은 manual_override(Tier 3)';
    } else if (items.length === 0) {
      category = 'DEMO_SUSPECT';
      suggestion = '검색 0건 — 브랜드스토어 미인덱스/단종 의심, 카탈로그 정리 검토';
    } else if (official.length > 0 && officialPassing.length === 0 && anySingleSomewhere) {
      // The product clearly exists (official offer w/ high closest id) but our query
      // didn't surface the curated N — often a sheet product-name typo.
      category = 'NAME_MISMATCH';
      const hint = official
        .map((it) => ({ it, s: productIdentityScore(it.title, product.name) }))
        .sort((a, b) => b.s - a.s)[0];
      suggestion = hint ? `시트 제품명 확인 — 실제 제목 예: "${stripHtml(hint.it.title).slice(0, 50)}"` : '시트 제품명 확인';
    } else {
      category = 'LINK_ONLY';
      suggestion = `큐레이션 N이 검색에 안 뜸 → 링크만(정상/구조적). closest @${closest?.it.mallName ?? '—'}`;
    }
  }

  return {
    productId: product.id,
    brand: product.brand || '',
    name: product.name,
    seller,
    url: listing.url || '',
    candidateSummary,
    matchResult,
    category,
    suggestion,
  };
}

async function diagnoseCoupang(product: Product, listing: Listing): Promise<Row> {
  const url = listing.url || '';
  const pid = extractCoupangProductId(url);
  if (!pid) {
    return {
      productId: product.id, brand: product.brand || '', name: product.name, seller: 'coupang', url,
      candidateSummary: isCoupangShortLink(url) ? 'share short-link (no productId)' : 'not a product-detail URL',
      matchResult: '⛔ data_error', category: 'DATA_ERROR',
      suggestion: '시트 URL을 제품 상세(/vp/products/{id})로 교체',
    };
  }
  let offer;
  try {
    offer = await new CoupangAdapter().fetchOffer(listing);
  } catch (e) {
    return {
      productId: product.id, brand: product.brand || '', name: product.name, seller: 'coupang', url,
      candidateSummary: 'fetch error', matchResult: `⛔ failed — ${(e as Error).message.slice(0, 60)}`,
      category: 'LINK_ONLY', suggestion: '쿠팡 fetch 오류 — 재시도/수동 확인',
    };
  }
  const title = offer.sourceText || '';
  const ext = extractPackageFromTitle(stripHtml(title));
  if (offer.outcome === 'ok' && offer.salePrice != null) {
    if (ext.heterogeneous) {
      return {
        productId: product.id, brand: product.brand || '', name: product.name, seller: 'coupang', url,
        candidateSummary: `anchored pid ${pid}`,
        matchResult: `🔬 inspection — ${stripHtml(title).slice(0, 44)} (heterogeneous)`,
        category: 'INSPECT', suggestion: '이종 2제품 세트 — 검수/단품 URL 교체',
      };
    }
    const qty = ext.unitCount && ext.unitCount > 1 ? ext.unitCount : 1;
    return {
      productId: product.id, brand: product.brand || '', name: product.name, seller: 'coupang', url,
      candidateSummary: `anchored pid ${pid}`,
      matchResult: `✅ ${fmt(offer.salePrice)}원${qty > 1 ? ` (×${qty} 개당가)` : ''} — ${stripHtml(title).slice(0, 40)}`,
      category: 'OK_SINGLE', suggestion: '',
    };
  }
  return {
    productId: product.id, brand: product.brand || '', name: product.name, seller: 'coupang', url,
    candidateSummary: `anchored pid ${pid}`,
    matchResult: `🔗 link-only — ${offer.outcome || 'no_offer'}: ${stripHtml(title).slice(0, 40)}`,
    category: 'LINK_ONLY', suggestion: 'productId 검색 미노출 — 링크전용 또는 시트 URL 확인',
  };
}

const CAT_LABEL: Record<Category, string> = {
  OK_SINGLE: '✅ 가격 수집(앵커 단품/묶음·OY·쿠팡)',
  NAME_MISMATCH: '⚠️ 이름 오타/불일치(링크만)',
  INSPECT: '🔬 검수 필요(이종세트/모호 OY)',
  DEMO_SUSPECT: '🔎 데모/오큐레이션 의심(링크만)',
  DATA_ERROR: '⚠️ URL 데이터 오류(링크만)',
  LINK_ONLY: '🔗 링크만(앵커 미스/OY 미수집)',
};

async function main() {
  if (!isSupabaseServerConfigured()) {
    console.error('Supabase not configured — aborting.');
    process.exit(2);
  }
  if (!NAVER_ID || !NAVER_SECRET) {
    console.error('Naver API keys not configured — aborting.');
    process.exit(2);
  }

  const { data: products } = await supabaseServer.from('products').select('*').eq('is_active', true);
  const { data: listings } = await supabaseServer.from('listings').select('*').eq('is_active', true);
  const { data: sellers } = await supabaseServer.from('sellers').select('id, slug, name');
  const { data: allowlist } = await supabaseServer.from('retailer_allowlist').select('*').eq('is_active', true);
  const prods = (products || []) as Product[];
  const lists = (listings || []) as Listing[];
  const sN = (id: number) => (sellers || []).find((s) => s.id === id)?.slug || String(id);
  const sellerId = (slug: string) => (sellers || []).find((s) => s.slug === slug)?.id;

  const allowFor = (brand: string | null, slug: string): string | null =>
    (allowlist as RetailerAllowlist[] | null)?.find(
      (al) => al.is_active && al.seller_id === sellerId(slug) && (al.brand || '').toLowerCase() === (brand || '').toLowerCase()
    )?.allowed_store_name || null;

  const rows: Row[] = [];
  const skipped: Record<string, number> = {};

  let n = 0;
  for (const listing of lists) {
    const product = prods.find((p) => p.id === listing.product_id);
    if (!product) continue;
    const slug = sN(listing.seller_id);
    n++;
    process.stderr.write(`\r[${n}/${lists.length}] ${slug} #${product.id} ${product.name.slice(0, 18)}            `);
    if (slug === 'naver') {
      rows.push(await diagnoseNaverLike(product, 'naver', listing, allowFor(product.brand, 'naver')));
    } else if (slug === 'oliveyoung') {
      rows.push(await diagnoseNaverLike(product, 'oliveyoung', listing, allowFor(product.brand, 'oliveyoung') || '올리브영'));
    } else if (slug === 'coupang') {
      rows.push(await diagnoseCoupang(product, listing));
    } else {
      skipped[slug] = (skipped[slug] || 0) + 1; // zigzag / ably — no adapter
    }
  }
  process.stderr.write('\n');

  // ----- distribution -----
  const dist: Record<string, number> = {};
  rows.forEach((r) => (dist[r.category] = (dist[r.category] || 0) + 1));

  // ----- build report -----
  const out: string[] = [];
  out.push('# 전체 카탈로그 매칭 맵 (READ-ONLY 진단)');
  out.push('');
  out.push(`- **일자**: ${new Date().toISOString().slice(0, 10)}`);
  out.push('- **매처**: `fix/naver-sku-matching` (실제 함수 호출: matchNaverOffer / pickOfficialOffer / classifyOfferComposition)');
  out.push('- **모드**: READ-ONLY. DB/시트/sync 무변경. 라이브 네이버·쿠팡 검색 API만 사용.');
  out.push(`- **대상**: 활성 listing ${lists.length}건 중 어댑터 보유 ${rows.length}건 진단 (zigzag/ably ${Object.values(skipped).reduce((a, b) => a + b, 0)}건은 어댑터 없음 → 제외).`);
  out.push('');
  out.push('## 요약 분포');
  out.push('| 분류 | 건수 |');
  out.push('|---|---|');
  (Object.keys(CAT_LABEL) as Category[]).forEach((c) => {
    if (dist[c]) out.push(`| ${CAT_LABEL[c]} | ${dist[c]} |`);
  });
  out.push('');

  // ----- operator fix lists -----
  const byCat = (c: Category) => rows.filter((r) => r.category === c);
  const fixList = (title: string, c: Category) => {
    const r = byCat(c);
    if (!r.length) return;
    out.push(`### ${title} (${r.length})`);
    r.forEach((x) => out.push(`- **${x.brand} ${x.name}** [${x.seller}] — ${x.suggestion}\n  - ${x.matchResult}\n  - 후보: ${x.candidateSummary}\n  - url: ${x.url}`));
    out.push('');
  };
  out.push('## 운영자 수정 리스트');
  out.push('');
  fixList('1. 시트 제품명 오타/불일치 (앵커 회복용 — 링크만 상태)', 'NAME_MISMATCH');
  fixList('2. 검수 필요 — 이종 2제품 세트 / 모호한 OY 매칭 (검수 후 manual_override 또는 단품 URL)', 'INSPECT');
  fixList('3. URL 데이터 오류', 'DATA_ERROR');
  fixList('4. 데모/오큐레이션 정리 후보', 'DEMO_SUSPECT');
  // LINK_ONLY(앵커 미스/OY 미수집)는 다수·구조적이라 개별 나열 대신 per-listing 표 참조.

  // ----- full per-listing table -----
  out.push('## per-listing 전체 표');
  out.push('| # | 제품 | 판매처 | 분류 | 매처 결과 | 후보 요약 |');
  out.push('|---|---|---|---|---|---|');
  rows
    .sort((a, b) => a.productId - b.productId || a.seller.localeCompare(b.seller))
    .forEach((r) => {
      const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      out.push(`| ${r.productId} | ${esc(r.brand + ' ' + r.name).slice(0, 40)} | ${r.seller} | ${CAT_LABEL[r.category]} | ${esc(r.matchResult).slice(0, 70)} | ${esc(r.candidateSummary).slice(0, 70)} |`);
    });
  out.push('');
  out.push('> 정당한 no_offer(세트only/미입점)는 수정 불필요(trust-first 의도). 위 1~5만 시트 정리 대상.');
  out.push('');

  const file = path.join(process.cwd(), 'docs/worklog/catalog-match-map.md');
  fs.writeFileSync(file, out.join('\n'), 'utf8');
  console.log(`\n[catalog-match-map] distribution: ${JSON.stringify(dist)}`);
  console.log(`[catalog-match-map] skipped (no adapter): ${JSON.stringify(skipped)}`);
  console.log(`[catalog-match-map] report → ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
