/**
 * No-offer routing — decide where a successful-but-priceless fetch (outcome
 * no_offer / data_error) is recorded for operator follow-up.
 *
 *   needsInspection (suspected heterogeneous set / low-confidence band)
 *     → inspection O/X tab. The operator confirms it is a single (단품), fills /
 *       corrects the price, and approves (O) → next sync promotes it to a shown
 *       price; X keeps it hidden. The price hint (offer.inspectionEstimatedPrice)
 *       may be blank (set price not per-unit derivable) for the operator to fill.
 *
 *   everything else (anchor-miss + no fallback, no Coupang search match, a
 *   data_error like a Coupang share short-link, …)
 *     → link_only tab (no price held; the operator fixes the source URL / 단품).
 *
 * The two destinations are MUTUALLY EXCLUSIVE — a link is never written to both.
 * Pure (no network) so the routing decision is unit-testable; run.ts pushes the
 * returned item onto the matching candidate array.
 */
import { FetchOutcome, PriceOffer } from '../adapters/index';
import { InspectionItem } from '../sheets/inspection';
import { LinkOnlyItem, classifyLinkOnly } from '../sheets/linkOnly';

export type NoOfferRoute =
  | { kind: 'inspection'; item: InspectionItem }
  | { kind: 'link_only'; item: LinkOnlyItem };

export interface NoOfferContext {
  sellerSlug: string;        // seller slug (naver / oliveyoung / coupang …)
  sellerName: string;        // display name (inspection 출처 fallback)
  productKey: string;
  productName: string;
  brand: string | null;
  url: string | null;        // listing crawl URL
  affiliateUrl: string | null; // curator buy link (preferred inspection link)
}

export function routeNoOffer(
  outcome: FetchOutcome,
  offer: PriceOffer,
  ctx: NoOfferContext
): NoOfferRoute {
  // Only a no_offer flagged needsInspection routes to the OX tab. A data_error
  // (bad source URL) is always a link_only fix, never an inspection price review.
  if (outcome === 'no_offer' && offer.needsInspection) {
    const why = (offer.sourceText ?? '').trim();
    // Stage-2 prefill: the suspected offer title + LLM-predicted 개수/용량/구성 (attached
    // by run.ts §B verify) so the operator confirms (O) / corrects rather than fills blank.
    const pp = offer.parsedPackage;
    return {
      kind: 'inspection',
      item: {
        product_key: ctx.productKey,
        product_name: ctx.productName,
        seller: ctx.sellerSlug,
        // Blank when no per-unit price is derivable (set price) — operator fills it.
        estimated_price: offer.inspectionEstimatedPrice ?? null,
        source: offer.matchedMallName ?? offer.storeName ?? ctx.sellerName,
        reason: `세트/저신뢰 의심 — 단품이면 가격 확인 후 O${why ? ` · ${why}` : ''}`.slice(0, 300),
        link: offer.matchedUrl ?? ctx.affiliateUrl ?? ctx.url ?? '',
        title: offer.suspectedTitle ?? undefined,
        pred_count: pp?.unitCount ?? null,
        pred_volume: pp?.unitAmount ?? null,
        pred_unit: pp?.unitType ?? null,
        composition: pp ? (pp.heterogeneous ? 'heterogeneous_set' : pp.promoType === 'bundle' ? 'homogeneous_bundle' : 'single') : null,
      },
    };
  }

  const { cause, action } = classifyLinkOnly(ctx.sellerSlug, outcome, offer.sourceText);
  return {
    kind: 'link_only',
    item: {
      seller: ctx.sellerSlug,
      brand: ctx.brand ?? '',
      product_name: ctx.productName,
      product_key: ctx.productKey,
      cause,
      action,
      url: ctx.url || ctx.affiliateUrl || '',
    },
  };
}
