/**
 * Inspection OX sheet — the crawler PRE-FILLS held (warning) prices into an
 * `inspection` tab; the operator approves with a single O (promote → shown) or X
 * (reject → keep hidden). No more hand-editing manual_overrides: the crawler fills
 * 추정가격/출처/사유/링크, the operator only types O/X.
 *
 * Flow:
 *   - Each crawler:sync UPSERTs every warning-held offer (비앵커 공식가 / catalog
 *     lprice / 용량불일치 …) into the tab, keyed by product_key+seller. The operator's
 *     `승인` cell is PRESERVED (never overwritten); only the data columns refresh.
 *   - Next sync READS the tab: 승인=O → the (possibly operator-edited) 추정가격 is
 *     applied as a price manual_override → status flips to 'ok' → shown on site.
 *     승인=X → stays hidden (link-only). Blank → unreviewed → stays warning (hidden).
 *   - O/X rows are sticky (operator decisions persist across syncs); resolved/
 *     disappeared BLANK rows are dropped.
 *
 * Web visibility is unchanged: only status='ok' snapshots are displayed
 * (isDisplayablePriceSnapshot), so a warning stays hidden until an O override
 * promotes it. This reuses the existing manual_override → 'ok' path entirely.
 */
import { google } from 'googleapis';
import { ManualOverride } from '../../lib/types';
import type { ParsePackageResult } from '../core/parsePackage';

export const INSPECTION_TAB = 'inspection';
// Stage-2: 제목 + LLM 예측(개수/용량/단위/구성) prefill 컬럼 추가. 운영자는 맞으면 승인=O,
// 틀리면 예측 셀을 고치고 O. (LLM_TITLE_PARSE off면 예측 컬럼은 비어 있음.)
export const INSPECTION_HEADERS = [
  'product_key', 'product_name', 'seller',
  '제목', '예측개수', '예측용량', '예측단위', '구성',
  '추정가격', '출처', '사유', '링크', '승인',
];

/** A crawler-produced inspection candidate (one held/warning offer). */
export interface InspectionItem {
  product_key: string;
  product_name: string;
  seller: string;              // seller slug (maps to sellers.slug / seller_id)
  estimated_price: number | null;
  source: string;              // matched mallName / '네이버 가격비교' / store name
  reason: string;              // why it is held (healthcheck/inspection message)
  link: string;                // buy/audit link
  // Stage-2 prefill (선택): 보류된 priced offer의 제목 + LLM 예측 파싱. 운영자 O 시
  // (편집됐을 수 있는) 예측이 title_parse_cache에 manual로 확정된다(setManualParse).
  title?: string;              // raw offer title (cache key)
  pred_count?: number | null;  // 본품 개수
  pred_volume?: number | null; // 본품 1개 용량
  pred_unit?: string | null;   // ml | g | sheet
  composition?: string | null; // single | homogeneous_bundle | heterogeneous_set | option_select
}

/** A row of the inspection tab = an item plus the operator's 승인 cell. */
export interface InspectionRow extends InspectionItem {
  approval: string;            // raw 승인 cell (normalized via parseApproval)
}

// ---------------------------------------------------------------------------
// Pure helpers (testable, no network)
// ---------------------------------------------------------------------------

/** Stable upsert key for a product+seller pair. */
export function rowKey(productKey: string, seller: string): string {
  return `${(productKey || '').trim()}::${(seller || '').trim()}`;
}

/** Normalize the 승인 cell to O (approve) / X (reject) / '' (unreviewed). */
export function parseApproval(cell: string | null | undefined): 'O' | 'X' | '' {
  const c = (cell || '').trim().toUpperCase();
  if (['O', 'ㅇ', '✓', 'V', 'Y', 'YES', 'OK', '승인', '노출'].includes(c)) return 'O';
  if (['X', '✗', 'N', 'NO', '거부', '숨김'].includes(c)) return 'X';
  return '';
}

/** Parse a 추정가격 cell ("24,200" / "24200원" / number) → positive int or null. */
export function parsePrice(cell: string | number | null | undefined): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) && cell > 0 ? Math.round(cell) : null;
  const digits = (cell || '').toString().replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Merge fresh crawler candidates with the existing tab, preserving operator
 * approvals. Current warnings are refreshed (data columns) and carry over any
 * prior 승인. Existing O/X rows NOT in the current set are kept (decisions persist
 * — e.g. an O row is now 'ok' so it is no longer a warning, but its override must
 * stay). Existing BLANK rows not in the current set are dropped (resolved/gone).
 */
export function mergeInspectionRows(existing: InspectionRow[], current: InspectionItem[]): InspectionRow[] {
  const existingByKey = new Map(existing.map((r) => [rowKey(r.product_key, r.seller), r]));
  const currentKeys = new Set<string>();
  const out: InspectionRow[] = [];

  for (const item of current) {
    const k = rowKey(item.product_key, item.seller);
    currentKeys.add(k);
    const prev = existingByKey.get(k);
    out.push({ ...item, approval: prev ? parseApproval(prev.approval) : '' });
  }
  for (const r of existing) {
    const k = rowKey(r.product_key, r.seller);
    if (currentKeys.has(k)) continue;
    const appr = parseApproval(r.approval);
    if (appr === 'O' || appr === 'X') out.push({ ...r, approval: appr }); // sticky decision
    // blank + not current → resolved/disappeared → drop
  }
  return out;
}

/**
 * Synthesize price manual_overrides from O-approved rows. The price comes from the
 * tab's 추정가격 cell (the operator may have corrected it before approving). Rows
 * whose product_key/seller are unknown, or with no positive price, are skipped.
 */
export function approvalOverrides(
  rows: InspectionRow[],
  products: { id: number; product_key: string }[],
  sellers: { id: number; slug: string }[]
): ManualOverride[] {
  const out: ManualOverride[] = [];
  for (const r of rows) {
    if (parseApproval(r.approval) !== 'O') continue;
    const price = parsePrice(r.estimated_price);
    if (price == null) continue;
    const prod = products.find((p) => p.product_key === r.product_key);
    const sel = sellers.find((s) => s.slug === r.seller);
    if (!prod || !sel) continue;
    out.push({
      id: 0,
      product_id: prod.id,
      seller_id: sel.id,
      override_type: 'price',
      value: String(price),
      reason: `inspection O${r.source ? ` (${r.source})` : ''}`,
      expires_at: null,
      is_active: true,
    });
  }
  return out;
}

/**
 * O로 승인된 행 중 제목 + 예측 파싱이 있는 것을 title_parse_cache용 manual 결과로 변환
 * (stage-2 §2). 운영자가 셀을 고쳤다면 그 값이 반영된다. 다음 sync부터 그 제목은
 * LLM/규칙 대신 이 확정 파싱을 쓰고 재호출하지 않는다(setManualParse는 run.ts에서 호출).
 */
export function manualParseEntries(rows: InspectionRow[]): { title: string; result: ParsePackageResult }[] {
  const out: { title: string; result: ParsePackageResult }[] = [];
  for (const r of rows) {
    if (parseApproval(r.approval) !== 'O') continue;
    const title = (r.title || '').trim();
    if (!title) continue;
    const count = r.pred_count != null && r.pred_count >= 1 ? Math.round(r.pred_count) : 1;
    const volume = r.pred_volume != null && r.pred_volume > 0 ? r.pred_volume : null;
    const unit = (r.pred_unit || '').toLowerCase();
    const unitType: ParsePackageResult['unitType'] =
      unit === 'ml' || unit === 'g' || unit === 'sheet' ? unit : volume != null ? 'ml' : 'count';
    const comp = (r.composition || '').trim();
    const heterogeneous = comp === 'heterogeneous_set';
    const promoType: ParsePackageResult['promoType'] =
      comp === 'homogeneous_bundle' ? 'bundle' : heterogeneous ? 'set' : 'none';
    out.push({
      title,
      result: {
        detected: true,
        unitType,
        unitAmount: heterogeneous ? null : volume,
        unitCount: heterogeneous ? null : count,
        totalAmount: !heterogeneous && volume != null ? volume * count : null,
        promoType,
        confidence: 'high', // operator-confirmed
        evidence: '운영자 검수 O',
        method: 'manual',
        heterogeneous,
        route: 'needs-llm',
      },
    });
  }
  return out;
}

function rowToValues(r: InspectionRow): (string | number)[] {
  return [
    r.product_key,
    r.product_name,
    r.seller,
    r.title ?? '',
    r.pred_count != null ? r.pred_count : '',
    r.pred_volume != null ? r.pred_volume : '',
    r.pred_unit ?? '',
    r.composition ?? '',
    r.estimated_price != null ? r.estimated_price : '',
    r.source,
    r.reason,
    r.link,
    parseApproval(r.approval), // write back the normalized O/X/'' so the cell stays clean
  ];
}

// ---------------------------------------------------------------------------
// Network (Google Sheets) — best-effort, mock-skipped (mirrors notify/freeze).
// ---------------------------------------------------------------------------
function isGoogleConfigured(): boolean {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  return !!(
    json && json !== 'your-google-service-account-credentials-json-string' &&
    id && id !== 'placeholder-sheet-id'
  );
}

function inspectionDisabled(): boolean {
  return (
    process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
    process.env.CRAWLER_MODE === 'mock' ||
    !isGoogleConfigured()
  );
}

function sheetsClient() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  return google.sheets({ version: 'v4', auth });
}

/** Read the inspection tab (best-effort: returns [] on mock/unconfigured/error). */
export async function readInspectionRows(): Promise<InspectionRow[]> {
  if (inspectionDisabled()) return [];
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
    const sheets = sheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${INSPECTION_TAB}!A:M` });
    const rows = res.data.values ?? [];
    if (rows.length < 2) return [];
    const headers = rows[0].map((h: string) => String(h).trim());
    const idx = (name: string) => headers.indexOf(name);
    const col = (row: string[], name: string) => {
      const i = idx(name);
      return i >= 0 ? (row[i] ?? '') : '';
    };
    const numOrNull = (s: string): number | null => {
      const n = parseFloat(String(s).replace(/[^\d.]/g, ''));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    return rows.slice(1)
      .map((row) => ({
        product_key: String(col(row, 'product_key')).trim(),
        product_name: String(col(row, 'product_name')),
        seller: String(col(row, 'seller')).trim(),
        title: String(col(row, '제목')),
        pred_count: numOrNull(String(col(row, '예측개수'))),
        pred_volume: numOrNull(String(col(row, '예측용량'))),
        pred_unit: String(col(row, '예측단위')).trim() || null,
        composition: String(col(row, '구성')).trim() || null,
        estimated_price: parsePrice(String(col(row, '추정가격'))),
        source: String(col(row, '출처')),
        reason: String(col(row, '사유')),
        link: String(col(row, '링크')),
        approval: String(col(row, '승인')),
      }))
      .filter((r) => r.product_key && r.seller);
  } catch (e) {
    console.warn(`[Inspection] read failed (continuing): ${(e as Error).message}`);
    return [];
  }
}

/** Overwrite the inspection tab with the merged rows (best-effort). */
export async function writeInspectionRows(rows: InspectionRow[]): Promise<void> {
  if (inspectionDisabled()) {
    console.log(`[Inspection (mock/disabled)] would write ${rows.length} row(s).`);
    return;
  }
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
    const sheets = sheetsClient();
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${INSPECTION_TAB}!A1:M100000` });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${INSPECTION_TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [INSPECTION_HEADERS, ...rows.map(rowToValues)] },
    });
  } catch (e) {
    console.warn(`[Inspection] write failed (continuing — run \`npm run sheets:headers\` if the tab is missing): ${(e as Error).message}`);
  }
}

/**
 * Upsert current warnings into the tab; returns counts plus the still-UNREVIEWED
 * (blank 승인) rows. `pendingItems` is what the Discord summary lists: an already
 * O/X-decided item is preserved in the sheet but NOT re-surfaced (no re-prompt).
 */
export async function upsertInspection(
  current: InspectionItem[]
): Promise<{ written: number; pending: number; pendingItems: InspectionRow[] }> {
  const existing = await readInspectionRows();
  const merged = mergeInspectionRows(existing, current);
  await writeInspectionRows(merged);
  const pendingItems = merged.filter((r) => parseApproval(r.approval) === '');
  return { written: merged.length, pending: pendingItems.length, pendingItems };
}
