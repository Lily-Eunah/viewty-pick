/**
 * OliveYoung adapter — NO direct crawling (compliant).
 *
 * WHY no crawl: oliveyoung.co.kr robots.txt is `User-agent: * → Disallow: /`
 * (content paths are whitelisted only for search/AI bots) and the storefront is
 * behind a WAF that returns 403 to automated clients. UA spoofing is rejected.
 * There is also no public OliveYoung price API. The only compliant automated
 * path to an OliveYoung price is reading the OliveYoung offer that surfaces on
 * the approved Naver Shopping Search API (OliveYoung = "just another official
 * mall"). We never request oliveyoung.co.kr.
 *
 * The Playwright crawler that used to live here has been retired. The Naver-
 * sourced offer matching is added on top of this skeleton (see naver.ts
 * `pickOfficialOffer`). Until then, live mode yields a link-only (excluded)
 * offer — the curator affiliate_url is still the buy button via the redirect
 * route; only the price is absent.
 */
import { Listing, PromoType } from '../../lib/types';
import { PriceOffer, RetailerAdapter } from './index';

export class OliveYoungAdapter implements RetailerAdapter {
  code = 'oliveyoung';

  async fetchOffer(listing: Listing): Promise<PriceOffer> {
    const isMockMode =
      process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
      process.env.CRAWLER_MODE === 'mock' ||
      process.env.NODE_ENV === 'test';

    if (isMockMode) {
      return this.getMockOffer(listing);
    }

    // Live mode: the Naver-sourced price path is wired in a later commit. For now
    // OliveYoung yields no price (link-only); the curator affiliate_url remains
    // the buy button. No oliveyoung.co.kr request is ever made.
    return {
      regularPrice: null,
      salePrice: null,
      inStock: true,
      promoType: 'none',
      promoText: null,
      sourceText: 'OliveYoung: link-only (Naver-sourced price not yet available)',
      storeName: '올리브영',
      matchedUrl: null,
      matchedMallName: null,
      matchExcluded: true,
    };
  }

  private getMockOffer(listing: Listing): PriceOffer {
    const MOCK_PRICES: Record<number, number> = { 3: 15400, 4: 29000, 5: 12500, 6: 15000, 7: 18500 };
    const basePrice = MOCK_PRICES[listing.product_id] ?? 17000;
    const promoType: PromoType = 'none';

    // Mock represents a Naver-sourced OliveYoung official-mall offer.
    return {
      regularPrice: null,
      salePrice: basePrice,
      inStock: true,
      promoType,
      promoText: null,
      sourceText: `[mock] Naver-sourced OliveYoung offer for product ${listing.product_id}`,
      storeName: '올리브영',
      matchedUrl: listing.affiliate_url || listing.url || null,
      matchedMallName: '올리브영',
    };
  }
}
