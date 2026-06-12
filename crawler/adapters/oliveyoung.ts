import { chromium } from 'playwright';
import { Listing, PromoType } from '../../lib/types';
import { PriceOffer, RetailerAdapter } from './index';

export class OliveYoungAdapter implements RetailerAdapter {
  code = 'oliveyoung';

  async fetchOffer(listing: Listing): Promise<PriceOffer> {
    const userAgent = process.env.CRAWLER_USER_AGENT;
    const isMockMode =
      process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
      process.env.CRAWLER_MODE === 'mock' ||
      process.env.NODE_ENV === 'test' ||
      !userAgent ||
      userAgent.includes('placeholder') ||
      userAgent.includes('example') ||
      userAgent.includes('dummy') ||
      userAgent.trim() === '' ||
      (!listing.url.includes('oliveyoung.co.kr') && !listing.url.includes('oy.run'));

    if (isMockMode) {
      console.log(`[Olive Young Scraper] Mock/offline mode enabled. Using mock data for: ${listing.url}`);
      return this.getMockOffer(listing);
    }

    let browser;
    try {
      console.log(`[Olive Young Scraper] Launching Playwright to crawl: ${listing.url}`);
      
      browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--no-first-run',
          '--no-sandbox',
          '--no-zygote',
        ],
      });

      const context = await browser.newContext({
        userAgent: process.env.CRAWLER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      const page = await context.newPage();

      // Optimize page load speed by blocking unnecessary assets
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // Navigate with timeout
      await page.goto(listing.url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // OY sometimes has redirects, wait a bit
      await page.waitForTimeout(1000);

      // Extract details
      const title = await page.title();
      console.log(`[Olive Young Scraper] Loaded page title: ${title}`);

      // Selectors based on Olive Young Web structure
      // Note: OY classes often change, so we try multiple common selectors
      const regularPriceStr = await page.locator('.price-normal, strike, .prd_detail_price .price-normal, .prd_price .tx_org, .price_info .price-normal').first().textContent().catch(() => null);
      let salePriceStr = await page.locator('.price-sale, .price-2, .prd_detail_price .price-2, .prd_price .tx_cur .tx_num, .price_info .price-sale').first().textContent().catch(() => null);
      
      // If salePrice is missing, see if there is any price text
      if (!salePriceStr) {
        salePriceStr = await page.locator('.price-current, .price-1, .price_current, .price, .tx_cur, .tx_num').first().textContent().catch(() => null);
      }

      // Check stock status
      const outOfStockText = await page.locator('.btn-soldout, .sold-out, .btnBuy.disabled').first().textContent().catch(() => null);
      const inStock = !outOfStockText;

      // Check for promotions like 1+1 or 2+1
      const pageText = await page.innerText('body').catch(() => '');
      
      let promoType: PromoType = 'none';
      let promoText: string | null = null;

      if (pageText.includes('1+1') || title.includes('1+1')) {
        promoType = 'buy_x_get_y';
        promoText = '1+1';
      } else if (pageText.includes('2+1') || title.includes('2+1')) {
        promoType = 'buy_x_get_y';
        promoText = '2+1';
      } else if (pageText.includes('올영세일')) {
        promoType = 'sale';
        promoText = '올영세일';
      }

      // Cleanup string and parse integers
      const cleanPrice = (str: string | null): number | null => {
        if (!str) return null;
        const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
        return isNaN(num) ? null : num;
      };

      const regularPrice = cleanPrice(regularPriceStr);
      const salePrice = cleanPrice(salePriceStr);

      await browser.close();

      return {
        regularPrice: regularPrice || salePrice,
        salePrice: salePrice || regularPrice,
        inStock,
        promoType,
        promoText,
        sourceText: `Page title: ${title}. Parsed prices: Regular=${regularPrice}, Sale=${salePrice}`,
      };
    } catch (e: unknown) {
      const err = e as Error;
      console.warn(`[Olive Young Scraper] Crawling failed for ${listing.url}: ${err.message}. Falling back to mock data...`);
      if (browser) {
        await browser.close().catch(() => {});
      }
      // Fail-safe fallback to prevent pipeline crash
      return this.getMockOffer(listing);
    }
  }

  private getMockOffer(listing: Listing): PriceOffer {
    let basePrice = 15400;
    let promoType: PromoType = 'none';
    let promoText: string | null = null;

    if (listing.product_id === 3) {
      basePrice = 15400;
      promoType = 'buy_x_get_y';
      promoText = '1+1 기획';
    } else if (listing.product_id === 4) {
      basePrice = 29000;
    } else if (listing.product_id === 5) {
      basePrice = 12500;
    } else if (listing.product_id === 6) {
      basePrice = 15000;
    } else if (listing.product_id === 7) {
      basePrice = 18500;
    } else if (listing.product_id === 10) {
      basePrice = 21900;
      promoType = 'buy_x_get_y';
      promoText = '1+1 기획';
    } else {
      basePrice = 17000;
    }

    return {
      regularPrice: Math.round(basePrice * 1.25),
      salePrice: basePrice,
      inStock: true,
      promoType,
      promoText,
      sourceText: `Mock fallback response for Olive Young Product ID ${listing.product_id}`,
    };
  }
}
