/**
 * LIVE Naver API matching validation — NOT a CI test (needs network + keys).
 * Run: npm run live-check:naver [-- --limit=7]
 *
 * Drives the real NaverAdapter (Shopping Search API) for the active Naver
 * listings (one per product) and reports the matched mallName / price / link,
 * whether it resolved to the official mall, and any excluded cases. No crawling
 * (brand.naver.com robots disallows it); the search API is the approved path.
 * Search-API productId matching is gone — matching is mallName + title (§2).
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseServer, isSupabaseServerConfigured } from '../../lib/supabase/server';
import { NaverAdapter } from '../../crawler/adapters/naver';
import { Listing } from '../../lib/types';

const EXP_DIR = path.join(__dirname, 'expectations');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!isSupabaseServerConfigured()) {
    console.log('SUPABASE NOT CONFIGURED — aborting.');
    process.exit(2);
  }
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 7;

  const { data: listings } = await supabaseServer
    .from('listings')
    .select('*')
    .eq('is_active', true)
    .eq('seller_id', 4);

  // One listing per product (dedupe), capped at limit.
  const seen = new Set<number>();
  const picked = (listings || []).filter((l) => {
    if (seen.has(l.product_id)) return false;
    seen.add(l.product_id);
    return true;
  }).slice(0, limit);

  fs.mkdirSync(EXP_DIR, { recursive: true });
  const adapter = new NaverAdapter();
  const rows: Record<string, unknown>[] = [];

  for (const l of picked as Listing[]) {
    const { data: product } = await supabaseServer
      .from('products').select('name,brand,volume_ml').eq('id', l.product_id).single();
    try {
      const offer = await adapter.fetchOffer(l);
      const excluded = offer.matchExcluded === true || offer.salePrice === null;
      console.log(`\n[product ${l.product_id}] ${product?.brand} ${product?.name}`);
      console.log(`  matched mall : ${offer.matchedMallName ?? '(none)'}`);
      console.log(`  store (norm) : ${offer.storeName ?? '(none)'}`);
      console.log(`  price        : ${offer.salePrice ?? '(excluded)'}`);
      console.log(`  matched link : ${offer.matchedUrl ?? '(none)'}`);
      console.log(`  verdict      : ${excluded ? 'EXCLUDED — ' + offer.sourceText : 'MATCHED'}`);
      rows.push({
        product_id: l.product_id, brand: product?.brand, name: product?.name,
        db_volume_ml: product?.volume_ml,
        matched_mall_name: offer.matchedMallName ?? null, store_name: offer.storeName ?? null,
        price: offer.salePrice, matched_url: offer.matchedUrl ?? null,
        parsed_volume_raw: offer.parsedVolumeRaw ?? null,
        excluded, source_text: offer.sourceText,
      });
    } catch (e) {
      console.log(`\n[product ${l.product_id}] ERROR: ${e instanceof Error ? e.message : e}`);
      rows.push({ product_id: l.product_id, brand: product?.brand, name: product?.name, error: String(e) });
    }
    await sleep(1500); // polite spacing
  }

  fs.writeFileSync(path.join(EXP_DIR, 'naver-api.json'), JSON.stringify(rows, null, 2));
  const matched = rows.filter((r) => r.excluded === false).length;
  console.log(`\nSummary: ${matched}/${rows.length} matched to an official mall. Saved → expectations/naver-api.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
