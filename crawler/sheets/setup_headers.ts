import { google } from 'googleapis';

// Column headers must match validate.ts schemas exactly (sheet schema v2).
const HEADERS: Record<string, string[]> = {
  _categories:        ['대분류', '대분류_slug', '소분류', '소분류_slug', 'sort_order'],
  products:           ['product_key', 'name', 'brand', 'category', 'volume_ml', 'skin_types', 'features', 'hwahae_url', 'image_url', 'is_disabled', 'slug'],
  product_links:      ['product_name', 'brand', 'oliveyoung', 'coupang', 'naver', 'zigzag', 'ably'],
  badges:             ['product_name', 'brand', 'directorpi_detail', 'directorpi_source', 'directorpi_ref_url', 'directorpi_date'],
  retailer_allowlist: ['seller', 'brand', 'allowed_store_name'],
  manual_overrides:   ['product_name', 'seller', 'override_type', 'value', 'reason', 'expires_at', 'product_key'],
  seo_pages:          ['slug', 'page_type', 'title', 'h1', 'description', 'category', 'skin_type', 'badge_type', 'is_active'],
  // Inspection OX tab — crawler pre-fills held (warning) prices; operator types O/X.
  inspection:         ['product_key', 'product_name', 'seller', '추정가격', '출처', '사유', '링크', '승인'],
};

/** Create any tabs in HEADERS that do not yet exist (addSheet; ignore "exists"). */
async function ensureTabs(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const have = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title));
  const missing = Object.keys(HEADERS).filter((t) => !have.has(t));
  if (missing.length === 0) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) },
  });
  console.log(`✓ created missing tab(s): ${missing.join(', ')}`);
}

async function setupHeaders() {
  const credsRaw      = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!credsRaw || !spreadsheetId) {
    console.error('GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEETS_SPREADSHEET_ID not set');
    process.exit(1);
  }

  const creds = JSON.parse(credsRaw);
  const auth  = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  await ensureTabs(sheets, spreadsheetId);

  for (const [tab, headers] of Object.entries(HEADERS)) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${tab}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
      console.log(`✓ ${tab}: ${headers.length} columns`);
    } catch (e: unknown) {
      console.error(`✗ ${tab}: ${(e as Error).message}`);
    }
  }
  console.log('\nDone. Header rows written to all tabs.');
}

setupHeaders();
