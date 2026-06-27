import { Listing, PromoType } from '../../lib/types';
import type { ParsePackageResult } from '../core/parsePackage';

/**
 * Outcome of a fetch attempt — distinguishes a legitimate "no qualified offer"
 * from a technical fetch failure so the pipeline only counts the latter against
 * fail_count (§4.4). A thrown error from fetchOffer is the 'failed' state,
 * handled by run.ts's catch.
 *   ok         — a qualified offer was matched and priced.
 *   no_offer   — the fetch SUCCEEDED but there is no qualified offer (not on this
 *                platform, no official-mall offer, link-only). NOT a failure.
 *   data_error — the listing's own data is unusable so no fetch was even
 *                attempted (e.g. a Coupang `link.coupang.com/a/…` share short-link
 *                that carries no productId — an operator must fix the sheet URL).
 *                Like no_offer it never increments fail_count and keeps the
 *                listing active (link-only); additionally surfaced as an
 *                operator-facing data error in the daily summary / inspection.
 *   failed     — HTTP error / timeout / block / parse failure of a data page.
 */
export type FetchOutcome = 'ok' | 'no_offer' | 'data_error' | 'failed';

export interface PriceOffer {
  regularPrice: number | null;
  salePrice: number | null;
  inStock: boolean;
  promoType: PromoType;
  promoText: string | null;
  sourceText: string | null;
  storeName?: string | null;
  parsedVolumeRaw?: number | null; // ml parsed from product title/page (for volume mismatch check)
  shippingNote?: string | null;    // display label only: '무료배송', '로켓배송', '3,000원', etc.
  matchedUrl?: string | null;      // link of the matched offer (price + link from same offer)
  matchedMallName?: string | null; // raw mallName of the matched offer (audit / change detection)
  imageUrl?: string | null;        // product image from the matched offer (e.g. Coupang productImage) — display fallback
  matchExcluded?: boolean;         // true → no official-mall match; exclude from comparison
  // Non-empty → this price came from a NON-ANCHORED fallback match (Naver
  // anchor-miss → official-store mallName match or 가격비교 catalog lprice). The
  // price is kept but flagged: healthcheck forces status='warning' (inspection)
  // and normalize marks the ml unit_price unreliable (identity is unverified).
  inspectionWarning?: string | null;
  // True → the matched (priced) offer's title carries a BARE "N종" (e.g. "쿠션 2종"),
  // i.e. an "N종 중 택1" option-select page that is priced as a single. Informational
  // only (does NOT block the price); run.ts collects these into a Discord verify line
  // so the operator can confirm it is an option-select page and not a real set.
  nJongVerify?: boolean;
  // True → a NON-affiliate Naver listing's curated SKU was missing (e.g. 품절 → dropped
  // from Shopping results) and the price came from a DIFFERENT official-mall offer
  // (B2 official-store fallback). matchedUrl is that substitute offer's link. run.ts
  // adopts it as the buy link (DB affiliate_url/url + sheet writeback), preserving the
  // operator's original link in the product_links `naver_prev` column, and reports the
  // substitution to Discord. Always false for affiliate (naver.me) listings, catalog
  // fallbacks, and id-anchored matches (those never replace the operator's SKU).
  linkSubstituted?: boolean;
  // True → the matcher found a candidate it could NOT auto-price because it is a
  // SUSPECTED set (heterogeneous N-product bundle) or a low-confidence band match.
  // There is no qualified offer (outcome stays no_offer), but unlike a plain
  // anchor-miss this is routed to the inspection O/X tab — NOT link_only — so the
  // operator can confirm it is a single (단품), fill a price, and approve (O).
  needsInspection?: boolean;
  // Optional price HINT for an inspection candidate (e.g. the low-confidence
  // band's lprice). null when no per-unit price is derivable (e.g. a heterogeneous
  // set price) — the operator types the price in the tab before approving.
  inspectionEstimatedPrice?: number | null;
  // Explicit fetch outcome. Absent ⇒ treated as 'ok' (priced). A successful
  // fetch with no qualified offer MUST set 'no_offer' so it does not increment
  // fail_count. (Technical failures throw instead → run.ts classifies 'failed'.)
  outcome?: FetchOutcome;
  // Stage-2: parsePackage(게이트+LLM) 결과를 run.ts가 미리 채워 normalize에 전달(이중 파싱
  // 제거). 있으면 normalize가 sourceText 재파싱 대신 이 값을 사용. 없으면 기존 거동(regex).
  parsedPackage?: ParsePackageResult;
}

export interface RetailerAdapter {
  code: string;
  fetchOffer(listing: Listing): Promise<PriceOffer>;
}

export { CoupangAdapter } from './coupang';
export { NaverAdapter } from './naver';
export { OliveYoungAdapter } from './oliveyoung';
