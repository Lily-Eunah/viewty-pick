import { Listing, Product, RetailerAllowlist } from '../../lib/types';
import { PriceOffer, RetailerAdapter } from './index';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { loadMockDB } from '../../lib/supabase/mockDb';

function cleanQuery(brand: string | null, name: string): string {
  const cleanBrand = brand ? brand.replace(/\s*\([^)]*\)/g, '').trim() : '';
  const cleanName = name
    .replace(/데일리 유브이/g, '데일리 UV')
    .replace(/스테이 프레쉬/g, '스테이프레쉬')
    .replace(/\s*\d+ml/gi, '')
    .trim();
  return `${cleanBrand} ${cleanName}`.trim();
}

function extractNaverProductId(url: string): string | null {
  const match = url.match(/\/products\/(\d+)/) || url.match(/\/catalog\/(\d+)/) || url.match(/channelProductNo=(\d+)/);
  return match ? match[1] : null;
}

async function resolveNaverUrl(url: string): Promise<string> {
  if (url.includes('naver.me')) {
    try {
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      return response.url || url;
    } catch (e) {
      console.warn(`[Naver Adapter] Failed to resolve redirect for ${url}:`, e);
    }
  }
  return url;
}

export class NaverAdapter implements RetailerAdapter {
  code = 'naver';

  async fetchOffer(listing: Listing): Promise<PriceOffer> {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    const isMock =
      process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
      process.env.CRAWLER_MODE === 'mock' ||
      !clientId ||
      clientId.includes('placeholder') ||
      clientId.includes('example') ||
      clientId.includes('dummy') ||
      clientId.trim() === '' ||
      !clientSecret ||
      clientSecret.includes('placeholder') ||
      clientSecret.includes('example') ||
      clientSecret.includes('dummy') ||
      clientSecret.trim() === '';

    if (isMock) {
      // Mock Fallback (Seed values for Naver listings)
      console.log(`[Naver Adapter] Keys missing/mock mode enabled. Generating mock price for URL: ${listing.url}`);

      let basePrice = 21500;
      let storeName = listing.store_name || '네이버 공식스토어';

      if (listing.product_id === 1) {
        basePrice = 21500;
        storeName = '몽디에스 공식스토어';
      } else if (listing.product_id === 2) {
        basePrice = 18000;
        storeName = '동화약품 공식몰';
      } else if (listing.product_id === 4) {
        basePrice = 28500;
        storeName = '아로셀 공식스토어';
      } else if (listing.product_id === 5) {
        basePrice = 12900;
        storeName = '이니스프리 공식스토어';
      } else if (listing.product_id === 6) {
        basePrice = 14500;
        storeName = '조선미녀 공식스토어';
      } else if (listing.product_id === 7) {
        basePrice = 18900;
        storeName = '넘버즈인 공식스토어';
      } else {
        basePrice = 16000;
      }

      return {
        regularPrice: Math.round(basePrice * 1.15),
        salePrice: basePrice,
        inStock: true,
        promoType: 'none',
        promoText: null,
        sourceText: `Mock Naver response for Product ID ${listing.product_id}`,
        storeName,
      };
    }

    try {
      console.log(`[Naver Adapter] Querying Naver Shopping API for URL: ${listing.url}`);

      // 1. Fetch product, Naver seller ID, and allowlist info
      let product: Product | null = null;
      let allowlist: RetailerAllowlist[] = [];
      let naverSellerId = 3;
      const useSupabase = isSupabaseServerConfigured();

      if (useSupabase) {
        const { data: pData } = await supabaseServer.from('products').select('*').eq('id', listing.product_id).single();
        if (pData) product = pData;
        const { data: alData } = await supabaseServer.from('retailer_allowlist').select('*').eq('is_active', true);
        if (alData) allowlist = alData;
        const { data: sData } = await supabaseServer.from('sellers').select('id').eq('slug', 'naver').single();
        if (sData) naverSellerId = sData.id;
      } else {
        const db = loadMockDB();
        const pData = db.products.find(p => p.id === listing.product_id);
        if (pData) product = pData;
        allowlist = db.retailer_allowlist;
        const seller = db.sellers.find(s => s.slug === 'naver');
        if (seller) naverSellerId = seller.id;
      }

      if (!product) {
        throw new Error(`Product not found for ID: ${listing.product_id}`);
      }

      // 2. Resolve URL and extract target product ID
      const resolvedUrl = await resolveNaverUrl(listing.url);
      const targetProductId = extractNaverProductId(resolvedUrl);

      if (!targetProductId) {
        throw new Error(`Could not extract Naver product ID from URL: ${resolvedUrl}`);
      }

      // 3. Build candidate search queries
      const brandWord = product.brand ? product.brand.split(' ')[0] : '';
      const nameWord = product.name ? product.name.split(' ')[0] : '';
      
      const candidates = [
        cleanQuery(product.brand, product.name),
        `${brandWord} ${product.name.replace(/데일리 유브이|스테이 프레쉬/g, m => m === '데일리 유브이' ? '데일리 UV' : '스테이프레쉬')}`,
        `${brandWord} ${nameWord}`,
      ];

      // Remove duplicates
      const uniqueCandidates = Array.from(new Set(candidates)).filter(c => c.length > 0);

      interface NaverShoppingItem {
        title: string;
        link: string;
        lprice: string;
        mallName: string;
        productId: string;
      }

      let matchedItem: NaverShoppingItem | null = null;

      // 4. Query API for each candidate until we find a match
      for (const query of uniqueCandidates) {
        const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=40`;
        const res = await fetch(url, {
          headers: {
            'X-Naver-Client-Id': clientId,
            'X-Naver-Client-Secret': clientSecret,
          }
        });

        if (!res.ok) {
          throw new Error(`Naver Shopping API request failed: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        const items: NaverShoppingItem[] = data.items || [];

        matchedItem = items.find((item: NaverShoppingItem) => {
          const itemUrl = item.link || '';
          return itemUrl.includes(targetProductId) || item.productId === targetProductId;
        }) || null;

        if (matchedItem) {
          break;
        }
      }

      if (!matchedItem) {
        throw new Error(`No matching Naver Shopping listing found for target product ID: ${targetProductId}`);
      }

      // 5. Determine store name and normalize it with allowlist
      let storeName = matchedItem.mallName;
      if (allowlist && allowlist.length > 0) {
        const brandAllowlist = allowlist.filter(
          al => al.seller_id === naverSellerId && al.is_active && al.brand.toLowerCase() === product!.brand?.toLowerCase()
        );
        const allowed = brandAllowlist.find(
          al =>
            matchedItem.mallName.toLowerCase().includes(al.allowed_store_name.toLowerCase()) ||
            al.allowed_store_name.toLowerCase().includes(matchedItem.mallName.toLowerCase())
        );
        if (allowed) {
          storeName = allowed.allowed_store_name;
        }
      }

      const parsedPrice = parseInt(matchedItem.lprice, 10);
      if (isNaN(parsedPrice)) {
        throw new Error(`Failed to parse price "${matchedItem.lprice}" as integer`);
      }

      return {
        regularPrice: null, // Naver Open API only returns lowest price
        salePrice: parsedPrice,
        inStock: true,
        promoType: 'none',
        promoText: null,
        sourceText: `Naver Open API match: ${matchedItem.title.replace(/<[^>]*>/g, '')} (${matchedItem.productId})`,
        storeName,
      };

    } catch (e: unknown) {
      console.error(`[Naver Adapter] Error crawling ${listing.url}:`, e);
      throw e;
    }
  }
}

