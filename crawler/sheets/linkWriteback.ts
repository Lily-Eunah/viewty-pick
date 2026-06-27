/**
 * Naver link write-back — persist a B2 official-store SUBSTITUTION into the
 * `product_links` sheet so it survives the next import (which upserts each
 * listing's url/affiliate_url from the sheet, clobbering any DB-only change).
 *
 * WHY: when an operator-linked Naver SKU goes 품절 it drops out of the Shopping
 * results (anchor miss); the matcher then prices a DIFFERENT official-mall 구성
 * (B2). We adopt that offer's link as the buy link, but we must NOT silently
 * destroy what the operator typed. So, write-once, we copy the operator's
 * ORIGINAL link into a `naver_prev` column the first time we overwrite `naver`;
 * thereafter `naver_prev` is left untouched (it must hold the TRUE operator link,
 * not a previous auto-substitution) while `naver` tracks the current live offer.
 *
 * The planning step is pure (no network) so the row/column resolution and the
 * write-once preservation rule are unit-testable; the IO wrapper does the Sheets
 * read + batchUpdate and is best-effort (a failure is logged, never fatal).
 */
import { google } from 'googleapis';

export interface NaverLinkSubstitution {
  // product_links rows are keyed by product_key (preferred) with product_name as a
  // backward-compat fallback (mirrors importer resolveProductKey). We match on either
  // so the write-back works whether or not the sheet carries a product_key column.
  productKey?: string | null;
  productName: string;
  newUrl: string;      // the substitute official-mall offer link to adopt
}

export interface SheetCellWrite {
  range: string;       // A1 range, e.g. "product_links!E7"
  value: string;
}

const PRODUCT_LINKS_TAB = 'product_links';

/** 0-based column index → A1 letter (A, B, … Z, AA …). */
export function colLetter(n: number): string {
  let s = '';
  for (let i = n; i >= 0; i = Math.floor(i / 26) - 1) s = String.fromCharCode(65 + (i % 26)) + s;
  return s;
}

/**
 * Plan the cell writes for a batch of substitutions. Pure.
 *
 * @param rows   ALL sheet rows INCLUDING the header (rows[0]); the raw 2-D values.
 * @param subs   substitutions to apply, keyed by product_name.
 * Returns the cell writes to batchUpdate. For each matched row:
 *   - if `naver_prev` is BLANK → write the current `naver` cell (operator original)
 *     into `naver_prev` (write-once preservation), AND
 *   - write `newUrl` into `naver` (unless it already equals the current value → skip).
 * Rows whose product_name is not found, or whose naver cell already equals newUrl
 * (and prev already preserved), produce no writes.
 */
export function planNaverLinkWriteback(
  rows: string[][],
  subs: NaverLinkSubstitution[]
): SheetCellWrite[] {
  if (rows.length < 2 || subs.length === 0) return [];
  const header = (rows[0] ?? []).map((h) => String(h ?? '').trim());
  const nameIdx = header.indexOf('product_name');
  const naverIdx = header.indexOf('naver');
  const prevIdx = header.indexOf('naver_prev');
  const keyIdx = header.indexOf('product_key'); // optional
  if (nameIdx < 0 || naverIdx < 0 || prevIdx < 0) return []; // missing columns → run sheets:headers first

  // Match by product_key first (preferred), then product_name (backward-compat).
  const byKey = new Map<string, NaverLinkSubstitution>();
  const byName = new Map<string, NaverLinkSubstitution>();
  for (const s of subs) {
    if (s.productKey) byKey.set(s.productKey.trim(), s);
    byName.set(s.productName.trim(), s);
  }

  const writes: SheetCellWrite[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const rowKey = keyIdx >= 0 ? String(row[keyIdx] ?? '').trim() : '';
    const name = String(row[nameIdx] ?? '').trim();
    const sub = (rowKey && byKey.get(rowKey)) || byName.get(name);
    if (!sub) continue;
    const rowNumber = r + 1; // A1 rows are 1-based
    const currentNaver = String(row[naverIdx] ?? '').trim();
    const currentPrev = String(row[prevIdx] ?? '').trim();

    // Write-once: preserve the operator's ORIGINAL link only if not already kept.
    if (currentPrev === '' && currentNaver !== '') {
      writes.push({ range: `${PRODUCT_LINKS_TAB}!${colLetter(prevIdx)}${rowNumber}`, value: currentNaver });
    }
    // Adopt the substitute as the live link (skip a no-op overwrite).
    if (currentNaver !== sub.newUrl) {
      writes.push({ range: `${PRODUCT_LINKS_TAB}!${colLetter(naverIdx)}${rowNumber}`, value: sub.newUrl });
    }
  }
  return writes;
}

/**
 * Best-effort IO wrapper: read the product_links tab, plan the writes, batchUpdate.
 * Returns the number of cells written (0 on no-op or failure). Never throws.
 */
export async function writeBackNaverSubstitutions(
  spreadsheetId: string,
  subs: NaverLinkSubstitution[]
): Promise<number> {
  if (subs.length === 0) return 0;
  try {
    const creds  = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
    const auth   = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const res    = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${PRODUCT_LINKS_TAB}!A:Z` });
    const rows   = (res.data.values ?? []) as string[][];
    const writes = planNaverLinkWriteback(rows, subs);
    if (writes.length === 0) return 0;
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: writes.map((w) => ({ range: w.range, values: [[w.value]] })),
      },
    });
    console.log(`[Link Writeback] Wrote ${writes.length} cell(s) for ${subs.length} Naver link substitution(s) (naver_prev preserved).`);
    return writes.length;
  } catch (e: unknown) {
    console.warn(`[Link Writeback] product_links write-back failed (continuing): ${(e as Error).message}`);
    return 0;
  }
}
