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
};

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
