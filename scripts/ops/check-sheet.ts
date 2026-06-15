/**
 * Read-only pre-check for Phase D re-import.
 *
 * Fetches the live Google Sheet and runs the same duplicate detection the
 * importer uses, WITHOUT writing anything. Confirms the cleaned canonical sheet
 * will pass the importer's fail-fast gate before we run the real import.
 *
 * Run: npm run ops:check-sheet
 */
import { google } from 'googleapis';
import * as v from '../../crawler/sheets/validate';

function isGoogleConfigured(): boolean {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  return !!(json && json !== 'your-google-service-account-credentials-json-string' && id && id !== 'placeholder-sheet-id');
}

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

async function main() {
  if (!isGoogleConfigured()) { console.error('Google Sheets not configured. Aborting.'); process.exit(1); }
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  console.log('=== sheet pre-check (READ-ONLY) ===');
  const [rawProducts, rawLinks] = await Promise.all([
    fetchSheet(id, 'products!A:Z'),
    fetchSheet(id, 'product_links!A:Z'),
  ]);
  const nameToKey = v.buildNameToKey(rawProducts);
  const flat = v.expandListings(rawLinks, nameToKey);
  console.log(`rows: products=${rawProducts.length}, product_links=${rawLinks.length}, expanded listings=${flat.length}`);

  const report = v.detectSheetDuplicates(rawProducts, rawLinks);
  if (v.hasDuplicates(report)) {
    console.error('\nFAIL — sheet has duplicates (import would ABORT before writing):');
    console.error(v.formatDuplicateReport(report));
    process.exit(2);
  }
  console.log('\nPASS — no duplicate product_key/link_key/url. Import would proceed.');
}

main().catch((e) => { console.error('check failed:', e); process.exit(1); });
