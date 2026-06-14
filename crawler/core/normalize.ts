import { PriceOffer } from '../adapters/index';
import { Listing, Product, ManualOverride, PromoType, ParseConfidence } from '../../lib/types';
import { extractPackageFromTitle } from './packageExtractor';

export interface NormalizedPrice {
  regular_price: number | null;
  sale_price: number | null;
  base_unit_price: number | null;
  effective_unit_price: number | null;
  unit_price: number | null; // per ml
  promo_type: PromoType;
  promo_text: string | null;
  min_quantity: number;
  paid_quantity: number;
  free_quantity: number;
  total_quantity: number;
  total_ml: number;
  in_stock: boolean;
  parse_confidence: ParseConfidence;
  // Flags consumed by healthcheck / notify
  volume_mismatch: boolean;
  volume_mismatch_detail: string | null;
  shipping_note: string | null;
}

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

  console.log(
    `[Normalization] Applying ${activeOverrides.length} manual overrides for product ${product.id}, seller ${listing.seller_id}`
  );

  const updated = { ...offer };

  for (const o of activeOverrides) {
    if (o.override_type === 'price') {
      const val = parseInt(o.value, 10);
      if (!isNaN(val)) {
        updated.salePrice = val;
        updated.regularPrice = updated.regularPrice ? Math.max(updated.regularPrice, val) : val;
      }
    } else if (o.override_type === 'promo_type') {
      updated.promoType = o.value as PromoType;
    } else if (o.override_type === 'promo_text') {
      updated.promoText = o.value;
    } else if (o.override_type === 'in_stock') {
      updated.inStock = o.value.toLowerCase() === 'true';
    }
  }

  return updated;
}

export function normalizePrice(product: Product, offer: PriceOffer): NormalizedPrice {
  const sale_price = offer.salePrice;
  const regular_price = offer.regularPrice;
  const in_stock = offer.inStock;

  let base_unit_price = sale_price;
  let effective_unit_price = sale_price;
  let promo_type = offer.promoType;
  let promo_text = offer.promoText;

  let min_quantity = 1;
  let paid_quantity = 1;
  let free_quantity = 0;
  let total_quantity = 1;
  let parse_confidence: ParseConfidence = 'high';

  // --- Promo math ---

  if (promo_type === 'buy_x_get_y' && promo_text) {
    // Matches 1+1, 2+1, etc.
    const match = promo_text.match(/(\d+)\s*\+\s*(\d+)/);
    if (match) {
      const x = parseInt(match[1], 10);
      const y = parseInt(match[2], 10);

      paid_quantity = x;
      free_quantity = y;
      total_quantity = x + y;
      min_quantity = total_quantity;

      if (sale_price !== null) {
        base_unit_price = sale_price;
        effective_unit_price = Math.round((sale_price * paid_quantity) / total_quantity);

        // 1+1가 > 기본가 이상치 → parse_confidence=low
        if (effective_unit_price > sale_price) {
          parse_confidence = 'low';
        }
      }
    } else {
      parse_confidence = 'low';
    }
  } else if (promo_type === 'quantity_discount' && promo_text) {
    // E.g. '2개 구매 시 20% 할인'
    const discountMatch = promo_text.match(/(\d+)개.*?(\d+)%/);
    if (discountMatch && sale_price !== null) {
      const count = parseInt(discountMatch[1], 10);
      const discountPercent = parseInt(discountMatch[2], 10);

      min_quantity = count;
      paid_quantity = count;
      total_quantity = count;

      base_unit_price = sale_price;
      effective_unit_price = Math.round(
        (sale_price * count * (1 - discountPercent / 100)) / count
      );
    } else {
      parse_confidence = 'low';
    }
  } else if (promo_type === 'none' && !promo_text && offer.sourceText) {
    // Derive bundle quantity from product title
    const ext = extractPackageFromTitle(offer.sourceText);
    if (ext.detected && ext.confidence === 'high') {
      const uCount = ext.unitCount || 1;
      const uAmount = ext.unitAmount;

      const isCountValid = uCount >= 1 && uCount <= 20;
      const isAmountValid = uAmount === null || (uAmount >= 1 && uAmount <= 1000);

      if (isCountValid && isAmountValid) {
        total_quantity = uCount;
        paid_quantity = uCount;
        free_quantity = 0;
        min_quantity = uCount;

        if (sale_price !== null) {
          base_unit_price = sale_price;
          effective_unit_price = Math.round(sale_price / uCount);
        }

        promo_type = ext.promoType === 'bundle' ? 'bundle' : 'none';
        promo_text = ext.evidence;
      }
    }
  }

  // Conditional promo types (coupon/membership/app/card) must not affect
  // base_unit_price or effective_unit_price — they are label-only.
  if (['coupon', 'membership', 'app_only', 'card_discount'].includes(promo_type)) {
    base_unit_price = sale_price;
    effective_unit_price = sale_price;
  }

  // --- Volume and volume-mismatch detection ---
  let volume_ml = product.volume_ml || 50;
  let volume_mismatch = false;
  let volume_mismatch_detail: string | null = null;

  // Check 1: explicit parsedVolumeRaw from adapter (Naver crawl provides this)
  if (offer.parsedVolumeRaw !== undefined && offer.parsedVolumeRaw !== null) {
    if (product.volume_ml && offer.parsedVolumeRaw !== product.volume_ml) {
      volume_mismatch = true;
      volume_mismatch_detail = `Page volume ${offer.parsedVolumeRaw}ml ≠ DB ${product.volume_ml}ml`;
      parse_confidence = 'low';
    } else {
      volume_ml = offer.parsedVolumeRaw;
    }
  } else if (offer.sourceText && (promo_type === 'bundle' || promo_type === 'none')) {
    // Check 2: derive volume from title for bundle/none promos
    const ext = extractPackageFromTitle(offer.sourceText);
    if (ext.detected && ext.confidence === 'high' && ext.unitAmount !== null) {
      if (product.volume_ml && ext.unitAmount !== product.volume_ml) {
        volume_mismatch = true;
        volume_mismatch_detail = `Title volume ${ext.unitAmount}ml ≠ DB ${product.volume_ml}ml`;
        parse_confidence = 'low';
      } else {
        volume_ml = ext.unitAmount;
      }
    }
  }

  const total_ml = volume_ml * total_quantity;

  // ml당 단가 (using effective unit price for cross-product comparison)
  const unit_price =
    effective_unit_price !== null
      ? Number((effective_unit_price / volume_ml).toFixed(4))
      : null;

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
    volume_mismatch,
    volume_mismatch_detail,
    shipping_note: offer.shippingNote ?? null,
  };
}
