/**
 * Logical data backup (READ-ONLY) via the service-role key / PostgREST.
 *
 * Used as the pre-rollout safety net when pg_dump / supabase db dump (Docker)
 * are unavailable. Dumps every known public table to backups/<ts>/<table>.json
 * plus a manifest of row counts. Restores are row-level (re-insert from JSON);
 * schema is reconstructable from supabase/migrations/.
 *
 * Run: npm run ops:backup
 */
import { writeFileSync, mkdirSync } from 'fs';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';

const TABLES = [
  'categories', 'sellers', 'products', 'listings', 'badges', 'product_badges',
  'price_snapshots', 'current_prices', 'retailer_allowlist', 'manual_overrides',
  'seo_pages', 'sheet_import_runs', 'crawl_runs', 'crawl_errors',
];

async function main() {
  if (!isSupabaseServerConfigured()) { console.error('Supabase not configured. Aborting.'); process.exit(1); }
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = `backups/${ts}`;
  mkdirSync(dir, { recursive: true });
  console.log(`[backup] writing to ${dir}`);

  const manifest: { table: string; rows: number | null; note?: string }[] = [];
  for (const table of TABLES) {
    const { data, error } = await supabaseServer.from(table).select('*');
    if (error) {
      console.log(`  ${table.padEnd(18)} SKIP (${error.message})`);
      manifest.push({ table, rows: null, note: error.message });
      continue;
    }
    writeFileSync(`${dir}/${table}.json`, JSON.stringify(data ?? [], null, 2));
    console.log(`  ${table.padEnd(18)} ${data?.length ?? 0} rows`);
    manifest.push({ table, rows: data?.length ?? 0 });
  }
  writeFileSync(`${dir}/_manifest.json`, JSON.stringify({ takenAt: new Date().toISOString(), manifest }, null, 2));
  console.log(`[backup] done. manifest: ${dir}/_manifest.json`);
}

main().catch((e) => { console.error('backup failed:', e); process.exit(1); });
