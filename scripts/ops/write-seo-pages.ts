// Writes the generated SEO-page rows into the Google Sheet `seo_pages` tab.
//
//   npx tsx -r dotenv/config scripts/ops/write-seo-pages.ts          # dry-run (prints grid)
//   npx tsx -r dotenv/config scripts/ops/write-seo-pages.ts --apply  # actually writes
//
// Behaviour:
//   - Header row gets `keywords` appended after `is_active` (matches setup_headers).
//   - Every SEO_PAGE_SPECS row is written, is_active = (matched products >= 4).
//   - The operator's original bare-title brainstorm rows (no slug) are preserved
//     verbatim as a backlog block below — nothing is lost; the importer ignores
//     slug-less rows.
//   - Then the tab is cleared and rewritten, and read back for verification.

import { google } from 'googleapis';
import { isSupabaseConfigured, supabase } from '../../lib/supabase/client';
import { buildAllUIProducts, RawData, snapshotsToPublicPrices } from '../../lib/queries';
import { loadMockDB } from '../../lib/supabase/mockDb';
import { matchSeoProducts, MIN_SEO_PRODUCTS } from '../../lib/seo/match';
import { SEO_PAGE_SPECS } from '../../lib/seo/specs';

const HEADER = ['slug', 'page_type', 'title', 'h1', 'description', 'category', 'skin_type', 'badge_type', 'is_active', 'keywords'];
const TITLE_COL = 2; // 0-based index of `title` in HEADER

function auth(scopes: string[]) {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  return new google.auth.GoogleAuth({ credentials: creds, scopes });
}

// Fetch raw product data without Next.js unstable_cache (safe for script context).
async function fetchRaw(): Promise<RawData> {
  if (isSupabaseConfigured()) {
    const [pRes, lRes, cRes, pbRes, bRes, sRes, lpRes] = await Promise.all([
      supabase.from('products').select('*').eq('is_active', true),
      supabase.from('listings').select('*').eq('is_active', true),
      supabase.from('categories').select('*'),
      supabase.from('product_badges').select('*'),
      supabase.from('badges').select('*'),
      supabase.from('sellers').select('id, slug, name, is_price_comparison_enabled'),
      supabase.from('listing_prices_public').select('*'),
    ]);
    if (!pRes.error && pRes.data) {
      return {
        dbProducts: pRes.data,
        dbListings: lRes.data || [],
        dbCategories: cRes.data || [],
        dbProductBadges: pbRes.data || [],
        dbBadges: bRes.data || [],
        dbListingPrices: lpRes.data || [],
        dbSellers: sRes.data || [],
      };
    }
  }
  const db = loadMockDB();
  const dbListings = db.listings.filter((l) => l.is_active);
  return {
    dbProducts: db.products.filter((p) => p.is_active),
    dbListings,
    dbCategories: db.categories,
    dbProductBadges: db.product_badges,
    dbBadges: db.badges,
    dbListingPrices: snapshotsToPublicPrices(db.price_snapshots, dbListings),
    dbSellers: db.sellers,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  if (!spreadsheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('Google Sheets env not configured');

  const sheetsRO = google.sheets({ version: 'v4', auth: auth(['https://www.googleapis.com/auth/spreadsheets.readonly']) });

  // 1. Current sheet — capture the operator's brainstorm titles (slug-less rows) as backlog.
  const cur = await sheetsRO.spreadsheets.values.get({ spreadsheetId, range: 'seo_pages!A:Z' });
  const rows = cur.data.values ?? [];
  const dataRows = rows.slice(1); // drop header
  const backlogTitles: string[] = [];
  for (const r of dataRows) {
    const slug = (r[0] ?? '').toString().trim();
    const title = (r[TITLE_COL] ?? '').toString().trim();
    if (!slug && title) backlogTitles.push(title); // brainstorm-only row → keep as backlog
  }

  // 2. Resolve is_active from live product counts (the same gate the route enforces).
  const raw = await fetchRaw();
  const products = buildAllUIProducts(raw);
  const specRows = SEO_PAGE_SPECS.map((s) => {
    const n = matchSeoProducts(products, { category: s.category, skinType: s.skin_type, badge: s.badge_type, keywords: s.keywords, seller: s.seller }).length;
    const active = n >= MIN_SEO_PRODUCTS;
    return {
      n,
      active,
      cells: [s.slug, s.page_type, s.title, s.h1, s.description, s.category ?? '', s.skin_type ?? '', s.badge_type ?? '', active ? 'true' : 'false', s.keywords ?? ''],
    };
  });

  const activeCount = specRows.filter((r) => r.active).length;

  // 3. Build the new grid: header + structured rows + blank + marker + backlog.
  const grid: string[][] = [HEADER];
  for (const r of specRows) grid.push(r.cells);
  grid.push([]);
  grid.push(['', '', '── 백로그 (4개 미만/미생성 주제, slug 없음 → import 제외) ──']);
  for (const t of backlogTitles) grid.push(['', '', t]);

  console.log(`Structured rows: ${specRows.length} (active ${activeCount}, inactive ${specRows.length - activeCount})`);
  console.log(`Backlog titles preserved: ${backlogTitles.length}`);
  console.log('Inactive (<4):', specRows.filter((r) => !r.active).map((r) => `${r.cells[0]}(${r.n})`).join(', ') || 'none');

  if (!apply) {
    console.log('\n[DRY-RUN] pass --apply to write. First 8 structured rows:');
    for (const r of specRows.slice(0, 8)) console.log(`  ${r.cells[0].padEnd(30)} active=${r.active} n=${r.n}`);
    return;
  }

  // 4. Clear + write + read back.
  const sheetsRW = google.sheets({ version: 'v4', auth: auth(['https://www.googleapis.com/auth/spreadsheets']) });
  await sheetsRW.spreadsheets.values.clear({ spreadsheetId, range: 'seo_pages!A:Z' });
  await sheetsRW.spreadsheets.values.update({
    spreadsheetId,
    range: 'seo_pages!A1',
    valueInputOption: 'RAW',
    requestBody: { values: grid },
  });
  const back = await sheetsRO.spreadsheets.values.get({ spreadsheetId, range: 'seo_pages!A:Z' });
  const wrote = back.data.values ?? [];
  console.log(`\n✅ Wrote seo_pages: ${wrote.length} rows total (header + ${specRows.length} structured + blank + marker + ${backlogTitles.length} backlog).`);
  console.log('Header row:', (wrote[0] ?? []).join(' | '));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
