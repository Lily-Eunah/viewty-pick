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
import { Listing, Product, RetailerAllowlist } from '../../lib/types';
import { PriceOffer, RetailerAdapter } from './index';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { loadMockDB } from '../../lib/supabase/mockDb';
import { matchNaverOffer, stripHtml } from './naver';

function isPlaceholderKey(v: string | undefined): boolean {
  return !v || v.includes('placeholder') || v.includes('example') || v.includes('dummy') || v.trim() === '';
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

    if (isMock) {
      return this.getMockOffer(listing);
    }

    // Load product + allowlist + oliveyoung seller id (Supabase or mock DB).
    let product: Product | null = null;
    let allowlist: RetailerAllowlist[] = [];
    let oliveyoungSellerId = 1;
    if (isSupabaseServerConfigured()) {
      const { data: pData } = await supabaseServer.from('products').select('*').eq('id', listing.product_id).single();
      if (pData) product = pData;
      const { data: alData } = await supabaseServer.from('retailer_allowlist').select('*').eq('is_active', true);
      if (alData) allowlist = alData;
      const { data: sData } = await supabaseServer.from('sellers').select('id').eq('slug', 'oliveyoung').single();
      if (sData) oliveyoungSellerId = sData.id;
    } else {
      const db = loadMockDB();
      product = db.products.find((p) => p.id === listing.product_id) || null;
      allowlist = db.retailer_allowlist;
      const seller = db.sellers.find((s) => s.slug === 'oliveyoung');
      if (seller) oliveyoungSellerId = seller.id;
    }
    if (!product) throw new Error(`Product not found for ID: ${listing.product_id}`);

    // OliveYoung mallName anchor for Naver matching ('올리브영').
    const allowedStoreName =
      allowlist.find(
        (al) =>
          al.is_active &&
          al.seller_id === oliveyoungSellerId &&
          (al.brand || '').toLowerCase() === (product!.brand || '').toLowerCase()
      )?.allowed_store_name || '올리브영';

    const result = await matchNaverOffer(product, allowedStoreName, clientId as string, clientSecret as string);

    if (!result.matched) {
      // No OliveYoung offer on Naver. Leave the price absent (inStock=true so a
      // manual_override applied later in run.ts can supply it); otherwise the
      // listing is link-only via the curator affiliate_url. No reseller fallback.
      console.warn(`[OliveYoung Adapter] No Naver OliveYoung offer for product ${product.id} (${product.name}): ${result.reason}`);
      return {
        regularPrice: null,
        salePrice: null,
        inStock: true,
        promoType: 'none',
        promoText: null,
        sourceText: `OliveYoung: no Naver offer — ${result.reason} (manual_override or link-only)`,
        storeName: '올리브영',
        matchedUrl: null,
        matchedMallName: null,
        matchExcluded: true,
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
