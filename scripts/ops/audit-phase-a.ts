/**
 * Phase A — pre-rollout audit (READ-ONLY, zero writes).
 *
 * Captures current remote state before the ops-data-rollout: row counts,
 * duplicate maps (listings by url, products by product_key, suspected
 * same-product different id), and a best-effort migration-gap probe for
 * 0006/0007. Performs ONLY selects — never writes.
 *
 * Run: npm run ops:audit
 */
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';

async function count(table: string): Promise<number | string> {
  const { count, error } = await supabaseServer.from(table).select('*', { count: 'exact', head: true });
  if (error) return `ERR(${error.message})`;
  return count ?? 0;
}

function groupDupes<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
}

async function probeColumn(table: string, column: string): Promise<'present' | 'missing' | string> {
  const { error } = await supabaseServer.from(table).select(column).limit(1);
  if (!error) return 'present';
  if (/column .* does not exist|could not find/i.test(error.message)) return 'missing';
  return `inconclusive(${error.message})`;
}

async function main() {
  if (!isSupabaseServerConfigured()) {
    console.error('Supabase not configured (placeholder env). Aborting audit.');
    process.exit(1);
  }
  console.log('=== Phase A audit (READ-ONLY) ===');
  console.log('time:', new Date().toISOString());

  // ── Row counts ─────────────────────────────────────────────────────────────
  console.log('\n--- row counts ---');
  for (const t of ['products', 'listings', 'badges', 'product_badges', 'price_snapshots', 'current_prices']) {
    console.log(`  ${t.padEnd(16)} ${await count(t)}`);
  }

  // ── Active counts ──────────────────────────────────────────────────────────
  const { count: activeProducts } = await supabaseServer.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true);
  const { count: activeListings } = await supabaseServer.from('listings').select('*', { count: 'exact', head: true }).eq('is_active', true);
  console.log(`  products(active)  ${activeProducts ?? '?'}`);
  console.log(`  listings(active)  ${activeListings ?? '?'}`);

  // ── Duplicate maps ───────────────────────────────────────────────────────────
  console.log('\n--- duplicate map: active listings by url (count>1) ---');
  const { data: listings, error: lErr } = await supabaseServer
    .from('listings').select('id, link_key, url, product_id, is_active').eq('is_active', true);
  if (lErr) { console.log('  ERR', lErr.message); }
  else {
    const dupeUrls = groupDupes(listings ?? [], (l) => l.url);
    if (!dupeUrls.length) console.log('  (none)');
    for (const [url, c] of dupeUrls) console.log(`  ${c}×  ${url}`);
    const dupeLinkKeys = groupDupes(listings ?? [], (l) => l.link_key);
    console.log('\n--- duplicate map: active listings by link_key (count>1) ---');
    if (!dupeLinkKeys.length) console.log('  (none)');
    for (const [k, c] of dupeLinkKeys) console.log(`  ${c}×  ${k}`);
  }

  console.log('\n--- duplicate map: products by product_key (count>1) ---');
  const { data: products, error: pErr } = await supabaseServer
    .from('products').select('id, product_key, slug, name, brand, is_active');
  if (pErr) { console.log('  ERR', pErr.message); }
  else {
    const dupeKeys = groupDupes(products ?? [], (p) => p.product_key);
    if (!dupeKeys.length) console.log('  (none)');
    for (const [k, c] of dupeKeys) console.log(`  ${c}×  ${k}`);

    console.log('\n--- suspected same product, different id (by normalized name) ---');
    const norm = (s: string) => (s ?? '').toLowerCase().replace(/\s+/g, '');
    const byName = groupDupes(products ?? [], (p) => norm(p.name));
    if (!byName.length) console.log('  (none)');
    for (const [n, c] of byName) {
      const ids = (products ?? []).filter((p) => norm(p.name) === n).map((p) => `${p.id}:${p.product_key}`);
      console.log(`  ${c}×  "${n}"  → ${ids.join(', ')}`);
    }
  }

  // ── Migration gap probe (best-effort, read-only) ────────────────────────────
  console.log('\n--- migration probe (0006/0007) ---');
  console.log(`  price_snapshots.matched_url        : ${await probeColumn('price_snapshots', 'matched_url')}`);
  console.log(`  price_snapshots.matched_mall_name  : ${await probeColumn('price_snapshots', 'matched_mall_name')}`);
  console.log(`  listings.latest_matched_url        : ${await probeColumn('listings', 'latest_matched_url')}`);
  const { data: naverSourced } = await supabaseServer.from('listings').select('id').eq('crawl_method', 'naver_sourced').limit(1);
  console.log(`  listings with crawl_method=naver_sourced present: ${naverSourced && naverSourced.length ? 'yes (0007 likely applied)' : 'none (0007 not verifiable read-only)'}`);

  console.log('\n=== audit complete (no writes performed) ===');
}

main().catch((e) => { console.error('audit failed:', e); process.exit(1); });
