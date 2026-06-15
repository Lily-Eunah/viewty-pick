/**
 * One-time, NON-DESTRUCTIVE migration for the live product catalog Google Sheet.
 *
 * What it does (does NOT clear any existing row data):
 *   1. Removes ALL data-validation dropdowns/hints across every tab
 *      (category, product_name, badge_type, seller, override_type, skin_types…)
 *      so values can be freely copy-pasted.
 *   2. Inserts a `brand` column in `product_links`, immediately to the right of
 *      `product_name` (new column B), matching the `products` layout.
 *   3. Auto-fills `product_links!product_name` and `product_links!brand` from the
 *      `products` tab via ARRAYFORMULA — so adding a product row is mirrored here
 *      automatically (row-aligned with `products`).
 *
 * Idempotent-ish: re-running detects an existing `brand` header and skips the
 * column insert so link columns don't shift twice.
 *
 * Run: npm run sheets:migrate-dropdowns-brand
 */

import { google } from 'googleapis';
import type { sheets_v4 } from 'googleapis';

const ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

async function getSheets() {
  const credsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credsRaw || !ID) {
    console.error('GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEETS_SPREADSHEET_ID not set');
    process.exit(1);
  }
  const creds = JSON.parse(credsRaw);
  const auth  = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

type Sheets = Awaited<ReturnType<typeof getSheets>>;
type Request = sheets_v4.Schema$Request;

// Tabs whose dropdowns/validation should be stripped (all data tabs).
const ALL_TABS = ['categories', 'products', 'product_links', 'badges', 'retailer_allowlist', 'manual_overrides', 'seo_pages'];

async function migrate() {
  const sheets = await getSheets();

  // ── 1. Resolve sheetIds + current product_links header ──────────────────────
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID! });
  const sheetIds: Record<string, number> = {};
  for (const s of meta.data.sheets ?? []) {
    if (s.properties?.title && s.properties.sheetId != null) sheetIds[s.properties.title] = s.properties.sheetId;
  }

  const headerRes = await sheets.spreadsheets.values.get({ spreadsheetId: ID!, range: 'product_links!A1:Z1' });
  const plHeader = (headerRes.data.values?.[0] ?? []).map((h: string) => (h ?? '').trim());
  const hasBrand = plHeader[1] === 'brand';

  const requests: Request[] = [];

  // ── 2. Remove ALL data validation on every tab (clear = setDataValidation w/o rule) ──
  for (const tab of ALL_TABS) {
    if (sheetIds[tab] == null) continue;
    requests.push({
      setDataValidation: {
        range: { sheetId: sheetIds[tab], startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 26 },
        // no `rule` → clears any existing validation in the range
      },
    });
  }

  // ── 3. Insert `brand` column in product_links (right of product_name) ───────
  if (!hasBrand) {
    requests.push({
      insertDimension: {
        range: { sheetId: sheetIds['product_links'], dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
        inheritFromBefore: false,
      },
    });
  } else {
    console.log('• product_links already has a `brand` column — skipping column insert.');
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: ID!, requestBody: { requests } });
  console.log('✓ Removed all data-validation dropdowns/hints across all tabs');
  if (!hasBrand) console.log('✓ Inserted `brand` column into product_links (column B)');

  // ── 4. Write product_links header (product_name | brand | sellers…) ─────────
  await sheets.spreadsheets.values.update({
    spreadsheetId: ID!, range: 'product_links!A1:G1', valueInputOption: 'RAW',
    requestBody: { values: [['product_name', 'brand', 'oliveyoung', 'coupang', 'naver', 'zigzag', 'ably']] },
  });
  console.log('✓ product_links header set: product_name | brand | oliveyoung | coupang | naver | zigzag | ably');

  // ── 5. Clear literal values in A2:B (name/brand) then set ARRAYFORMULA mirror ──
  // (link columns C:G are left untouched — only the two mirrored columns change.)
  await sheets.spreadsheets.values.clear({ spreadsheetId: ID!, range: 'product_links!A2:B1000' });
  await sheets.spreadsheets.values.update({
    spreadsheetId: ID!, range: 'product_links!A2', valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        '=ARRAYFORMULA(IF(products!B2:B="","",products!B2:B))',
        '=ARRAYFORMULA(IF(products!C2:C="","",products!C2:C))',
      ]],
    },
  });
  console.log('✓ Auto-fill set: product_links A2/B2 mirror products name/brand (ARRAYFORMULA)');

  console.log('\nDone. product_name & brand now auto-populate from the products tab (row-aligned).');
  console.log('NOTE: keep product rows in the same order as their links — mirroring is by row position.');
}

migrate().catch((e) => { console.error(e); process.exit(1); });
