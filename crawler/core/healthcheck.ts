import { Listing, Product, RetailerAllowlist, PriceSnapshot, PriceSnapshotStatus } from '../../lib/types';
import { PriceOffer } from '../adapters/index';

interface HealthCheckResult {
  status: PriceSnapshotStatus;
  message: string | null;
  severity: 'info' | 'warning' | 'critical' | null;
}

/**
 * Validates a normalized price offer against health rules, allowlists, and historic limits.
 */
export function runHealthCheck(
  product: Product,
  listing: Listing,
  offer: PriceOffer,
  normalized: {
    sale_price: number | null;
    regular_price: number | null;
    base_unit_price: number | null;
    effective_unit_price: number | null;
  },
  previousSnapshot: PriceSnapshot | null,
  allowlist: RetailerAllowlist[]
): HealthCheckResult {
  const salePrice = normalized.sale_price;
  const regularPrice = normalized.regular_price;

  // Rule 1: HTTP Error or missing prices
  if (salePrice === null || salePrice === undefined) {
    return {
      status: 'failed',
      message: 'Failed to extract sale price from page',
      severity: 'warning',
    };
  }

  // Rule 2: Non-positive or extremely low price (< 1,000 KRW)
  if (salePrice < 1000) {
    return {
      status: 'failed',
      message: `Extremely low price detected (${salePrice}원). Potential parsing error.`,
      severity: 'critical',
    };
  }

  // Rule 3: Math inconsistency (Regular price < Sale price)
  if (regularPrice !== null && regularPrice < salePrice) {
    return {
      status: 'failed',
      message: `Regular price (${regularPrice}원) is lower than sale price (${salePrice}원)`,
      severity: 'warning',
    };
  }

  // Rule 4: Promotion logic inconsistency (Effective price higher than base price)
  if (
    normalized.effective_unit_price !== null &&
    normalized.base_unit_price !== null &&
    normalized.effective_unit_price > normalized.base_unit_price
  ) {
    return {
      status: 'failed',
      message: `Effective promo price (${normalized.effective_unit_price}원) is higher than base price (${normalized.base_unit_price}원)`,
      severity: 'warning',
    };
  }

  // Rule 5: Naver Allowlist validation (DESIGN.md §4.1)
  if (listing.seller_id === 3) { // Naver Seller ID is 3
    const brandAllowlist = allowlist.filter(
      (al) => al.seller_id === 3 && al.is_active && al.brand.toLowerCase() === product.brand?.toLowerCase()
    );

    if (brandAllowlist.length > 0 && offer.storeName) {
      const isAllowed = brandAllowlist.some(
        (al) => offer.storeName!.toLowerCase().includes(al.allowed_store_name.toLowerCase())
      );

      if (!isAllowed) {
        return {
          status: 'failed',
          message: `Naver store name "${offer.storeName}" not found in allowlist for brand "${product.brand}"`,
          severity: 'warning',
        };
      }
    }
  }

  // Rule 6: Historic variance check (±50% compared to previous snapshot)
  if (previousSnapshot && previousSnapshot.sale_price) {
    const prevPrice = previousSnapshot.sale_price;
    const pctChange = Math.abs((salePrice - prevPrice) / prevPrice);

    if (pctChange >= 0.5) {
      return {
        status: 'warning',
        message: `Historic price variance is >= 50% (Prev: ${prevPrice}원, Current: ${salePrice}원)`,
        severity: 'warning',
      };
    }
  }

  return {
    status: 'ok',
    message: null,
    severity: null,
  };
}

/**
 * Implements listing failure level gates based on consecutive failure counts.
 * E.g., keeps previous price on 1st crash, alerts on 2nd, hides on 3rd.
 */
export function handleConsecutiveFailures(
  listing: Listing,
  previousSnapshot: PriceSnapshot | null
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
    // 1st failure: Keep previous price as fallback to avoid immediate display blankout
    use_previous_price = true;
  } else if (newFailCount === 2) {
    // 2nd failure: Send alert
    should_notify = true;
    use_previous_price = true;
  } else if (newFailCount === 3) {
    // 3rd failure: Stop showing price (exclude listing from active listings)
    is_active = false;
    should_notify = true;
  } else if (newFailCount >= 5) {
    // 5th failure: Flag for manual intervention
    should_notify = true;
  }

  return {
    fail_count: newFailCount,
    is_active,
    should_notify,
    use_previous_price,
  };
}
