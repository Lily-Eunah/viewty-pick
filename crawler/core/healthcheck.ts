import { Listing, Product, RetailerAllowlist, PriceSnapshot, PriceSnapshotStatus } from '../../lib/types';
import { PriceOffer, FetchOutcome } from '../adapters/index';
import { NormalizedPrice } from './normalize';

export interface HealthCheckResult {
  status: PriceSnapshotStatus;
  message: string | null;
  severity: 'info' | 'warning' | 'critical' | null;
}

export function runHealthCheck(
  product: Product,
  listing: Listing,
  offer: PriceOffer,
  normalized: NormalizedPrice,
  previousSnapshot: PriceSnapshot | null,
  allowlist: RetailerAllowlist[]
): HealthCheckResult {
  const { sale_price, regular_price, base_unit_price, effective_unit_price } = normalized;

  // Rule 1: Missing price
  if (sale_price === null || sale_price === undefined) {
    return { status: 'failed', message: 'Failed to extract sale price from page', severity: 'warning' };
  }

  // Rule 2: Price < 1,000 KRW (parsing error)
  if (sale_price < 1000) {
    return {
      status: 'failed',
      message: `Extremely low price (${sale_price}원) — likely a parsing error`,
      severity: 'critical',
    };
  }

  // Rule 3: Regular price < Sale price (math error)
  if (regular_price !== null && regular_price < sale_price) {
    return {
      status: 'failed',
      message: `Regular price (${regular_price}원) < sale price (${sale_price}원)`,
      severity: 'warning',
    };
  }

  // Rule 4: Effective promo price > base price (promo math error, e.g. 1+1가 > 기본가)
  if (
    effective_unit_price !== null &&
    base_unit_price !== null &&
    effective_unit_price > base_unit_price
  ) {
    return {
      status: 'failed',
      message: `Effective promo price (${effective_unit_price}원) > base price (${base_unit_price}원)`,
      severity: 'warning',
    };
  }

  // Rule 5: Volume mismatch (§1 compromise) — the price is real, so we do NOT
  // gate it. The listing surfaces base/effective prices normally; only the
  // ml-based unit_price is nulled in normalize (unit_price_reliable=false). The
  // mismatch is routed to the inspection queue / volume-audit (§1b) as a warning.
  if (normalized.volume_mismatch) {
    return {
      status: 'warning',
      message: `Volume mismatch → inspection queue (price kept, unit_price disabled): ${normalized.volume_mismatch_detail}`,
      severity: 'warning',
    };
  }

  // Rule 6: parse_confidence=low (ambiguous promo)
  if (normalized.parse_confidence === 'low') {
    return {
      status: 'warning',
      message: `parse_confidence=low — price excluded from comparison. Source: "${offer.sourceText?.slice(0, 80)}"`,
      severity: 'info',
    };
  }

  // Rule 7: Naver allowlist check
  if (listing.seller_id === 3) {
    const brandAllowlist = allowlist.filter(
      (al) =>
        al.seller_id === 3 &&
        al.is_active &&
        al.brand.toLowerCase() === product.brand?.toLowerCase()
    );

    if (brandAllowlist.length > 0 && offer.storeName) {
      const isAllowed = brandAllowlist.some((al) =>
        offer.storeName!.toLowerCase().includes(al.allowed_store_name.toLowerCase())
      );

      if (!isAllowed) {
        return {
          status: 'failed',
          message: `Naver store "${offer.storeName}" not in allowlist for brand "${product.brand}"`,
          severity: 'warning',
        };
      }
    }
  }

  // Rule 8: ±50% price variance vs previous snapshot
  if (previousSnapshot && previousSnapshot.sale_price) {
    const prev = previousSnapshot.sale_price;
    const pct = Math.abs((sale_price - prev) / prev);
    if (pct >= 0.5) {
      return {
        status: 'warning',
        message: `Price variance ≥50% (prev ${prev}원 → current ${sale_price}원)`,
        severity: 'warning',
      };
    }
  }

  return { status: 'ok', message: null, severity: null };
}

export interface ListingOutcomeResolution {
  fail_count: number;
  is_active: boolean;
  should_notify: boolean;
  use_previous_price: boolean;
}

/**
 * Map a fetch outcome to the listing's fail_count / activation update.
 *
 * Invariant: fail_count counts CONSECUTIVE fetch failures only. A successful
 * fetch — whether it produced a price ('ok') or legitimately had no qualified
 * offer ('no_offer') — resets the streak to 0 and never deactivates the listing.
 * Only 'failed' advances the §4.4 staircase (warn → alert → hide → manual). This
 * is the fix: a legitimate no-match no longer accumulates fail_count and so can
 * never auto-deactivate an otherwise-healthy link-only listing.
 */
export function resolveListingOutcome(
  listing: Listing,
  outcome: FetchOutcome
): ListingOutcomeResolution {
  if (outcome === 'failed') {
    return handleConsecutiveFailures(listing);
  }
  // 'ok' | 'no_offer' | 'data_error' — a successful (or skipped) fetch with no
  // technical failure resets the streak and never deactivates the listing.
  // data_error is an operator-facing sheet-data problem, not a fetch failure.
  return {
    fail_count: 0,
    is_active: listing.is_active,
    should_notify: false,
    use_previous_price: false,
  };
}

export function handleConsecutiveFailures(
  listing: Listing
): {
  fail_count: number;
  is_active: boolean;
  should_notify: boolean;
  use_previous_price: boolean;
} {
  const newFailCount = listing.fail_count + 1;
  let is_active = listing.is_active;
  let should_notify = false;
  let use_previous_price = false;

  if (newFailCount === 1) {
    use_previous_price = true;
  } else if (newFailCount === 2) {
    should_notify = true;
    use_previous_price = true;
  } else if (newFailCount === 3) {
    is_active = false;
    should_notify = true;
  } else if (newFailCount >= 5) {
    should_notify = true;
  }

  return { fail_count: newFailCount, is_active, should_notify, use_previous_price };
}
