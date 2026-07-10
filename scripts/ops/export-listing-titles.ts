/**
 * READ-ONLY export: for every active listing under naver/coupang/oliveyoung
 * (i.e. every product_links-sheet link for those 3 sellers, as imported into
 * the DB), pull the most recent crawled offer title (price_snapshots.source_text)
 * and write it to a CSV. No network calls, no writes — plain SELECTs.
 *
 * Run: npm run ops:export-titles  (or: tsx -r dotenv/config scripts/ops/export-listing-titles.ts)
 * Output: <scratchpad or --out=path>/listing-titles.csv
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseServer, isSupabaseServerConfigured } from '../../lib/supabase/server';

const TARGET_SELLERS = ['naver', 'coupang', 'oliveyoung'];

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  if (!isSupabaseServerConfigured()) {
    console.error('SUPABASE NOT CONFIGURED — aborting.');
    process.exit(2);
  }

  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const outPath = outArg
    ? outArg.split('=')[1]
    : path.join(process.cwd(), 'listing-titles.csv');

  const { data: sellers, error: sellerErr } = await supabaseServer
    .from('sellers')
    .select('id, slug, name')
    .in('slug', TARGET_SELLERS);
  if (sellerErr) throw sellerErr;
  const sellerById = new Map((sellers || []).map((s) => [s.id, s]));

  const { data: listings, error: listErr } = await supabaseServer
    .from('listings')
    .select('id, link_key, product_id, seller_id, url, affiliate_url')
    .eq('is_active', true)
    .in('seller_id', (sellers || []).map((s) => s.id));
  if (listErr) throw listErr;

  const { data: products, error: prodErr } = await supabaseServer
    .from('products')
    .select('id, name, brand, volume_ml, volume_unit');
  if (prodErr) throw prodErr;
  const productById = new Map((products || []).map((p) => [p.id, p]));

  // Latest snapshot per listing (any status — we want the last known title
  // even if it's a warning/held row, which is exactly what needs auditing).
  const { data: snaps, error: snapErr } = await supabaseServer
    .from('price_snapshots')
    .select('listing_id, crawled_at, status, sale_price, source_text')
    .in('listing_id', (listings || []).map((l) => l.id))
    .order('crawled_at', { ascending: false });
  if (snapErr) throw snapErr;
  const latestByListing = new Map<number, (typeof snaps)[number]>();
  for (const s of snaps || []) {
    if (!latestByListing.has(s.listing_id)) latestByListing.set(s.listing_id, s);
  }

  const rows: string[] = [];
  rows.push(
    ['product_id', 'product_name', 'brand', 'volume_ml', 'volume_unit', 'seller', 'listing_id', 'link_key', 'url', 'affiliate_url', 'crawled_at', 'status', 'sale_price', 'title']
      .map(csvEscape)
      .join(',')
  );

  let withTitle = 0;
  for (const l of listings || []) {
    const p = productById.get(l.product_id);
    const seller = sellerById.get(l.seller_id);
    const snap = latestByListing.get(l.id);
    if (snap?.source_text) withTitle++;
    rows.push(
      [
        l.product_id,
        p?.name ?? '',
        p?.brand ?? '',
        p?.volume_ml ?? '',
        p?.volume_unit ?? '',
        seller?.slug ?? '',
        l.id,
        l.link_key,
        l.url,
        l.affiliate_url ?? '',
        snap?.crawled_at ?? '',
        snap?.status ?? '',
        snap?.sale_price ?? '',
        snap?.source_text ?? '',
      ]
        .map(csvEscape)
        .join(',')
    );
  }

  fs.writeFileSync(outPath, '﻿' + rows.join('\n'), 'utf8'); // BOM for Excel(ko-KR) compat
  console.log(`[export] ${listings?.length ?? 0} listings, ${withTitle} with a known title → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
