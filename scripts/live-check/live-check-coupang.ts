/**
 * LIVE Coupang parse validation — NOT a CI test (needs real keys + network).
 * Run: npm run live-check:coupang  [-- --limit=3 --delay=5000]
 *
 * Flow per listing:
 *  1. Resolve link.coupang.com deeplink → www.coupang.com/vp/products/<id> (redirect, no quota)
 *  2. products/search by product name (corrected HMAC), filter productData by productId
 *  3. Save raw matched item → artifacts/coupang/<link_key>.json
 *  4. Run parseCoupangItem(rawItem) and compare to inferred ground truth
 *
 * Findings this script surfaces (see worklog):
 *  - HMAC datetime must be yyMMdd'T'HHmmss'Z' (current adapter strips T/Z → 401)
 *  - GET products/{id} endpoint does NOT exist (404) — no productId→price endpoint
 *  - search returns `productPrice` (not `price`), `isRocket`, `isFreeShipping`
 */
import 'dotenv/config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseServer } from '../../lib/supabase/server';
import { parseCoupangItem, CoupangApiItem } from '../../crawler/adapters/coupang';

const BASE = 'https://api-gateway.coupang.com';
const ART_DIR = path.join(__dirname, 'artifacts', 'coupang');
const EXP_DIR = path.join(__dirname, 'expectations');

function coupangDatetime(): string {
  const iso = new Date().toISOString();
  return (
    iso.substring(2, 4) + iso.substring(5, 7) + iso.substring(8, 10) +
    'T' + iso.substring(11, 13) + iso.substring(14, 16) + iso.substring(17, 19) + 'Z'
  );
}

function sign(method: string, p: string, query: string, accessKey: string, secretKey: string) {
  const datetime = coupangDatetime();
  const message = datetime + method.toUpperCase() + p + query;
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
}

async function searchProducts(keyword: string): Promise<Record<string, unknown>[]> {
  const accessKey = process.env.COUPANG_ACCESS_KEY!;
  const secretKey = process.env.COUPANG_SECRET_KEY!;
  const p = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/search';
  const query = `keyword=${encodeURIComponent(keyword)}&limit=10`;
  const auth = sign('GET', p, query, accessKey, secretKey);
  const res = await fetch(`${BASE}${p}?${query}`, {
    headers: { Authorization: auth, 'Content-Type': 'application/json;charset=UTF-8' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`search HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json?.data?.productData ?? [];
}

async function resolveProductId(deeplink: string): Promise<string | null> {
  try {
    const res = await fetch(deeplink, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const m = res.url.match(/\/vp\/products\/(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

interface ListingRow { id: number; link_key: string; url: string; product_id: number; }

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const delayArg = process.argv.find((a) => a.startsWith('--delay='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 3;
  const delay = delayArg ? parseInt(delayArg.split('=')[1], 10) : 5000;

  fs.mkdirSync(ART_DIR, { recursive: true });
  fs.mkdirSync(EXP_DIR, { recursive: true });

  const { data: listings } = await supabaseServer
    .from('listings')
    .select('id,link_key,url,product_id')
    .eq('is_active', true)
    .eq('seller_id', 3)
    .limit(50);

  // Distinct by resolved deeplink to avoid duplicate API calls
  const seenUrls = new Set<string>();
  const picked: ListingRow[] = [];
  for (const l of (listings as ListingRow[]) || []) {
    if (seenUrls.has(l.url)) continue;
    seenUrls.add(l.url);
    picked.push(l);
    if (picked.length >= limit) break;
  }

  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < picked.length; i++) {
    const l = picked[i];
    const { data: product } = await supabaseServer
      .from('products').select('product_key,name,brand,volume_ml').eq('id', l.product_id).single();

    console.log(`\n=== [${i + 1}/${picked.length}] ${l.link_key} (${product?.name}) ===`);
    const productId = await resolveProductId(l.url);
    console.log(`  deeplink → productId: ${productId}`);

    if (!productId) {
      results.push({ link_key: l.link_key, error: 'productId not resolvable from deeplink' });
      continue;
    }

    if (i > 0) await new Promise((r) => setTimeout(r, delay));

    let productData: Record<string, unknown>[] = [];
    try {
      productData = await searchProducts(`${product?.brand ?? ''} ${product?.name ?? ''}`.trim());
    } catch (e) {
      console.error('  search error:', e instanceof Error ? e.message : e);
      results.push({ link_key: l.link_key, productId, error: 'search failed' });
      continue;
    }

    const match = productData.find((pd) => String(pd.productId) === productId) ?? null;
    console.log(`  search results: ${productData.length}, exact productId match: ${match ? 'YES' : 'NO'}`);

    const rawItem = match ?? productData[0] ?? null;
    if (!rawItem) {
      results.push({ link_key: l.link_key, productId, error: 'no search results' });
      continue;
    }

    // Save raw artifact (price/promo/volume fields only — strip image blobs and
    // affiliate URLs which carry partner tokens/traceids)
    const slim = { ...rawItem };
    delete (slim as Record<string, unknown>).productImage;
    delete (slim as Record<string, unknown>).productUrl;
    fs.writeFileSync(path.join(ART_DIR, `${l.link_key}.json`), JSON.stringify(slim, null, 2));

    // Run CURRENT parser against the REAL response object (as-is)
    const offer = parseCoupangItem(rawItem as unknown as CoupangApiItem);

    console.log('  REAL fields:', JSON.stringify({
      productId: rawItem.productId, productName: rawItem.productName,
      productPrice: rawItem.productPrice, isRocket: rawItem.isRocket, isFreeShipping: rawItem.isFreeShipping,
    }));
    console.log('  parseCoupangItem →', JSON.stringify({
      salePrice: offer.salePrice, regularPrice: offer.regularPrice, inStock: offer.inStock,
      promoType: offer.promoType, shippingNote: offer.shippingNote, parsedVolumeRaw: offer.parsedVolumeRaw,
    }));

    results.push({
      link_key: l.link_key,
      product_db: { name: product?.name, volume_ml: product?.volume_ml },
      productId,
      exact_match: !!match,
      real: {
        productName: rawItem.productName, productPrice: rawItem.productPrice,
        isRocket: rawItem.isRocket, isFreeShipping: rawItem.isFreeShipping,
      },
      parser_output: {
        salePrice: offer.salePrice, regularPrice: offer.regularPrice, inStock: offer.inStock,
        promoType: offer.promoType, shippingNote: offer.shippingNote, parsedVolumeRaw: offer.parsedVolumeRaw,
      },
    });
  }

  fs.writeFileSync(path.join(EXP_DIR, 'coupang.json'), JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} results → expectations/coupang.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
