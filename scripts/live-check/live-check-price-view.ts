/**
 * LIVE verification of the public price view (migration 0008) — NOT a CI test
 * (needs network + remote keys). Run: npm run live-check:price-view
 *
 * Asserts the option-C contract against the REMOTE Supabase:
 *   1. anon SELECT on listing_prices_public → returns rows (priced listings).
 *   2. anon SELECT on raw price_snapshots → still 0 rows (RLS unchanged).
 *   3. view exposes ONLY the safe column set (no source_text/status/etc.).
 *   4. one row per listing (latest), and unit_price is NULL where unreliable.
 *
 * Exit code 0 = all checks passed, 1 = a check failed, 2 = not configured.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SAFE_COLUMNS = new Set([
  'listing_id', 'product_id', 'seller_id', 'sale_price', 'base_unit_price',
  'effective_unit_price', 'unit_price', 'promo_type', 'promo_text', 'in_stock',
  'shipping_note', 'matched_mall_name', 'crawled_at',
]);
// Internal columns that must NEVER appear in the public view projection.
const FORBIDDEN_COLUMNS = [
  'source_text', 'status', 'parse_confidence', 'regular_price', 'shipping_fee',
  'matched_url', 'id', 'unit_price_reliable', 'total_ml', 'total_quantity',
];

let failures = 0;
function check(ok: boolean, label: string, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

async function main() {
  if (!url || !anonKey || !serviceKey) {
    console.log('SUPABASE NOT CONFIGURED (need URL + anon + service-role keys) — aborting.');
    process.exit(2);
  }

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  console.log('\n[1] anon read of public view');
  const viewRes = await anon.from('listing_prices_public').select('*');
  check(!viewRes.error, 'anon SELECT listing_prices_public succeeds', viewRes.error?.message);
  const rows = viewRes.data || [];
  check(rows.length > 0, 'view returns priced rows', `${rows.length} rows`);

  console.log('\n[2] anon is still locked out of raw price_snapshots');
  const rawRes = await anon.from('price_snapshots').select('*');
  // Either an RLS error or an empty set both satisfy "anon sees nothing".
  const rawCount = rawRes.data?.length ?? 0;
  check(rawCount === 0, 'anon sees 0 raw price_snapshots', rawRes.error ? `blocked: ${rawRes.error.message}` : `${rawCount} rows`);

  console.log('\n[3] safe-column projection (no internal fields leak)');
  if (rows.length > 0) {
    const keys = Object.keys(rows[0]);
    const leaked = keys.filter((k) => FORBIDDEN_COLUMNS.includes(k));
    const unexpected = keys.filter((k) => !SAFE_COLUMNS.has(k));
    check(leaked.length === 0, 'no forbidden internal columns', leaked.length ? leaked.join(', ') : 'none');
    check(unexpected.length === 0, 'only the documented safe columns', unexpected.length ? unexpected.join(', ') : 'none');
  } else {
    check(false, 'cannot inspect columns (no rows)');
  }

  console.log('\n[4] latest-per-listing + unit_price reliability');
  const seen = new Set<number>();
  let dupes = 0;
  for (const r of rows as { listing_id: number }[]) {
    if (seen.has(r.listing_id)) dupes++;
    seen.add(r.listing_id);
  }
  check(dupes === 0, 'one row per listing', dupes ? `${dupes} duplicate listing_id` : 'unique');

  // Cross-check unit_price NULLing against the raw flag via service role.
  const svc = createClient(url, serviceKey, { auth: { persistSession: false } });
  const unreliable = (rows as { listing_id: number; unit_price: number | null }[]).filter(
    (r) => r.unit_price !== null
  );
  let badUnit = 0;
  for (const r of unreliable.slice(0, 50)) {
    const { data } = await svc
      .from('price_snapshots')
      .select('unit_price_reliable')
      .eq('listing_id', r.listing_id)
      .order('crawled_at', { ascending: false })
      .limit(1)
      .single();
    if (data && data.unit_price_reliable === false) badUnit++;
  }
  check(badUnit === 0, 'no unreliable unit_price exposed', badUnit ? `${badUnit} leaked` : 'clean');

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
