import { Product, Listing, PriceSnapshot, ScoreConfig } from '../../lib/types';

/**
 * Calculates the Viewty Score (normalized to 100) for all products in the database.
 */
export function recalculateViewtyScores(
  products: Product[],
  listings: Listing[],
  snapshots: PriceSnapshot[],
  configs: ScoreConfig[],
  productBadges: { product_id: number; badge_id: number }[],
  badges: { id: number; slug: string }[]
): Record<number, number> {
  const scores: Record<number, number> = {};

  // Build key-value map for configs
  const weights: Record<string, number> = {};
  configs.forEach((cfg) => {
    weights[cfg.key] = Number(cfg.value);
  });

  // Default weights matching migrations (seeding values)
  const getWeight = (key: string, def: number): number => {
    return weights[key] !== undefined ? weights[key] : def;
  };

  // Group products by category to calculate category-level metrics
  const categoryProducts: Record<number, Product[]> = {};
  products.forEach((p) => {
    if (p.category_id !== null) {
      if (!categoryProducts[p.category_id]) categoryProducts[p.category_id] = [];
      categoryProducts[p.category_id].push(p);
    }
  });

  // Pre-calculate lowest ml-price per product
  const productMlPrices: Record<number, number> = {};
  products.forEach((p) => {
    const prodListings = listings.filter((l) => l.product_id === p.id && l.is_active);
    const prodSnaps = snapshots.filter(
      (s) => prodListings.some((l) => l.id === s.listing_id) && s.unit_price !== null && s.status === 'ok'
    );
    if (prodSnaps.length > 0) {
      productMlPrices[p.id] = Math.min(...prodSnaps.map((s) => Number(s.unit_price)));
    }
  });

  products.forEach((prod) => {
    let score = 0;

    // ==========================================
    // 1. Recommendation Credibility (Max 50 points)
    // ==========================================
    const prodBadgesList = productBadges.filter((pb) => pb.product_id === prod.id);
    const badgeSlugs = prodBadgesList
      .map((pb) => badges.find((b) => b.id === pb.badge_id)?.slug)
      .filter(Boolean) as string[];

    let badgeCount = 0;
    if (badgeSlugs.includes('directorpi')) {
      score += getWeight('directorpi', 25);
      badgeCount++;
    }
    if (badgeSlugs.includes('hwahae_rank')) {
      score += getWeight('hwahae_rank', 15);
      badgeCount++;
    }
    if (badgeSlugs.includes('oliveyoung_best')) {
      score += getWeight('oliveyoung_best', 15);
      badgeCount++;
    }
    // Bonus for multi-source recommendation
    if (badgeCount >= 2) {
      score += getWeight('multi_source', 10);
    }

    // ==========================================
    // 2. Price Competitiveness (Max 35 points)
    // ==========================================
    const prodListings = listings.filter((l) => l.product_id === prod.id && l.is_active);
    const activeSnaps = snapshots.filter(
      (s) => prodListings.some((l) => l.id === s.listing_id) && s.status === 'ok'
    );

    if (activeSnaps.length > 0) {
      // 2.1 Category percentile (ml-price top 30%)
      const catId = prod.category_id;
      const myMlPrice = productMlPrices[prod.id];
      if (catId !== null && myMlPrice !== undefined) {
        const siblingPrices = categoryProducts[catId]
          .map((p) => productMlPrices[p.id])
          .filter((price) => price !== undefined)
          .sort((a, b) => a - b);
        
        const myRank = siblingPrices.indexOf(myMlPrice);
        const percentile = siblingPrices.length > 1 ? myRank / (siblingPrices.length - 1) : 0;
        
        if (percentile <= 0.3) {
          score += getWeight('perml_top30', 15);
        }
      }

      // 2.2 Base below average price of same product by 10%
      const basePrices = activeSnaps.map((s) => s.base_unit_price).filter((p): p is number => p !== null);
      if (basePrices.length > 0) {
        const lowestBase = Math.min(...basePrices);
        const avgBase = basePrices.reduce((a, b) => a + b, 0) / basePrices.length;
        if (lowestBase <= avgBase * 0.9) {
          score += getWeight('base_below_avg10', 10);
        }
      }

      // 2.3 Has active promotion
      const hasPromo = activeSnaps.some((s) => s.promo_type !== 'none' && s.promo_type !== 'unknown');
      if (hasPromo) {
        score += getWeight('has_effective', 5);
      }

      // 2.4 Price Drop in 7d (MVP stub: uses current price drop fields)
      const hasDrop = activeSnaps.some(
        (s) => s.regular_price && s.sale_price && s.sale_price <= s.regular_price * 0.95
      );
      if (hasDrop) {
        score += getWeight('price_drop_7d', 5);
      }
    }

    // ==========================================
    // 3. Retailer Credibility (Max 15 points)
    // ==========================================
    let activeSellers = 0;
    const sellerSlugs = prodListings.map((l) => {
      // Stub seller codes
      if (l.link_key.includes('oliveyoung')) return 'oliveyoung';
      if (l.link_key.includes('coupang')) return 'coupang';
      if (l.link_key.includes('naver')) return 'naver';
      return '';
    }).filter(Boolean);

    if (sellerSlugs.includes('oliveyoung')) {
      score += getWeight('seller_oliveyoung', 5);
      activeSellers++;
    }
    if (sellerSlugs.includes('coupang')) {
      score += getWeight('seller_coupang', 5);
      activeSellers++;
    }
    if (sellerSlugs.includes('naver')) {
      score += getWeight('seller_naver', 5);
      activeSellers++;
    }
    if (activeSellers >= 3) {
      score += getWeight('sellers_3plus', 5);
    }

    // Bound the final score to max 100
    scores[prod.id] = Math.min(Math.round(score), 100);
  });

  return scores;
}
