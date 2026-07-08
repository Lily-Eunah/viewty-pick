import { PriceOffer } from '../adapters/index';
import { Listing, Product, ManualOverride, PromoType, ParseConfidence } from '../../lib/types';
import { toCanonicalQuantity } from './parsePackage';

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
  // §3.5 관측성: 정준 단위 판정 근거 1줄(디버깅 로그용, DB 미저장).
  parse_trace: string;
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

  // 정준 단위 수량 — 어떤 파싱 경로든 제품 정준 단위(volume_unit) 좌표계로 환산(PR-2, docs §1·§3.2).
  // normalize는 이 결과만 소비한다: 옛 normalize 내 무가드 regex 재파싱(Check-3)과 이원화된
  // 개수 도출을 제거하고 toCanonicalQuantity로 일원화. LLM on/off 무관하게 동일 가드를 통과한다.
  const canonical = toCanonicalQuantity(
    offer.parsedPackage,
    { volumeMl: product.volume_ml, volumeUnit: product.volume_unit ?? null, productName: product.name, brand: product.brand },
    offer.sourceText,
    offer.parsedVolumeRaw
  );

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
  } else if (promo_type === 'none' && !promo_text) {
    // Bundle quantity from the title = canonical packCount (§3.2, clamp 1~20 inside).
    if (canonical.packCount > 1) {
      total_quantity = canonical.packCount;
      paid_quantity = canonical.packCount;
      free_quantity = 0;
      min_quantity = canonical.packCount;

      if (sale_price !== null) {
        base_unit_price = sale_price;
        effective_unit_price = Math.round(sale_price / canonical.packCount);
      }

      promo_type = canonical.bundle ? 'bundle' : 'none';
      promo_text = canonical.evidence;
    }
  }

  // Conditional promo types (coupon/membership/app/card) must not affect
  // base_unit_price or effective_unit_price — they are label-only.
  if (['coupon', 'membership', 'app_only', 'card_discount'].includes(promo_type)) {
    base_unit_price = sale_price;
    effective_unit_price = sale_price;
  }

  // --- Per-retailer size via 정준 단위 (canonical, PR-2 docs §1·§3.2) ---
  // 판매처가 같은 제품을 다른 크기로 팔 수 있어(네이버 100ml / 올영 80ml) 그 판매처 용량으로
  // 단가를 낸다. 단, 크기의 단위는 제품 정준 단위(volume_unit)를 따른다: ml/g는 판매처 용량,
  // 매(시트)는 DB 매수(제목 ml은 함량이라 폐기), 개(기기)는 1대. DB와 다른 판매처 용량은
  // 게이트가 아니라 정보성(volume_mismatch_detail)일 뿐이다.
  const volume_ml = canonical.unitSize ?? (product.volume_ml || 1);
  const volume_mismatch_detail: string | null =
    canonical.sizeFromListing && product.volume_ml && canonical.unitSize !== product.volume_ml
      ? `판매처 용량 ${canonical.unitSize}${canonical.unit} (DB ${product.volume_ml}${canonical.unit}와 다름) — 판매처 용량으로 단가 계산`
      : null;

  const total_ml = volume_ml * total_quantity;

  // 단위당 단가 = 개당가 ÷ unitSize. 매 제품이면 매당, ml이면 ml당. 기기(개)는 개당==가격이라
  // unitPriceApplies=false → null (단가 라인 없음). §1b: 판매처에서 용량을 읽지 못한 미검증
  // DB 용량(LLM 시드 기본값)은 단위 정규화에 비신뢰. inspectionWarning(비앵커 폴백)도 비신뢰.
  // 신뢰 판정은 옛 의미를 그대로 보존(리뷰 #2): adapter parsedVolumeRaw가 있거나 판매처 용량이
  // DB와 다를 때만 "판매처에서 읽음"으로 본다(제목 용량이 DB와 동일하면 미검증 DB는 여전히 비신뢰).
  const volume_from_listing =
    canonical.sizeFromListing && (offer.parsedVolumeRaw != null || volume_mismatch_detail !== null);
  const volume_unverified = product.volume_verified === false && !volume_from_listing;
  const match_unverified = !!offer.inspectionWarning;
  const unit_price_reliable = canonical.unitPriceApplies && !volume_unverified && !match_unverified;
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
    parse_trace: canonical.trace,
  };
}
