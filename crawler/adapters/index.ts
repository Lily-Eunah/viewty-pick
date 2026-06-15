import { Listing, PromoType } from '../../lib/types';

/**
 * Outcome of a fetch attempt — distinguishes a legitimate "no qualified offer"
 * from a technical fetch failure so the pipeline only counts the latter against
 * fail_count (§4.4). A thrown error from fetchOffer is the third state,
 * 'failed', handled by run.ts's catch.
 *   ok        — a qualified offer was matched and priced.
 *   no_offer  — the fetch SUCCEEDED but there is no qualified offer (not on this
 *               platform, no official-mall offer, link-only). NOT a failure.
 *   failed    — HTTP error / timeout / block / parse failure of a data page.
 */
export type FetchOutcome = 'ok' | 'no_offer' | 'failed';

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
  matchExcluded?: boolean;         // true → no official-mall match; exclude from comparison
  // Explicit fetch outcome. Absent ⇒ treated as 'ok' (priced). A successful
  // fetch with no qualified offer MUST set 'no_offer' so it does not increment
  // fail_count. (Technical failures throw instead → run.ts classifies 'failed'.)
  outcome?: FetchOutcome;
}

export interface RetailerAdapter {
  code: string;
  fetchOffer(listing: Listing): Promise<PriceOffer>;
}

export { CoupangAdapter } from './coupang';
export { NaverAdapter } from './naver';
export { OliveYoungAdapter } from './oliveyoung';
