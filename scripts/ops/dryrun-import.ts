/**
 * Phase D dry-run diff (READ-ONLY) — what `sheets:import` WOULD do.
 *
 * Compares the live cleaned sheet against the current remote DB and reports:
 *   ① products that would be deactivated (DB active, key not in sheet) + reason
 *   ② link cells with no real URL (placeholder) + duplicate url/key validation
 *   ③ planned upsert / deactivation counts (products + listings)
 * Performs ONLY selects + a sheet read. Never writes.
 *
 * Run: npm run ops:dryrun-import
 */
import { google } from 'googleapis';
import { supabaseServer, isSupabaseServerConfigured } from '../../lib/supabase/server';
import * as v from '../../crawler/sheets/validate';

const SELLERS = ['oliveyoung', 'coupang', 'naver', 'zigzag', 'ably'] as const;

async function fetchSheet(spreadsheetId: string, range: string): Promise<Record<string, string>[]> {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];
  const headers = rows[0].map((h: string) => h.trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}

const norm = (s: string) => (s ?? '').toLowerCase().replace(/\s+/g, '');

async function main() {
  if (!isSupabaseServerConfigured()) { console.error('Supabase not configured.'); process.exit(1); }
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  console.log('=== Phase D dry-run diff (READ-ONLY, no writes) ===');
  console.log('time:', new Date().toISOString());

  // ── Sheet side ──────────────────────────────────────────────────────────────
  const [rawProducts, rawLinks] = await Promise.all([
    fetchSheet(id, 'products!A:Z'),
    fetchSheet(id, 'product_links!A:Z'),
  ]);
  const nameToKey = v.buildNameToKey(rawProducts);
  const flat = v.expandListings(rawLinks, nameToKey);
  const sheetProductKeys = new Set(nameToKey.values());
  const sheetLinkKeys = new Set(flat.map((l) => l.link_key));
  // normalized sheet name/brand sets (to explain re-keyed vs removed). The old
  // DB rows bake the brand into the name, so match on brand too.
  const sheetNameToKey = new Map<string, string>();
  for (const [name, key] of nameToKey) sheetNameToKey.set(norm(name), key);
  const sheetBrands = new Map<string, string[]>(); // normBrand → sheet product names
  for (const row of rawProducts) {
    const p = v.simpleProductRowSchema.safeParse(row);
    if (!p.success) continue;
    const b = norm(p.data.brand);
    if (!b) continue;
    if (!sheetBrands.has(b)) sheetBrands.set(b, []);
    sheetBrands.get(b)!.push(p.data.name);
  }

  // ── DB side ─────────────────────────────────────────────────────────────────
  const { data: dbProducts } = await supabaseServer.from('products').select('id, product_key, name, brand, is_active');
  const { data: dbListings } = await supabaseServer.from('listings').select('id, link_key, url, is_active');
  const dbLinkKeys = new Set((dbListings ?? []).map((l) => l.link_key));

  // ── ① products that would be deactivated ────────────────────────────────────
  console.log('\n--- ① products to DEACTIVATE (active in DB, key not in sheet) ---');
  const orphanProducts = (dbProducts ?? []).filter((p) => p.is_active && !sheetProductKeys.has(p.product_key));
  if (!orphanProducts.length) console.log('  (none)');
  for (const p of orphanProducts) {
    const sameNameKey = sheetNameToKey.get(norm(p.name));
    const brandHits = sheetBrands.get(norm(p.brand ?? ''));
    let reason: string;
    if (sameNameKey) {
      reason = `re-keyed duplicate — same name in sheet under key "${sameNameKey}"`;
    } else if (brandHits && brandHits.length) {
      reason = `re-keyed duplicate — brand in cleaned sheet as: ${brandHits.join(' ; ')} (old key scheme bakes brand into name)`;
    } else {
      reason = 'INTENTIONAL REMOVAL — brand not present in cleaned sheet';
    }
    console.log(`  id=${p.id}  key=${p.product_key}  [${p.brand ?? ''}] ${p.name}\n     reason: ${reason}`);
  }

  // ── ② placeholder link cells + duplicate validation ─────────────────────────
  console.log('\n--- ② link cells with NO real URL (non-empty, not http...) ---');
  let placeholderCount = 0;
  for (const row of rawLinks) {
    const r = v.productLinksWideRowSchema.safeParse(row);
    if (!r.success) continue;
    for (const seller of SELLERS) {
      const val = (r.data[seller] ?? '').trim();
      if (val && !/^https?:\/\//i.test(val)) {
        console.log(`  "${r.data.product_name}" / ${seller}: "${val}"`);
        placeholderCount++;
      }
    }
  }
  if (!placeholderCount) console.log('  (none)');

  console.log('\n--- ② duplicate url/key validation (expect 0) ---');
  const dup = v.detectSheetDuplicates(rawProducts, rawLinks);
  console.log(`  duplicate product_key groups: ${dup.duplicateProductKeys.length}`);
  console.log(`  duplicate link_key groups:    ${dup.duplicateLinkKeys.length}`);
  console.log(`  duplicate url groups:         ${dup.duplicateUrls.length}`);
  if (v.hasDuplicates(dup)) console.log(v.formatDuplicateReport(dup));

  // ── ③ planned counts ─────────────────────────────────────────────────────────
  const listingInserts = flat.filter((l) => !dbLinkKeys.has(l.link_key)).length;
  const listingUpdates = flat.length - listingInserts;
  const orphanListings = (dbListings ?? []).filter((l) => l.is_active && !sheetLinkKeys.has(l.link_key)).length;

  console.log('\n--- ③ planned counts ---');
  console.log(`  products:  upsert ${rawProducts.length}  | deactivate ${orphanProducts.length}`);
  console.log(`  listings:  upsert ${flat.length} (insert ${listingInserts} / update ${listingUpdates})  | deactivate ${orphanListings}`);
  console.log(`  DB now:    products(active)=${(dbProducts ?? []).filter((p) => p.is_active).length}  listings(active)=${(dbListings ?? []).filter((l) => l.is_active).length}`);

  console.log('\n=== dry-run complete (no writes performed) ===');
}

main().catch((e) => { console.error('dry-run failed:', e); process.exit(1); });
