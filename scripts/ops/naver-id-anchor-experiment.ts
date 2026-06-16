/**
 * Naver productId anchoring experiment — READ-ONLY diagnostic (no writes).
 *
 * Question: can we anchor a curated Naver listing to a Shopping API result by the
 * curated URL's channel-product-number (N)? If yes, matching can use id-anchoring
 * (exact curated SKU) instead of title/variant heuristics.
 *
 * For each active naver listing:
 *   - Extract N from the curated URL (brand.naver.com / smartstore /products/{N},
 *     or naver.me shortlink resolved via redirect → channelProductNo / /products/{N}).
 *   - Search the Shopping API with the SAME query the matcher builds (cleanQuery),
 *     display=100, and dump every item (productId, productType, mallName, link).
 *   - Judge: (a) direct  item.productId == N ; (b) link  item.link → /products/{N} ;
 *     (c) miss.
 *
 * No DB/sheet writes, no crawler:sync. Only the live Shopping API + redirect
 * resolution of the curated shortlinks (no page-content scraping).
 *
 * Run: npx tsx -r dotenv/config scripts/ops/naver-id-anchor-experiment.ts
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseServer, isSupabaseServerConfigured } from '../../lib/supabase/server';
import { cleanQuery, stripHtml, NaverShoppingItem } from '../../crawler/adapters/naver';
import { Product, Listing } from '../../lib/types';

const NAVER_ID = process.env.NAVER_CLIENT_ID || '';
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET || '';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function nFromUrl(url: string): string | null {
  if (!url) return null;
  const p = url.match(/\/products\/(\d+)/);
  if (p) return p[1];
  const c = url.match(/channelProductNo=(\d+)/);
  if (c) return c[1];
  return null;
}

async function resolveN(url: string): Promise<{ n: string | null; finalUrl: string | null }> {
  const direct = nFromUrl(url);
  if (direct) return { n: direct, finalUrl: url };
  if (/naver\.me\//.test(url) || /naver\.com\/[^/]*$/.test(url)) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      return { n: nFromUrl(res.url), finalUrl: res.url };
    } catch {
      return { n: null, finalUrl: null };
    }
  }
  return { n: null, finalUrl: null };
}

async function search(query: string): Promise<NaverShoppingItem[]> {
  try {
    const res = await fetch(
      `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=100&sort=sim`,
      { headers: { 'X-Naver-Client-Id': NAVER_ID, 'X-Naver-Client-Secret': NAVER_SECRET } }
    );
    if (!res.ok) return [];
    return (await res.json()).items || [];
  } catch {
    return [];
  }
}

type Verdict = 'direct' | 'link' | 'miss' | 'no_id';
interface Row {
  productId: number;
  name: string;
  urlKind: 'brand/smartstore' | 'shortlink' | 'other';
  n: string | null;
  resultCount: number;
  typeDist: string;
  directHit: boolean;
  linkHit: boolean;
  verdict: Verdict;
  hitMall: string;
}

async function main() {
  if (!isSupabaseServerConfigured() || !NAVER_ID || !NAVER_SECRET) {
    console.error('Supabase / Naver keys not configured — aborting.');
    process.exit(2);
  }
  const { data: sellers } = await supabaseServer.from('sellers').select('id, slug');
  const naverId = (sellers || []).find((s) => s.slug === 'naver')?.id;
  const { data: products } = await supabaseServer.from('products').select('*').eq('is_active', true);
  const { data: listings } = await supabaseServer
    .from('listings').select('*').eq('is_active', true).eq('seller_id', naverId);
  const prods = (products || []) as Product[];
  const lists = (listings || []) as Listing[];

  const rows: Row[] = [];
  let calls = 0;
  let i = 0;
  for (const listing of lists) {
    const product = prods.find((p) => p.id === listing.product_id);
    if (!product) continue;
    i++;
    process.stderr.write(`\r[${i}/${lists.length}] #${product.id} ${product.name.slice(0, 18)}        `);

    const url = listing.url || '';
    const urlKind: Row['urlKind'] = /(?:brand|smartstore)\.naver\.com/.test(url)
      ? 'brand/smartstore'
      : /naver\.me\//.test(url)
      ? 'shortlink'
      : 'other';
    const { n } = await resolveN(url);
    await sleep(100);

    if (!n) {
      rows.push({ productId: product.id, name: product.name, urlKind, n: null, resultCount: 0, typeDist: '', directHit: false, linkHit: false, verdict: 'no_id', hitMall: '' });
      continue;
    }

    const items = await search(cleanQuery(product.brand, product.name));
    calls++;
    await sleep(120);

    const typeCount: Record<string, number> = {};
    let directItem: NaverShoppingItem | null = null;
    let linkItem: NaverShoppingItem | null = null;
    for (const it of items) {
      typeCount[it.productType] = (typeCount[it.productType] || 0) + 1;
      if (String(it.productId) === n && !directItem) directItem = it;
      const lp = nFromUrl(it.link);
      if (lp === n && !linkItem) linkItem = it;
    }
    const directHit = !!directItem;
    const linkHit = !!linkItem;
    const verdict: Verdict = directHit ? 'direct' : linkHit ? 'link' : 'miss';
    const hit = directItem || linkItem;
    rows.push({
      productId: product.id, name: product.name, urlKind, n,
      resultCount: items.length,
      typeDist: Object.entries(typeCount).map(([k, v]) => `t${k}:${v}`).join(' '),
      directHit, linkHit, verdict,
      hitMall: hit ? `${hit.mallName} — ${stripHtml(hit.title).slice(0, 36)} (${Number(hit.lprice).toLocaleString()})` : '',
    });
  }
  process.stderr.write('\n');

  // ---- summaries ----
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '0%');
  const summarize = (subset: Row[], label: string): string => {
    const withId = subset.filter((r) => r.verdict !== 'no_id');
    const d = withId.filter((r) => r.verdict === 'direct').length;
    const l = withId.filter((r) => r.verdict === 'link').length;
    const m = withId.filter((r) => r.verdict === 'miss').length;
    const noId = subset.length - withId.length;
    return `- **${label}** (n=${subset.length}, id추출 ${withId.length}): 직접 ${d} (${pct(d, withId.length)}) · 링크 ${l} (${pct(l, withId.length)}) · 불가 ${m} (${pct(m, withId.length)}) · id없음 ${noId}`;
  };

  const out: string[] = [];
  out.push('# 네이버 productId 앵커링 실험 (READ-ONLY)');
  out.push('');
  out.push(`- **일자**: ${new Date().toISOString().slice(0, 10)}`);
  out.push('- **모드**: READ-ONLY. 라이브 Shopping API(display=100) + 큐레이션 shortlink 리다이렉트 해석만. DB/시트 무변경.');
  out.push(`- **쿼리**: 매처와 동일한 \`cleanQuery(brand, name)\`. 검색 호출 ${calls}회.`);
  out.push(`- **대상**: 활성 naver listing ${rows.length}건.`);
  out.push('');
  out.push('## hit-rate 요약');
  out.push(summarize(rows, '전체'));
  out.push(summarize(rows.filter((r) => r.urlKind === 'brand/smartstore'), 'brand/smartstore URL'));
  out.push(summarize(rows.filter((r) => r.urlKind === 'shortlink'), 'naver.me shortlink'));
  out.push('');
  out.push('> 직접 = 검색결과 item.productId == 큐레이션 N · 링크 = item.link → /products/{N} · 불가 = 결과에 N 없음 · id없음 = URL에서 N 추출 불가.');
  out.push('');
  out.push('## per-listing 표');
  out.push('| # | 제품 | URL종류 | N | 결과수 | productType분포 | 직접 | 링크 | 판정 | 매칭몰(hit) |');
  out.push('|---|---|---|---|---|---|---|---|---|---|');
  rows.sort((a, b) => a.productId - b.productId).forEach((r) => {
    const esc = (s: string) => (s || '').replace(/\|/g, '\\|');
    out.push(`| ${r.productId} | ${esc(r.name).slice(0, 28)} | ${r.urlKind} | ${r.n ?? '—'} | ${r.resultCount} | ${r.typeDist} | ${r.directHit ? '✅' : '–'} | ${r.linkHit ? '✅' : '–'} | ${r.verdict} | ${esc(r.hitMall).slice(0, 50)} |`);
  });
  out.push('');

  // ---- decision guide ----
  const withId = rows.filter((r) => r.verdict !== 'no_id');
  const hitRate = withId.length ? (withId.filter((r) => r.verdict !== 'miss').length / withId.length) : 0;
  out.push('## 결정 가이드');
  if (hitRate >= 0.6) {
    out.push(`- **직접+링크 hit-rate ${Math.round(hitRate * 100)}% (높음)** → **B를 id 앵커링으로 재설계 권고**: 검색 결과에서 N 일치 항목을 채택해 큐레이션 정확 SKU 확보(변형/세트 오매칭 동시 해결). 제목 유사도는 보조.`);
  } else {
    out.push(`- **직접+링크 hit-rate ${Math.round(hitRate * 100)}% (낮음)** → 기존 B(변형 토큰 제목 매칭) 유지. id 앵커링은 hit되는 listing에만 부분 적용. 검색이 개별 몰 상품을 거의 안 돌려주는지 productType 분포로 확인(t1=카탈로그 대표).`);
  }
  const linkOnly = withId.filter((r) => r.verdict === 'link').length;
  if (linkOnly > 0) out.push(`- 링크 경유만 되는 비율 ${pct(linkOnly, withId.length)} → 링크 해석 비용/차단 트레이드오프 고려.`);
  out.push('');

  const file = path.join(process.cwd(), 'docs/worklog/naver-id-anchor-experiment.md');
  fs.writeFileSync(file, out.join('\n'), 'utf8');
  const vd: Record<string, number> = {};
  rows.forEach((r) => (vd[r.verdict] = (vd[r.verdict] || 0) + 1));
  console.log(`\n[id-anchor] verdicts: ${JSON.stringify(vd)} · search calls: ${calls}`);
  console.log(`[id-anchor] report → ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
