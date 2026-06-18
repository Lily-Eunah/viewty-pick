/**
 * link_only sheet — the crawler AUTO-MAINTAINS a `link_only` tab listing every
 * crawl-target link (naver/coupang/oliveyoung) that produced NO price this run
 * (no_offer / data_error / 폴백 실패 / 이종세트 보류). Distinct from the `inspection`
 * tab: inspection rows DO have an (estimated) price held for O/X review; here the
 * price is missing entirely and the operator must fix the source (swap the Coupang
 * URL, confirm a Naver/OliveYoung 단품 offer, split a set, …).
 *
 * Flow:
 *   - Each crawler:sync regenerates the tab from the CURRENT run's unmatched
 *     crawl-target links, keyed by product_key+seller. Cause/action are mapped
 *     straight from the adapter's known outcome + reason (classifyLinkOnly) — no
 *     new inference. 상태=미해결, 갱신일=run date.
 *   - A link that gets a price (ok/warning) next run is simply absent from the new
 *     current set → its row drops out. So only the still-unresolved links remain.
 *   - zigzag/ably (no adapter) are NEVER recorded — they are intended link-only,
 *     not a matching failure (mirrors run.ts's skippedNoAdapter accounting).
 *
 * This reuses the same best-effort, mock-skipped Google Sheets write pattern as
 * the inspection tab (service-account auth, clear+update).
 */
import { google } from 'googleapis';
import { FetchOutcome } from '../adapters/index';

export const LINK_ONLY_TAB = 'link_only';
export const LINK_ONLY_HEADERS = ['판매처', '브랜드', '제품명', 'productId', '원인', '권장 액션', 'URL', '상태', '갱신일'];

/** A crawler-produced unmatched (no-price) crawl-target link. */
export interface LinkOnlyItem {
  seller: string;        // seller slug (naver / coupang / oliveyoung)
  brand: string;         // product brand (display)
  product_name: string;  // product name (display)
  product_key: string;   // stable product identity — upsert key + 'productId' column
  cause: string;         // why no price (classifyLinkOnly)
  action: string;        // recommended operator action (classifyLinkOnly)
  url: string;           // the sheet/buy URL to inspect or replace
}

/** A row of the link_only tab = an item plus the auto status + 갱신일. */
export interface LinkOnlyRow extends LinkOnlyItem {
  status: string;        // '미해결' (resolved links drop out of the tab entirely)
  updated_at: string;    // YYYY-MM-DD (run date)
}

// ---------------------------------------------------------------------------
// Pure helpers (testable, no network)
// ---------------------------------------------------------------------------

/** Stable upsert key for a product+seller pair (matches inspection.rowKey). */
export function rowKey(productKey: string, seller: string): string {
  return `${(productKey || '').trim()}::${(seller || '').trim()}`;
}

/**
 * Map a seller + known fetch outcome (+ the adapter's reason text) to an operator
 * cause/action. This does NOT re-infer anything — it reads the outcome already
 * decided by the adapter and the reason carried in offer.sourceText (only used to
 * tell apart a 이종세트 hold from a plain anchor/offer miss). Unknown sellers fall
 * back to a generic line.
 */
export function classifyLinkOnly(
  seller: string,
  outcome: FetchOutcome,
  sourceText: string | null | undefined
): { cause: string; action: string } {
  // A heterogeneous-set hold is flagged by the adapter reason (naver: "heterogeneous
  // … set", oliveyoung: "heterogeneous set"); match the markers we already emit.
  const isSet = /heterogeneous|이종|세트|\bset\b/i.test(sourceText || '');

  switch (seller) {
    case 'coupang':
      if (outcome === 'data_error') {
        return {
          cause: '쿠팡 제품 상세 URL 아님 (공유 short-link · productId 없음)',
          action: '제품 상세 URL(/vp/products/{id})로 교체',
        };
      }
      return {
        cause: 'productId가 Partners 검색 top-N에 없음(검색 전용 API)',
        action: '검색 상위 쿠팡 URL로 교체',
      };
    case 'oliveyoung':
      return isSet
        ? { cause: '올리브영 오퍼가 이종 세트 → 검수 보류', action: '올리브영 단품 판매·URL 확인' }
        : { cause: '네이버 검색에 올리브영 단품 오퍼 미발견(Tier 3/4)', action: '올리브영 단품 판매·URL 확인' };
    case 'naver':
      return isSet
        ? { cause: 'id-anchored이나 묶음(이종 세트) → 검수 필요', action: '공식몰 단품 URL 확인·교체 또는 세트 분리' }
        : { cause: 'anchor miss + 공식몰/카탈로그 폴백 없음', action: '공식몰 단품 URL 확인·교체 또는 세트 분리' };
    default:
      return { cause: `가격 미매칭 (${outcome})`, action: 'URL·판매 여부 확인' };
  }
}

/**
 * Build the rows to write: dedupe the current run's items by product_key+seller
 * (last wins) and stamp 상태=미해결 + 갱신일. Items with no product_key/seller are
 * skipped. The tab is fully regenerated each run, so a link that is no longer in
 * `items` (now priced) is dropped — leaving only unresolved links, no duplicates.
 */
export function buildLinkOnlyRows(items: LinkOnlyItem[], today: string): LinkOnlyRow[] {
  const byKey = new Map<string, LinkOnlyRow>();
  for (const it of items) {
    if (!it.product_key?.trim() || !it.seller?.trim()) continue;
    byKey.set(rowKey(it.product_key, it.seller), { ...it, status: '미해결', updated_at: today });
  }
  return [...byKey.values()];
}

function rowToValues(r: LinkOnlyRow): (string | number)[] {
  return [r.seller, r.brand, r.product_name, r.product_key, r.cause, r.action, r.url, r.status, r.updated_at];
}

// ---------------------------------------------------------------------------
// Network (Google Sheets) — best-effort, mock-skipped (mirrors inspection).
// ---------------------------------------------------------------------------
function isGoogleConfigured(): boolean {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  return !!(
    json && json !== 'your-google-service-account-credentials-json-string' &&
    id && id !== 'placeholder-sheet-id'
  );
}

function linkOnlyDisabled(): boolean {
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

/** Overwrite the link_only tab with the given rows (best-effort). */
export async function writeLinkOnlyRows(rows: LinkOnlyRow[]): Promise<void> {
  if (linkOnlyDisabled()) {
    console.log(`[link_only (mock/disabled)] would write ${rows.length} row(s).`);
    return;
  }
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
    const sheets = sheetsClient();
    await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${LINK_ONLY_TAB}!A1:I100000` });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${LINK_ONLY_TAB}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [LINK_ONLY_HEADERS, ...rows.map(rowToValues)] },
    });
  } catch (e) {
    console.warn(`[link_only] write failed (continuing — run \`npm run sheets:headers\` if the tab is missing): ${(e as Error).message}`);
  }
}

/** Regenerate the link_only tab from the current run's items; returns the count. */
export async function upsertLinkOnly(
  current: LinkOnlyItem[],
  today: string = new Date().toISOString().slice(0, 10)
): Promise<{ written: number }> {
  const rows = buildLinkOnlyRows(current, today);
  await writeLinkOnlyRows(rows);
  return { written: rows.length };
}
