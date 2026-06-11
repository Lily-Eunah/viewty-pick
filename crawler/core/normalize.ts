import { PriceOffer } from '../adapters/index';
import { Listing, Product, ManualOverride, PromoType, ParseConfidence } from '../../lib/types';

interface NormalizedPrice {
  regular_price: number | null;
  sale_price: number | null;
  base_unit_price: number | null;
  effective_unit_price: number | null;
  unit_price: number | null; // per ml price
  promo_type: PromoType;
  promo_text: string | null;
  min_quantity: number;
  paid_quantity: number;
  free_quantity: number;
  total_quantity: number;
  total_ml: number;
  in_stock: boolean;
  parse_confidence: ParseConfidence;
}

/**
 * Applies active manual overrides to a listing's price offer.
 */
export function applyManualOverrides(
  product: Product,
  listing: Listing,
  offer: PriceOffer,
  overrides: ManualOverride[]
): PriceOffer {
  const activeOverrides = overrides.filter((o) => {
    if (!o.is_active || o.product_id !== product.id || o.seller_id !== listing.seller_id) return false;
    if (o.expires_at && new Date(o.expires_at) < new Date()) return false;
    return true;
  });

  if (activeOverrides.length === 0) return offer;

  console.log(`[Normalization] Applying ${activeOverrides.length} active manual overrides for Product ID ${product.id}, Seller ID ${listing.seller_id}`);
  
  const updatedOffer = { ...offer };

  for (const o of activeOverrides) {
    if (o.override_type === 'price') {
      const val = parseInt(o.value, 10);
      if (!isNaN(val)) {
        updatedOffer.salePrice = val;
        updatedOffer.regularPrice = updatedOffer.regularPrice ? Math.max(updatedOffer.regularPrice, val) : val;
      }
    } else if (o.override_type === 'promo_type') {
      updatedOffer.promoType = o.value as PromoType;
    } else if (o.override_type === 'promo_text') {
      updatedOffer.promoText = o.value;
    } else if (o.override_type === 'in_stock') {
      updatedOffer.inStock = o.value.toLowerCase() === 'true';
    }
  }

  return updatedOffer;
}

/**
 * Normalizes a raw price offer into database-ready fields.
 */
export function normalizePrice(product: Product, offer: PriceOffer): NormalizedPrice {
  const sale_price = offer.salePrice;
  const regular_price = offer.regularPrice;
  const in_stock = offer.inStock;

  let base_unit_price = sale_price; // Single purchase base price
  let effective_unit_price = sale_price; // Promotion adjusted unit price
  let promo_type = offer.promoType;
  let promo_text = offer.promoText;

  let min_quantity = 1;
  let paid_quantity = 1;
  let free_quantity = 0;
  let total_quantity = 1;
  let parse_confidence: ParseConfidence = 'high';

  // 1. Process promotional math
  if (promo_type === 'buy_x_get_y' && promo_text) {
    // Matches 1+1, 2+1, etc.
    const match = promo_text.match(/(\d+)\s*\+\s*(\d+)/);
    if (match) {
      const x = parseInt(match[1], 10); // Paid quantity
      const y = parseInt(match[2], 10); // Free quantity
      
      paid_quantity = x;
      free_quantity = y;
      total_quantity = x + y;
      min_quantity = total_quantity;

      if (sale_price !== null) {
        // base_unit_price is the price to buy a single item if possible.
        // E.g. Olive Young 1+1 requires buying the package, so base price is the sale price of the package.
        base_unit_price = sale_price;
        // effective_unit_price is the price divided by the total number of items obtained.
        effective_unit_price = Math.round((sale_price * paid_quantity) / total_quantity);
      }
    } else {
      parse_confidence = 'low';
    }
  } else if (promo_type === 'quantity_discount' && promo_text) {
    // E.g., '2개 구매 시 20% 할인'
    const discountMatch = promo_text.match(/(\d+)개.*(\d+)%/);
    if (discountMatch && sale_price !== null) {
      const count = parseInt(discountMatch[1], 10);
      const discountPercent = parseInt(discountMatch[2], 10);
      
      min_quantity = count;
      paid_quantity = count;
      total_quantity = count;
      
      base_unit_price = sale_price;
      effective_unit_price = Math.round((sale_price * count * (1 - discountPercent / 100)) / count);
    } else {
      parse_confidence = 'low';
    }
  }

  // Calculate volume-adjusted totals
  const volume_ml = product.volume_ml || 50;
  const total_ml = volume_ml * total_quantity;
  
  // ml당 단가 (calculated using the effective unit price)
  const unit_price = effective_unit_price !== null ? Number((effective_unit_price / volume_ml).toFixed(4)) : null;

  return {
    regular_price,
    sale_price,
    base_unit_price,
    effective_unit_price,
    unit_price,
    promo_type,
    promo_text,
    min_quantity,
    paid_quantity,
    free_quantity,
    total_quantity,
    total_ml,
    in_stock,
    parse_confidence,
  };
}
