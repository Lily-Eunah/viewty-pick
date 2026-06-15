/**
 * LIVE OliveYoung-via-Naver coverage check — NOT a CI test (needs network + keys).
 * Run: npm run live-check:oliveyoung [-- --limit=10]
 *
 * Read-only. Drives the real OliveYoungAdapter (which reads OliveYoung offers
 * from the approved Naver Shopping Search API — no oliveyoung.co.kr request) for
 * the active OliveYoung listings (curator affiliate_url present) and reports:
 *   - the exact Naver mallName OliveYoung surfaces under (confirm allowlist §4)
 *   - matched price / link, or excluded (no Naver OliveYoung offer)
 *   - coverage = curator-URL products with a Naver OliveYoung offer (tier 2)
 *     vs. the gap (tier 3 manual / tier 4 link-only candidates)
 * Secrets / PII are not committed; output is written under expectations/.
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseServer, isSupabaseServerConfigured } from '../../lib/supabase/server';
import { OliveYoungAdapter } from '../../crawler/adapters/oliveyoung';
import { Listing } from '../../lib/types';

const EXP_DIR = path.join(__dirname, 'expectations');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!isSupabaseServerConfigured()) {
    console.log('SUPABASE NOT CONFIGURED — aborting.');
    process.exit(2);
  }
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 10;

  const { data: oySeller } = await supabaseServer.from('sellers').select('id').eq('slug', 'oliveyoung').single();
  if (!oySeller) {
    console.log('oliveyoung seller not found — aborting.');
    process.exit(2);
  }

  const { data: listings } = await supabaseServer
    .from('listings')
    .select('*')
    .eq('is_active', true)
    .eq('seller_id', oySeller.id);

  // Curator gate: only listings with an affiliate_url, one per product, capped.
  const seen = new Set<number>();
  const picked = (listings || [])
    .filter((l) => l.affiliate_url)
    .filter((l) => {
      if (seen.has(l.product_id)) return false;
      seen.add(l.product_id);
      return true;
    })
    .slice(0, limit);

  fs.mkdirSync(EXP_DIR, { recursive: true });
  const adapter = new OliveYoungAdapter();
  const rows: Record<string, unknown>[] = [];

  for (const l of picked as Listing[]) {
    const { data: product } = await supabaseServer
      .from('products').select('name,brand,volume_ml').eq('id', l.product_id).single();
    try {
      const offer = await adapter.fetchOffer(l);
      const excluded = offer.matchExcluded === true || offer.salePrice === null;
      console.log(`\n[product ${l.product_id}] ${product?.brand} ${product?.name}`);
      console.log(`  matched mall : ${offer.matchedMallName ?? '(none)'}`);
      console.log(`  price        : ${offer.salePrice ?? '(no Naver offer)'}`);
      console.log(`  matched link : ${offer.matchedUrl ?? '(none)'}`);
      console.log(`  curator link : ${l.affiliate_url}`);
      console.log(`  tier         : ${excluded ? '3/4 (gap — manual or link-only)' : '2 (Naver offer)'}`);
      rows.push({
        product_id: l.product_id, brand: product?.brand, name: product?.name,
        db_volume_ml: product?.volume_ml,
        matched_mall_name: offer.matchedMallName ?? null,
        price: offer.salePrice, matched_url: offer.matchedUrl ?? null,
        curator_url: l.affiliate_url,
        parsed_volume_raw: offer.parsedVolumeRaw ?? null,
        excluded, tier: excluded ? 'gap' : 'naver', source_text: offer.sourceText,
      });
    } catch (e) {
      console.log(`\n[product ${l.product_id}] ERROR: ${e instanceof Error ? e.message : e}`);
      rows.push({ product_id: l.product_id, brand: product?.brand, name: product?.name, error: String(e) });
    }
    await sleep(1500); // polite spacing
  }

  fs.writeFileSync(path.join(EXP_DIR, 'oliveyoung-via-naver.json'), JSON.stringify(rows, null, 2));
  const matched = rows.filter((r) => r.excluded === false).length;
  const malls = Array.from(new Set(rows.map((r) => r.matched_mall_name).filter(Boolean)));
  console.log(`\nCoverage: ${matched}/${rows.length} curator-URL products have a Naver OliveYoung offer (tier 2).`);
  console.log(`Gap (tier 3/4): ${rows.length - matched}. Observed mallName(s): ${malls.join(', ') || '(none)'}`);
  console.log('Saved → expectations/oliveyoung-via-naver.json');
}
main().catch((e) => { console.error(e); process.exit(1); });
