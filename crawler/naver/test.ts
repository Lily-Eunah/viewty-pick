import { loadMockDB, saveMockDB } from '../../lib/supabase/mockDb';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { Listing, Product, RetailerAllowlist, PriceSnapshot } from '../../lib/types';
import { NaverAdapter } from '../adapters/naver';
import { normalizePrice } from '../core/normalize';
import { runHealthCheck } from '../core/healthcheck';
import * as dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  console.log('=== Naver Open API Price Adapter Limited Live Test ===');

  // Step 2 check: verify env presence without printing values
  const hasClientId = !!process.env.NAVER_CLIENT_ID;
  const hasClientSecret = !!process.env.NAVER_CLIENT_SECRET;
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Environment variable checks:');
  console.log(` - NAVER_CLIENT_ID: ${hasClientId ? 'PRESENT' : 'MISSING'}`);
  console.log(` - NAVER_CLIENT_SECRET: ${hasClientSecret ? 'PRESENT' : 'MISSING'}`);
  console.log(` - NEXT_PUBLIC_SUPABASE_URL: ${hasSupabaseUrl ? 'PRESENT' : 'MISSING'}`);
  console.log(` - SUPABASE_SERVICE_ROLE_KEY: ${hasServiceRoleKey ? 'PRESENT' : 'MISSING'}`);

  if (!hasClientId || !hasClientSecret) {
    console.error('CRITICAL: Naver API credentials are missing in env. Stopping.');
    process.exit(1);
  }

  // Parse command line arguments
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 3;

  const writeMode = process.argv.includes('--write');
  const dryRun = !writeMode || process.argv.includes('--dry-run');

  console.log(`Configuration: limit=${limit}, mode=${dryRun ? 'DRY-RUN' : 'WRITE'}`);

  // Load data
  const useSupabase = isSupabaseServerConfigured();
  console.log(`Database source: ${useSupabase ? 'Supabase Server' : 'Local Mock DB'}`);

  let listings: Listing[] = [];
  let products: Product[] = [];
  let allowlist: RetailerAllowlist[] = [];
  let previousSnapshots: PriceSnapshot[] = [];

  let naverSellerId = 3;

  if (useSupabase) {
    console.log('Loading active listings and metadata from Supabase...');
    const { data: sData } = await supabaseServer.from('sellers').select('id').eq('slug', 'naver').single();
    if (sData) naverSellerId = sData.id;

    const { data: lData } = await supabaseServer.from('listings').select('*').eq('seller_id', naverSellerId).eq('is_active', true);
    listings = lData || [];
    const { data: pData } = await supabaseServer.from('products').select('*').eq('is_active', true);
    products = pData || [];
    const { data: alData } = await supabaseServer.from('retailer_allowlist').select('*').eq('is_active', true);
    allowlist = alData || [];
    const { data: snapData } = await supabaseServer.from('price_snapshots').select('*').order('crawled_at', { ascending: false });
    previousSnapshots = snapData || [];
  } else {
    console.log('Loading active listings and metadata from Local Mock DB...');
    const db = loadMockDB();
    const seller = db.sellers.find(s => s.slug === 'naver');
    if (seller) naverSellerId = seller.id;

    listings = db.listings.filter(l => l.seller_id === naverSellerId && l.is_active);
    products = db.products.filter(p => p.is_active);
    allowlist = db.retailer_allowlist.filter(al => al.is_active);
    previousSnapshots = db.price_snapshots;
  }

  const activeNaverListings = listings.slice(0, limit);
  console.log(`Found ${listings.length} active Naver listings. Will test ${activeNaverListings.length}.`);

  const adapter = new NaverAdapter();
  const successfulSnapshots: PriceSnapshot[] = [];

  let apiCallsCount = 0;

  for (const listing of activeNaverListings) {
    const product = products.find(p => p.id === listing.product_id);
    if (!product) {
      console.warn(`[Listing ID ${listing.id}] Warning: Product not found in database. Skipping.`);
      continue;
    }

    console.log(`\n--------------------------------------------------`);
    console.log(`Testing Listing ID: ${listing.id} | Slug: ${product.slug}`);

    try {
      apiCallsCount++;
      // Call Naver Open API price adapter
      const offer = await adapter.fetchOffer(listing);

      // Normalize raw prices
      const normalized = normalizePrice(product, offer);

      // Historic snapshots comparison
      const prevSnap = previousSnapshots.find((s) => s.listing_id === listing.id) || null;

      // Healthcheck validation
      const check = runHealthCheck(product, listing, offer, normalized, prevSnap, allowlist);

      // Logs as required:
      // - listing id or product slug
      // - query string (the query cleaned version we generate from brand and name)
      const cleanNameQuery = `${product.brand || ''} ${product.name}`.trim();
      console.log(` - Query string: "${cleanNameQuery}"`);
      console.log(` - Selected mall/store name: "${offer.storeName}"`);
      console.log(` - Selected base price: ${offer.salePrice}원`);
      
      const isAllowed = check.status !== 'failed' || !check.message?.includes('allowlist');
      console.log(` - Allowlist matched: ${isAllowed ? 'YES' : 'NO'}`);
      console.log(` - Healthcheck status: ${check.status} (Details: ${check.message || 'PASSED'})`);
      console.log(` - Normalized snapshot preview:`, {
        regular_price: normalized.regular_price,
        sale_price: normalized.sale_price,
        base_unit_price: normalized.base_unit_price,
        effective_unit_price: normalized.effective_unit_price,
        unit_price: normalized.unit_price,
        in_stock: normalized.in_stock,
        status: check.status,
      });

      if (check.status === 'failed') {
        console.error(`[Test failure] Listing failed health checks: ${check.message}`);
      } else {
        const snapshotId = useSupabase ? 0 : previousSnapshots.length + successfulSnapshots.length + 1;
        const snapshot: PriceSnapshot = {
          id: snapshotId,
          listing_id: listing.id,
          product_id: product.id,
          crawled_at: new Date().toISOString(),
          regular_price: normalized.regular_price,
          sale_price: normalized.sale_price,
          base_unit_price: normalized.base_unit_price,
          effective_unit_price: normalized.effective_unit_price,
          unit_price: normalized.unit_price,
          unit_price_reliable: normalized.unit_price_reliable,
          promo_type: normalized.promo_type,
          promo_text: normalized.promo_text,
          min_quantity: normalized.min_quantity,
          paid_quantity: normalized.paid_quantity,
          free_quantity: normalized.free_quantity,
          total_quantity: normalized.total_quantity,
          total_ml: normalized.total_ml,
          in_stock: normalized.in_stock,
          source_text: offer.sourceText,
          parse_confidence: normalized.parse_confidence,
          status: check.status,
          shipping_fee: null,
          shipping_note: normalized.shipping_note,
        };
        successfulSnapshots.push(snapshot);
      }

    } catch (err: unknown) {
      console.error(`[Error] Test failed for listing ${listing.id}:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`\n======================================`);
  console.log(`Test Summary:`);
  console.log(` - Naver API calls made: ${apiCallsCount}`);
  console.log(` - Successful snapshots collected: ${successfulSnapshots.length}`);

  if (successfulSnapshots.length > 0 && !dryRun) {
    console.log(`Writing ${successfulSnapshots.length} snapshots to the database...`);
    if (useSupabase) {
      const snapsToInsert = successfulSnapshots.map((s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...rest } = s;
        return rest;
      });
      const { error } = await supabaseServer.from('price_snapshots').insert(snapsToInsert);
      if (error) {
        console.error('Supabase write error:', error);
      } else {
        console.log('Successfully wrote snapshots to Supabase.');
      }
    } else {
      const db = loadMockDB();
      db.price_snapshots.push(...successfulSnapshots);
      saveMockDB(db);
      console.log('Successfully wrote snapshots to Local Mock DB file.');
    }
  } else {
    console.log('Dry-run mode active. No database writes occurred.');
  }

  console.log('======================================');
}

runTest().catch(err => {
  console.error('Critical test error:', err);
  process.exit(1);
});
