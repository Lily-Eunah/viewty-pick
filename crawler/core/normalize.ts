import { PriceOffer } from '../adapters/index';
import { Listing, Product, ManualOverride, PromoType, ParseConfidence } from '../../lib/types';
import { extractPackageFromTitle } from './packageExtractor';

export interface NormalizedPrice {
  regular_price: number | null;
  sale_price: number | null;
  base_unit_price: number | null;
  effective_unit_price: number | null;
  unit_price: number | null; // per ml — null only when volume unverified / match unverified
  unit_price_reliable: boolean; // false only when DB volume unverified & not read, or match unverified
  promo_type: PromoType;
  promo_text: string | null;
  min_quantity: number;
  paid_quantity: number;
  free_quantity: number;
  total_quantity: number;
  total_ml: number;
  in_stock: boolean;
  parse_confidence: ParseConfidence;
  // Informational only (per-retailer volume): true when the listing volume differs
  // from the DB volume. Does NOT gate the price or unit_price — kept for audit/log.
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
        // A manual price is an asserted, displayable price. Clear any adapter
        // exclusion (e.g. OliveYoung tier 3: Naver had no offer → matchExcluded /
        // outcome='no_offer') and assert stock so it passes the healthcheck and
        // surfaces as a priced ('ok') outcome.
        updated.inStock = true;
        updated.matchExcluded = false;
        updated.outcome = 'ok';
        // An approved price (incl. an inspection O) is no longer "held": clear the
        // inspection flag so healthcheck does not re-downgrade it to warning.
        updated.inspectionWarning = null;
        updated.sourceText = `[manual_override price] ${updated.sourceText ?? ''}`.trim();
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
    // Derive bundle quantity from product title. Stage-2: prefer run.ts-injected
    // parsePackage result (gate+LLM) over re-parsing; falls back to regex when absent.
    const ext = offer.parsedPackage ?? extractPackageFromTitle(offer.sourceText);
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

  // --- Per-retailer volume (operator decision: size differs per seller) ---
  // A retailer may sell the same product (identity-confirmed upstream) in a
  // different size (네이버 100ml / 올리브영 80ml / 쿠팡 120ml). We therefore price
  // ml당 from THIS listing's own volume:
  //   - volume READ from the offer (parsedVolumeRaw or title) → use it.
  //   - volume NOT read → assume the DB volume (product.volume_ml).
  // Either way unit_price is computed and unit_price_reliable=true. A volume that
  // differs from the DB is NO LONGER a mismatch-gate — `volume_mismatch_detail`
  // is kept ONLY as an informational audit string (NOT used to null the price or
  // hold the listing). The parsing-error risk (wrong ml → wrong ml당) is accepted.
  // §PR-1 canonical-unit stopgap: a per-retailer volume parsed from the title is an
  // ML/G magnitude — meaningful ONLY for ml/g products. For 매(sheet)/개(device)
  // products the title's ml is essence content / bundled gel, NOT the product size,
  // so we keep the DB canonical size (매수 / 1대 — confirmed clean, §7-b) and never
  // let an ml amount leak in to be mislabeled "185매" / "200개". (Full model: PR-2.)
  const canonicalUnit = (product.volume_unit || 'ml').trim();
  const unitIsMlOrG = canonicalUnit === 'ml' || canonicalUnit === 'g' || canonicalUnit === '';
  let volume_ml = product.volume_ml || (unitIsMlOrG ? 50 : 1);
  let volume_mismatch_detail: string | null = null;

  // Check 1: Stage-2: prefer the run.ts-injected parsePackage result (gate+LLM with guards) over anything else
  const ext = offer.parsedPackage;
  if (unitIsMlOrG && ext && ext.detected && ext.confidence === 'high') {
    if (ext.unitAmount !== null) {
      volume_ml = ext.unitAmount;
      if (product.volume_ml && ext.unitAmount !== product.volume_ml) {
        volume_mismatch_detail = `판매처 용량 ${ext.unitAmount}ml (DB ${product.volume_ml}ml와 다름) — 판매처 용량으로 ml당 계산`;
      }
    } else {
      // 기기 제품 등 volume=null로 교정된 경우
      volume_ml = product.volume_ml || 1;
    }
  } else if (unitIsMlOrG && offer.parsedVolumeRaw !== undefined && offer.parsedVolumeRaw !== null) {
    // Check 2: explicit parsedVolumeRaw from adapter (if parsedPackage is absent or low-confidence)
    volume_ml = offer.parsedVolumeRaw;
    if (product.volume_ml && offer.parsedVolumeRaw !== product.volume_ml) {
      volume_mismatch_detail = `판매처 용량 ${offer.parsedVolumeRaw}ml (DB ${product.volume_ml}ml와 다름) — 판매처 용량으로 ml당 계산`;
    }
  } else if (unitIsMlOrG && offer.sourceText && (promo_type === 'bundle' || promo_type === 'none')) {
    // Check 3: fallback to regex parse
    const regexExt = extractPackageFromTitle(offer.sourceText);
    if (regexExt.detected && regexExt.confidence === 'high' && regexExt.unitAmount !== null) {
      volume_ml = regexExt.unitAmount;
      if (product.volume_ml && regexExt.unitAmount !== product.volume_ml) {
        volume_mismatch_detail = `판매처 용량 ${regexExt.unitAmount}ml (DB ${product.volume_ml}ml와 다름) — 판매처 용량으로 ml당 계산`;
      }
    }
  }

  const total_ml = volume_ml * total_quantity;

  // ml당 단가 (effective unit price ÷ this listing's volume). Per-retailer volume:
  // computed and reliable regardless of whether the volume was parsed or assumed.
  // §1b: an explicitly-unverified DB volume (LLM-seeded default) stays unreliable
  // for ml normalization ONLY when the volume was NOT read from the listing — a
  // parsed listing volume overrides the unverified DB default.
  // §PR-1: a per-retailer listing volume only counts for ml/g products — for 매/개
  // the Checks discarded any parsed ml, so it must NOT flip unit_price to "reliable".
  const volume_from_listing =
    unitIsMlOrG &&
    ((offer.parsedVolumeRaw !== undefined && offer.parsedVolumeRaw !== null) || volume_mismatch_detail !== null);
  const volume_unverified = product.volume_verified === false && !volume_from_listing;
  // A non-anchored fallback match (offer.inspectionWarning set) has UNVERIFIED SKU
  // identity, so its ml normalization is not trustworthy — disable the ml-based
  // unit_price (price itself stays visible/comparable, like §1b).
  const match_unverified = !!offer.inspectionWarning;
  const unit_price_reliable = !volume_unverified && !match_unverified;
  const unit_price =
    unit_price_reliable && effective_unit_price !== null
      ? Number((effective_unit_price / volume_ml).toFixed(4))
      : null;

  return {
    regular_price,
    sale_price,
    base_unit_price,
    effective_unit_price,
    unit_price,
    unit_price_reliable,
    promo_type,
    promo_text,
    min_quantity,
    paid_quantity,
    free_quantity,
    total_quantity,
    total_ml,
    in_stock,
    parse_confidence,
    volume_mismatch: volume_mismatch_detail !== null, // informational, never gates
    volume_mismatch_detail,
    shipping_note: offer.shippingNote ?? null,
  };
}
