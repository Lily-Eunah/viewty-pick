/**
 * features-normalize — tool for the `normalize-features` skill.
 *
 * The summarization/normalization itself is an LLM judgement call (see the skill
 * SKILL.md and docs/features-normalization.md); this script only does the
 * deterministic sheet I/O around it:
 *
 *   --list           READ-ONLY. Print JSON of products whose `features` cell is
 *                    empty but that have a `features_detail` (or a name to search).
 *                    Shape: [{ row, brand, name, category, features_detail }]
 *
 *   --apply <file>   Write the normalized `features` back. <file> is a JSON array of
 *                    { row, name, features }. `name` is verified against the sheet
 *                    row before writing (abort on any mismatch) so a stale row index
 *                    can never overwrite the wrong product. Add --dry to preview.
 *
 * Run: npx tsx -r dotenv/config scripts/ops/features-normalize.ts --list
 *      npx tsx -r dotenv/config scripts/ops/features-normalize.ts --apply plan.json [--dry]
 */
import { google } from 'googleapis';
import * as fs from 'fs';

function colLetter(n: number): string {
  let s = '';
  for (let i = n; i >= 0; i = Math.floor(i / 26) - 1) s = String.fromCharCode(65 + (i % 26)) + s;
  return s;
}

function isGoogleConfigured(): boolean {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  return !!(json && json !== 'your-google-service-account-credentials-json-string' && id && id !== 'placeholder-sheet-id');
}

async function getSheets(readonly: boolean) {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const scope = readonly ? 'https://www.googleapis.com/auth/spreadsheets.readonly' : 'https://www.googleapis.com/auth/spreadsheets';
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: [scope] });
  return google.sheets({ version: 'v4', auth });
}

interface Grid { rows: string[][]; header: string[]; idx: (h: string) => number; }

async function readGrid(readonly: boolean): Promise<Grid> {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const sheets = await getSheets(readonly);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: 'products!A:Z' });
  const rows = res.data.values ?? [];
  const header = (rows[0] ?? []).map((h: string) => String(h).trim());
  return { rows, header, idx: (h: string) => header.indexOf(h) };
}

async function list() {
  const { rows, idx } = await readGrid(true);
  const iN = idx('name'), iB = idx('brand'), iC = idx('category'), iF = idx('features'), iD = idx('features_detail');
  if (iF < 0) throw new Error('features column not found');
  const out: { row: number; brand: string; name: string; category: string; features_detail: string }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const name = (rows[r][iN] ?? '').trim();
    if (!name) continue;
    const f = (rows[r][iF] ?? '').trim();
    if (f) continue; // already has features
    out.push({
      row: r + 1,
      brand: (rows[r][iB] ?? '').trim(),
      name,
      category: iC >= 0 ? (rows[r][iC] ?? '').trim() : '',
      features_detail: iD >= 0 ? (rows[r][iD] ?? '').trim() : '',
    });
  }
  console.log(JSON.stringify(out, null, 2));
  console.error(`[features-normalize] ${out.length} product(s) need features.`);
}

async function apply(file: string, dry: boolean) {
  const plan: { row: number; name?: string; features: string }[] = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!Array.isArray(plan) || plan.length === 0) { console.error('[features-normalize] empty plan — nothing to do.'); return; }
  const { rows, idx } = await readGrid(false);
  const iN = idx('name'), iF = idx('features');
  if (iF < 0) throw new Error('features column not found');
  const featCol = colLetter(iF);

  const data: { range: string; values: string[][] }[] = [];
  const errors: string[] = [];
  for (const p of plan) {
    const r = p.row - 1;
    if (r < 1 || r >= rows.length) { errors.push(`row ${p.row}: out of range`); continue; }
    const sheetName = (rows[r][iN] ?? '').trim();
    if (p.name && sheetName !== p.name.trim()) {
      errors.push(`row ${p.row}: name mismatch (sheet="${sheetName}" plan="${p.name}")`);
      continue;
    }
    if (!p.features || !p.features.trim()) { errors.push(`row ${p.row}: empty features`); continue; }
    data.push({ range: `products!${featCol}${p.row}`, values: [[p.features.trim()]] });
    console.error(`row ${p.row}: ${sheetName}\n   → ${p.features.trim()}`);
  }

  if (errors.length) {
    console.error('\n[features-normalize] ABORT — plan validation errors:');
    errors.forEach((e) => console.error('  ' + e));
    process.exit(2);
  }
  if (dry) { console.error(`\n[DRY RUN] would write ${data.length} features cell(s).`); return; }
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const sheets = await getSheets(false);
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId: id, requestBody: { valueInputOption: 'RAW', data } });
  console.error(`\n[features-normalize] wrote ${data.length} features cell(s).`);
}

async function main() {
  if (!isGoogleConfigured()) { console.error('Google Sheets not configured (GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_SHEETS_SPREADSHEET_ID).'); process.exit(1); }
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry');
  if (argv.includes('--list')) return list();
  const ai = argv.indexOf('--apply');
  if (ai >= 0 && argv[ai + 1]) return apply(argv[ai + 1], dry);
  console.error('Usage: features-normalize.ts --list | --apply <plan.json> [--dry]');
  process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
