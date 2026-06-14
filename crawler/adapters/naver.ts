import { chromium } from 'playwright';
import { Listing, Product, RetailerAllowlist, PromoType } from '../../lib/types';
import { PriceOffer, RetailerAdapter } from './index';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { loadMockDB } from '../../lib/supabase/mockDb';

// ---------------------------------------------------------------------------
// Selectors — Naver Smart Store / Brand Store (JS-rendered React app)
// These are best-effort and may need updating if Naver changes its HTML.
// ---------------------------------------------------------------------------
const SELECTORS = {
  salePrice: [
    '[class*="price_num"]',
    '._1LY7DqCnwR',
    '.price_num',
    '[data-nclick*="price"]',
    '.price-2',
    '.salePrice',
  ],
  regularPrice: [
    '.price_original',
    '.original_price',
    '[class*="original"]',
    '.price-1',
    'del',
  ],
  productTitle: [
    'h3.product_name',
    'h3[class*="product_name"]',
    '._3hnWml',
    '.product_title',
    '[class*="productName"]',
    'h1[class*="name"]',
  ],
  storeName: [
    '.shopname',
    'a[class*="shopname"]',
    '._3K8PNsJKNX',
    '.corp_name',
    '[class*="storeName"]',
    '[class*="shopName"]',
  ],
  promoText: [
    '.benefit_item',
    '[class*="benefit_item"]',
    '[class*="benefitItem"]',
    '.promotion_text',
    '[class*="prd_benefit"]',
    '.option_price_info',
  ],
  shipping: [
    '.delivery_fee',
    '[class*="delivery"]',
    '.free_delivery',
    '[class*="shipping"]',
    '.ship_info',
  ],
  outOfStock: [
    '.btn-soldout',
    '.sold_out',
    '[class*="soldOut"]',
    'button[disabled][class*="buy"]',
  ],
};

// ---------------------------------------------------------------------------
// Raw page data (extracted by Playwright — kept separate for testability)
// ---------------------------------------------------------------------------
export interface NaverRawPageContent {
  titleText: string | null;
  salePriceText: string | null;
  regularPriceText: string | null;
  storeNameText: string | null;
  promoTexts: string[];
  shippingText: string | null;
  outOfStock: boolean;
  pageUrl: string;
}

// ---------------------------------------------------------------------------
// Pure parsing function — testable without Playwright
// ---------------------------------------------------------------------------
export function parseNaverPageContent(
  raw: NaverRawPageContent,
  allowlist: RetailerAllowlist[],
  naverSellerId: number,
  product: Product | null
): PriceOffer {
  // Parse sale price
  const salePrice = parseKoreanPrice(raw.salePriceText);
  const regularPrice = parseKoreanPrice(raw.regularPriceText);

  // Detect promotion from promo texts
  let promoType: PromoType = 'none';
  let promoText: string | null = null;

  for (const text of raw.promoTexts) {
    const normalized = text.trim();

    if (/1\s*\+\s*1/.test(normalized)) {
      promoType = 'buy_x_get_y';
      promoText = '1+1';
      break;
    }
    if (/2\s*\+\s*1/.test(normalized)) {
      promoType = 'buy_x_get_y';
      promoText = '2+1';
      break;
    }
    if (/(\d+)\s*\+\s*(\d+)/.test(normalized)) {
      const m = normalized.match(/(\d+)\s*\+\s*(\d+)/);
      if (m) {
        promoType = 'buy_x_get_y';
        promoText = `${m[1]}+${m[2]}`;
        break;
      }
    }
    if (/(\d+)개.*?(\d+)%\s*할인/.test(normalized)) {
      promoType = 'quantity_discount';
      promoText = normalized;
      break;
    }
    // Conditional promos: label only
    if (/쿠폰|즉시할인쿠폰/.test(normalized)) {
      promoType = 'coupon';
      promoText = normalized;
      // Keep searching — a buy_x_get_y might still follow
    }
    if (/멤버십|네이버플러스/.test(normalized) && promoType === 'none') {
      promoType = 'membership';
      promoText = normalized;
    }
    if (/앱(전용|할인|가)?/.test(normalized) && promoType === 'none') {
      promoType = 'app_only';
      promoText = normalized;
    }
  }

  // Extract volume from title
  const parsedVolumeRaw = extractVolumeFromTitle(raw.titleText);

  // Shipping label
  const shippingNote = parseShippingLabel(raw.shippingText);

  // Store name and allowlist check
  let storeName = raw.storeNameText?.trim() ?? null;
  if (storeName && allowlist.length > 0 && product?.brand) {
    const brandAllowlist = allowlist.filter(
      (al) =>
        al.seller_id === naverSellerId &&
        al.is_active &&
        al.brand.toLowerCase() === product.brand?.toLowerCase()
    );
    if (brandAllowlist.length > 0) {
      const match = brandAllowlist.find(
        (al) =>
          storeName!.toLowerCase().includes(al.allowed_store_name.toLowerCase()) ||
          al.allowed_store_name.toLowerCase().includes(storeName!.toLowerCase())
      );
      if (match) {
        storeName = match.allowed_store_name;
      }
      // If not matched, keep raw name — healthcheck will flag it
    }
  }

  return {
    regularPrice,
    salePrice,
    inStock: !raw.outOfStock && salePrice !== null,
    promoType,
    promoText,
    sourceText: raw.titleText,
    storeName,
    parsedVolumeRaw,
    shippingNote,
  };
}

// ---------------------------------------------------------------------------
// Playwright scraping (returns NaverRawPageContent)
// ---------------------------------------------------------------------------
async function checkRobotsTxt(baseUrl: string): Promise<boolean> {
  try {
    const url = new URL(baseUrl);
    const robotsUrl = `${url.protocol}//${url.host}/robots.txt`;
    const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return true; // No robots.txt → allowed

    const text = await res.text();
    // Look for disallow rules targeting our user agent or all agents
    const lines = text.split('\n');
    let applies = false;
    for (const line of lines) {
      const l = line.trim().toLowerCase();
      if (l.startsWith('user-agent:')) {
        const ua = l.replace('user-agent:', '').trim();
        applies = ua === '*' || ua === 'viewtypickbot';
      }
      if (applies && l.startsWith('disallow:')) {
        const path = l.replace('disallow:', '').trim();
        if (path === '/' || url.pathname.startsWith(path)) {
          console.warn(`[Naver Adapter] robots.txt disallows crawling ${url.pathname}`);
          return false;
        }
      }
    }
    return true;
  } catch {
    return true; // Cannot fetch robots.txt → proceed
  }
}

async function randomDelay(): Promise<void> {
  const ms = 2000 + Math.random() * 3000; // 2–5s
  await new Promise((r) => setTimeout(r, ms));
}

async function scrapeNaverPage(url: string): Promise<NaverRawPageContent> {
  const allowed = await checkRobotsTxt(url);
  if (!allowed) {
    throw new Error(`robots.txt disallows crawling: ${url}`);
  }

  await randomDelay();

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox', '--no-zygote'],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        process.env.CRAWLER_USER_AGENT ||
        'Mozilla/5.0 (compatible; ViewtyPickBot/1.0; +https://viewtypick.com/bot)',
    });
    const page = await context.newPage();

    // Block heavy assets — only fetch price/promo text
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Wait for price element to render (JS-heavy store)
    await page.waitForTimeout(2000);

    const tryText = async (selectors: string[]): Promise<string | null> => {
      for (const sel of selectors) {
        const text = await page.locator(sel).first().textContent({ timeout: 1500 }).catch(() => null);
        if (text?.trim()) return text.trim();
      }
      return null;
    };

    const promoElements = await page.locator(SELECTORS.promoText.join(', ')).allTextContents().catch(() => []);
    const outOfStockEl = await page.locator(SELECTORS.outOfStock.join(', ')).first().isVisible({ timeout: 1000 }).catch(() => false);

    const raw: NaverRawPageContent = {
      titleText: await tryText(SELECTORS.productTitle),
      salePriceText: await tryText(SELECTORS.salePrice),
      regularPriceText: await tryText(SELECTORS.regularPrice),
      storeNameText: await tryText(SELECTORS.storeName),
      promoTexts: promoElements.filter(Boolean),
      shippingText: await tryText(SELECTORS.shipping),
      outOfStock: outOfStockEl,
      pageUrl: page.url(),
    };

    console.log(`[Naver Adapter] Scraped: salePrice="${raw.salePriceText}" store="${raw.storeNameText}" promos=${raw.promoTexts.length}`);
    return raw;
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Helper parsers
// ---------------------------------------------------------------------------
function parseKoreanPrice(text: string | null): number | null {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const val = parseInt(digits, 10);
  return isNaN(val) ? null : val;
}

function extractVolumeFromTitle(title: string | null): number | null {
  if (!title) return null;
  // Match patterns like "60ml", "200mL", "1.5L" (convert to ml)
  const mlMatch = title.match(/(\d+(?:\.\d+)?)\s*ml/i);
  if (mlMatch) return parseFloat(mlMatch[1]);
  const lMatch = title.match(/(\d+(?:\.\d+)?)\s*L(?!\w)/i);
  if (lMatch) return parseFloat(lMatch[1]) * 1000;
  return null;
}

function parseShippingLabel(text: string | null): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t) return null;
  if (/무료/.test(t)) {
    if (/조건|이상/.test(t)) return '조건부 무료';
    return '무료배송';
  }
  const feeMatch = t.match(/(\d[\d,]*)\s*원/);
  if (feeMatch) return `${parseInt(feeMatch[1].replace(/,/g, ''), 10).toLocaleString('ko-KR')}원`;
  return t.slice(0, 30) || null;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
export class NaverAdapter implements RetailerAdapter {
  code = 'naver';

  async fetchOffer(listing: Listing): Promise<PriceOffer> {
    const isMock =
      process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
      process.env.CRAWLER_MODE === 'mock' ||
      process.env.NODE_ENV === 'test';

    if (isMock) {
      console.log(`[Naver Adapter] Mock mode — returning fixture for listing ${listing.id}`);
      return this._mockOffer(listing);
    }

    // Load supporting data (product + allowlist)
    let product: Product | null = null;
    let allowlist: RetailerAllowlist[] = [];
    let naverSellerId = 3;

    if (isSupabaseServerConfigured()) {
      const { data: pData } = await supabaseServer.from('products').select('*').eq('id', listing.product_id).single();
      if (pData) product = pData;
      const { data: alData } = await supabaseServer.from('retailer_allowlist').select('*').eq('is_active', true);
      if (alData) allowlist = alData;
      const { data: sData } = await supabaseServer.from('sellers').select('id').eq('slug', 'naver').single();
      if (sData) naverSellerId = sData.id;
    } else {
      const db = loadMockDB();
      product = db.products.find((p) => p.id === listing.product_id) ?? null;
      allowlist = db.retailer_allowlist;
      const seller = db.sellers.find((s) => s.slug === 'naver');
      if (seller) naverSellerId = seller.id;
    }

    const url = listing.url;
    if (!url.includes('smartstore.naver.com') && !url.includes('brand.naver.com')) {
      throw new Error(`[Naver Adapter] URL does not look like a Naver official store: ${url}`);
    }

    const raw = await scrapeNaverPage(url);
    return parseNaverPageContent(raw, allowlist, naverSellerId, product);
  }

  private _mockOffer(listing: Listing): PriceOffer {
    const priceMap: Record<number, number> = {
      1: 21500,
      2: 18000,
      4: 28500,
      5: 12900,
      6: 14500,
      7: 18900,
    };
    const basePrice = priceMap[listing.product_id] ?? 16000;
    return {
      regularPrice: Math.round(basePrice * 1.15),
      salePrice: basePrice,
      inStock: true,
      promoType: 'none',
      promoText: null,
      sourceText: `Mock Naver response for product ${listing.product_id}`,
      storeName: listing.store_name ?? '네이버 공식스토어',
      parsedVolumeRaw: null,
      shippingNote: null,
    };
  }
}
