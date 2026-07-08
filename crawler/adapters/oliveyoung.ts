/**
 * OliveYoung adapter — Naver-sourced, NO direct crawling (compliant).
 *
 * WHY no crawl: oliveyoung.co.kr robots.txt is `User-agent: * → Disallow: /`
 * (content paths are whitelisted only for search/AI bots) and the storefront is
 * behind a WAF that returns 403 to automated clients. UA spoofing is rejected.
 * There is also no public OliveYoung price API. The only compliant automated
 * path to an OliveYoung price is reading the OliveYoung offer that surfaces on
 * the approved Naver Shopping Search API (OliveYoung = "just another official
 * mall"). We never request oliveyoung.co.kr.
 *
 * Price comes via Naver (matched against mallName='올리브영'); the buy button is
 * always the curator affiliate_url (handled by the redirect route). When Naver
 * has no OliveYoung offer the price is left absent so a manual_override can fill
 * it (applied later in run.ts); until then the listing is link-only.
 */
import { Listing, Product } from '../../lib/types';
import { PriceOffer, RetailerAdapter } from './index';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { productRowCompat } from '../../lib/supabase/columnCompat';
import { loadMockDB } from '../../lib/supabase/mockDb';
import { matchOliveYoungOffer, stripHtml, containsBareNJong } from './naver';
import { resolveCuratedOyGoodsNo } from '../core/oliveyoungAnchor';

function isPlaceholderKey(v: string | undefined): boolean {
  return !v || v.includes('placeholder') || v.includes('example') || v.includes('dummy') || v.trim() === '';
}

// ---------------------------------------------------------------------------
// 4-tier display gate (final spec §1). The curator affiliate_url is the gate
// AND the buy link. "Curator URL present" (= sold on OliveYoung) does NOT
// guarantee "a Naver OliveYoung offer exists" — hence tiers 2 vs 3/4.
//   1 hidden     no curator URL              → OliveYoung row not shown
//   2 naver      curator + Naver offer       → price=Naver,  link=curator
//   3 manual     curator + no Naver + manual → price=manual, link=curator
//   4 link_only  curator + no Naver + no manual → curator link only (no price)
// Price always comes via Naver (or manual_override); the buy button is ALWAYS
// the curator affiliate_url (redirect route prefers affiliate_url).
// ---------------------------------------------------------------------------
export type OliveYoungTier = 'hidden' | 'naver' | 'manual' | 'link_only';

export interface OliveYoungTierInput {
  hasCuratorUrl: boolean;     // affiliate_url present
  naverMatched: boolean;      // a Naver OliveYoung offer was matched
  hasManualOverride: boolean; // an active manual_override price for oliveyoung
}

export function resolveOliveYoungTier(i: OliveYoungTierInput): {
  tier: OliveYoungTier;
  showPrice: boolean;
  priceSource: 'naver' | 'manual' | null;
} {
  if (!i.hasCuratorUrl) return { tier: 'hidden', showPrice: false, priceSource: null };
  if (i.naverMatched) return { tier: 'naver', showPrice: true, priceSource: 'naver' };
  if (i.hasManualOverride) return { tier: 'manual', showPrice: true, priceSource: 'manual' };
  return { tier: 'link_only', showPrice: false, priceSource: null };
}

export class OliveYoungAdapter implements RetailerAdapter {
  code = 'oliveyoung';

  async fetchOffer(listing: Listing): Promise<PriceOffer> {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    const isMock =
      process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
      process.env.CRAWLER_MODE === 'mock' ||
      process.env.NODE_ENV === 'test' ||
      isPlaceholderKey(clientId) ||
      isPlaceholderKey(clientSecret);

    // Curator-URL gate (tier 1): no affiliate_url → not sold on OliveYoung for
    // us → never source a price, never call Naver. The row is effectively hidden
    // (no displayable snapshot). This is the gate; the curator URL is also the link.
    if (!listing.affiliate_url) {
      return {
        regularPrice: null,
        salePrice: null,
        inStock: false,
        promoType: 'none',
        promoText: null,
        sourceText: 'OliveYoung: no curator affiliate_url — row hidden (tier 1)',
        storeName: '올리브영',
        matchedUrl: null,
        matchedMallName: null,
        matchExcluded: true,
        // No curator URL ⇒ legitimately no offer for us, not a fetch failure.
        outcome: 'no_offer',
      };
    }

    if (isMock) {
      return this.getMockOffer(listing);
    }

    // Load product (Supabase or mock DB).
    let product: Product | null = null;
    if (isSupabaseServerConfigured()) {
      const { data: pData } = await supabaseServer.from('products').select('*').eq('id', listing.product_id).single();
      if (pData) product = productRowCompat(pData); // PR-5 전환기 호환
    } else {
      const db = loadMockDB();
      product = db.products.find((p) => p.id === listing.product_id) || null;
    }
    if (!product) throw new Error(`Product not found for ID: ${listing.product_id}`);

    // goodsNo 앵커: 큐레이션 oy.run/affiliate URL → goodsNo. 네이버 올영 offer의 goodsNo와
    // 일치하는 것만 정확 SKU로 채택(형제 변종 오매칭 제거). 미해석 시 기존 느슨 매칭 폴백.
    const anchorGoodsNo = await resolveCuratedOyGoodsNo(listing.affiliate_url || listing.url);

    // Tier-2: OliveYoung match on Naver (mallName='올리브영'), goodsNo-anchored when resolvable.
    // Sets/bundles included with per-unit; ambiguity → Tier 3/4.
    const result = await matchOliveYoungOffer(product, clientId as string, clientSecret as string, anchorGoodsNo);

    if (!result.matched) {
      // No confident OliveYoung offer (Tier 3 manual_override / Tier 4 link-only).
      // inStock=true so a manual_override applied later in run.ts can supply a price.
      if (result.needsInspection) {
        console.warn(`[OliveYoung Adapter] AMBIGUOUS OliveYoung match for product ${product.id} (${product.name}) → inspection/manual: ${result.reason}`);
      } else {
        console.warn(`[OliveYoung Adapter] No Naver OliveYoung offer for product ${product.id} (${product.name}): ${result.reason}`);
      }
      return {
        regularPrice: null,
        salePrice: null,
        inStock: true,
        promoType: 'none',
        promoText: null,
        sourceText: `OliveYoung: no Naver offer — ${result.reason} (tier 3 manual_override or tier 4 link-only)`,
        storeName: '올리브영',
        matchedUrl: null,
        matchedMallName: null,
        matchExcluded: true,
        // Naver search SUCCEEDED but no OliveYoung offer → link-only, not a failure.
        // (A manual_override applied in run.ts will flip this back to 'ok'.)
        outcome: 'no_offer',
        // A suspected set (heterogeneous) / low-confidence band match → route to the
        // inspection O/X tab instead of link_only so the operator can confirm 단품,
        // fill a price, and approve (O). A plain no-offer leaves these false.
        needsInspection: result.needsInspection ?? false,
        inspectionEstimatedPrice: result.inspectionEstimatedPrice ?? null,
        suspectedTitle: result.suspectedTitle ?? null, // §B: LLM verify 후보 제목
        suspectedPrice: result.suspectedPrice ?? null,
      };
    }

    const item = result.matched;
    const parsedPrice = parseInt(item.lprice, 10);
    if (isNaN(parsedPrice)) throw new Error(`Failed to parse Naver price "${item.lprice}"`);

    return {
      regularPrice: null,
      salePrice: parsedPrice,
      inStock: true,
      promoType: 'none',
      promoText: null,
      sourceText: `Naver-sourced OliveYoung offer: ${stripHtml(item.title)} (${item.productId})`,
      storeName: '올리브영',
      parsedVolumeRaw: result.parsedVolumeRaw,
      matchedUrl: item.link || null,
      matchedMallName: item.mallName || null,
      anchored: result.anchored ?? false, // goodsNo-anchored → run.ts shows directly (no inspection)
      nJongVerify: containsBareNJong(item.title),
      outcome: 'ok',
    };
  }

  private getMockOffer(listing: Listing): PriceOffer {
    const MOCK_PRICES: Record<number, number> = { 3: 15400, 4: 29000, 5: 12500, 6: 15000, 7: 18500 };
    const basePrice = MOCK_PRICES[listing.product_id] ?? 17000;

    // Mock represents a Naver-sourced OliveYoung official-mall offer.
    return {
      regularPrice: null,
      salePrice: basePrice,
      inStock: true,
      promoType: 'none',
      promoText: null,
      sourceText: `[mock] Naver-sourced OliveYoung offer for product ${listing.product_id}`,
      storeName: '올리브영',
      matchedUrl: listing.affiliate_url || listing.url || null,
      matchedMallName: '올리브영',
    };
  }
}
