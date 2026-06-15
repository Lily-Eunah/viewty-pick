// scratch (safe to delete): verify products vs product_links row alignment
import { google } from 'googleapis';
const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
const sheets = google.sheets({ version: 'v4', auth });
const ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
(async () => {
  const p = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: 'products!B2:B' });
  const l = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: 'product_links!A2:A' });
  const pn = (p.data.values ?? []).map((r) => (r[0] ?? '').trim()).filter(Boolean);
  const ln = (l.data.values ?? []).map((r) => (r[0] ?? '').trim()).filter(Boolean);
  console.log('products rows:', pn.length, '| product_links rows:', ln.length);
  const max = Math.max(pn.length, ln.length);
  let mismatch = 0;
  for (let i = 0; i < max; i++) {
    if (pn[i] !== ln[i]) { mismatch++; console.log(`  ROW ${i + 2}: products="${pn[i] ?? ''}"  links="${ln[i] ?? ''}"`); }
  }
  console.log(mismatch === 0 ? 'ALIGNED ✓' : `MISMATCHES: ${mismatch}`);
})();
