/**
 * Naver adapter — Shopping Search API (openapi.naver.com/v1/search/shop.json).
 *
 * WHY API, not crawl: brand.naver.com/robots.txt is `User-agent: * Disallow: /`
 * (only facebookexternalhit allowed). Playwright crawling of brand stores is
 * therefore disallowed; the approved path is the Shopping Search API, to which
 * storefront robots rules do not apply.
 *
 * Matching policy (final spec §2):
 *  - Individual mall offers only — never the 가격비교 catalog 대표상품 (its `lprice`
 *    is the all-sellers lowest and may be a reseller).
 *  - Official mall identified by `mallName` vs retailer_allowlist.allowed_store_name
 *    (operator-confirmed, one per brand), normalized + brand-contains fallback.
 *  - Same product verified by title token similarity (+ volume forwarded for the
 *    §1 volume-mismatch gate; volume is NOT a hard reject because DB volume is
 *    unverified per §1b).
 *  - Price (`lprice`) and `link` come from the SAME matched offer.
 *  - No match → exclude from comparison + inspection flag (NO reseller fallback).
 */
import { Listing, Product, RetailerAllowlist } from '../../lib/types';
import { PriceOffer, RetailerAdapter } from './index';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { loadMockDB } from '../../lib/supabase/mockDb';
import { extractPackageFromTitle } from '../core/packageExtractor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface NaverShoppingItem {
  title: string;       // may contain <b>..</b> highlight tags
  link: string;
  lprice: string;
  hprice?: string;
  mallName: string;
  productId: string;
  productType: string; // numeric code as string
  brand?: string;
  maker?: string;
}

export interface OfferMatchInput {
  brand: string | null;
  name: string;
  volumeMl: number | null;
  allowedStoreName: string | null; // retailer_allowlist for this brand+naver, if confirmed
}

export interface OfferMatchResult {
  matched: NaverShoppingItem | null;
  parsedVolumeRaw: number | null; // ml parsed from matched title (forwarded to normalize)
  identityScore: number | null;
  reason: string;
}

// productType: individual mall offers vs price-comparison catalog representative.
// NOTE: the official Naver doc (developers.naver.com) was unreachable from the
// build environment, so this numeric mapping is the widely-used convention and
// is applied only as a SECONDARY hardening filter. The PRIMARY discriminator is
// `mallName` matching the official allowlist (catalog representatives carry
// mallName="네이버" / a /catalog/ link, so they fail the official-mall gate).
// → Operator: confirm this enum against the official docs (spec §10).
//   1 = 가격비교 대표상품(catalog) → exclude;  2,3 = 개별 몰 상품 → include.
const INDIVIDUAL_MALL_PRODUCT_TYPES = new Set(['2', '3']);
const CATALOG_LINK_RE = /(search\.shopping\.naver|\/catalog\/)/i;
const IDENTITY_SCORE_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Pure helpers (testable)
// ---------------------------------------------------------------------------
export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

/** Normalize a mall/store name for tolerant comparison. */
export function normalizeMallName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(공식스토어|공식몰|브랜드스토어|공식|스토어)$/g, '');
}

export function cleanQuery(brand: string | null, name: string): string {
  const cleanBrand = brand ? brand.replace(/\s*\([^)]*\)/g, '').trim() : '';
  const cleanName = name
    .replace(/데일리 유브이/g, '데일리 UV')
    .replace(/스테이 프레쉬/g, '스테이프레쉬')
    .replace(/\s*\d+\s*ml/gi, '')
    .trim();
  return `${cleanBrand} ${cleanName}`.trim();
}

/** Significant tokens of a product name (drop short/numeric/unit-only tokens). */
function significantTokens(s: string): string[] {
  return stripHtml(s)
    .toLowerCase()
    .replace(/spf\s*\d+/gi, ' ')
    .replace(/pa\s*\++/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !/^\d+(ml|g)$/.test(t));
}

/** Fraction of product-name tokens present in the offer title (0..1). */
export function productIdentityScore(title: string, name: string): number {
  const nameTokens = significantTokens(name);
  if (nameTokens.length === 0) return 0;
  const titleNorm = stripHtml(title).toLowerCase().replace(/\s+/g, '');
  const found = nameTokens.filter((t) => titleNorm.includes(t)).length;
  return found / nameTokens.length;
}

// ---------------------------------------------------------------------------
// Single-SKU vs set/bundle/multipack classification (fix/naver-sku-matching).
//
// WHY: matching used to take the highest-relevance official-mall offer passing a
// 0.5 title-similarity gate. For premium/curated products that top offer is
// frequently a 선물세트 / 기획 / 더블팩 / 2종세트 / 1+1·리필 bundle, NOT the curated
// single SKU — so a set price (or a mis-derived per-unit price) was shown as if it
// were the product. productId anchoring is impossible here (the curated
// brand.naver.com / naver.me channel-product-number is a different namespace from
// the Shopping API mall-product links — verified), so the only reliable lever is
// to classify each offer and PREFER a comparable single, EXCLUDING sets/multipacks
// from price comparison (trust-first: show no price rather than a wrong one).
// ---------------------------------------------------------------------------
const SET_KEYWORDS = /(선물\s*세트|기획\s*세트|세트\s*구성|더블\s*기획|더블팩|2종|3종|4종|콜렉션|컬렉션|패키지|한정|리필|세트|디바이스|기기)/;
const MULTIPACK_COUNT = /(\d+)\s*(?:개|팩|병|입|매)/; // \b不可: 한글은 \w가 아님
// Parentheticals that are PURE non-unit freebies (no extra sellable unit) — safe
// to ignore. A "(+...ml ...)" / "(+리필…)" / "(+세럼 7ml*2)" is NOT here: an added
// item that carries its own product is treated as a bundle below.
const PURE_GIFT_PAREN = /\([^)]*(?:쇼핑백|파우치|에코백|키트|사은품|증정품)[^)]*\)/g;

export type OfferComposition = { kind: 'single' | 'set'; reason: string };

/**
 * Classify a Naver offer title as a comparable single unit or a set/multipack.
 * A single 30ml with a pure freebie (쇼핑백/파우치) is still a single; but anything
 * that combines an extra sellable item — a leftover "+" (1+1·리필·세럼+디바이스),
 * a ×N multiplier, an N개/팩 count (N≥2), or a set keyword — is a non-single offer
 * whose listed price is NOT the product's unit price, so it is excluded from
 * comparison (trust-first: show no price rather than a set price).
 */
export function classifyOfferComposition(title: string): OfferComposition {
  const t = stripHtml(title || '')
    .replace(/SPF\s*\d+\+*/gi, ' ') // "SPF50+" must not leave a "+" behind
    .replace(/PA\s*\++/gi, ' ')
    .replace(PURE_GIFT_PAREN, ' ');
  // A surviving "+" joins an extra unit (1+1, +리필, 세럼+디바이스, 토너+세럼) → bundle.
  if (/\+/.test(t)) return { kind: 'set', reason: 'plus-combined extra unit (bundle/refill/set)' };
  if (/[x×*]\s*\d+\b/i.test(t)) return { kind: 'set', reason: '×N multiplier' };
  const cnt = t.match(MULTIPACK_COUNT);
  if (cnt && parseInt(cnt[1], 10) >= 2) return { kind: 'set', reason: `${cnt[1]}-count multipack` };
  if (SET_KEYWORDS.test(t)) return { kind: 'set', reason: 'set/bundle keyword' };
  return { kind: 'single', reason: 'single unit' };
}

export function matchesOfficialMall(
  mallName: string,
  allowedStoreName: string | null,
  brand: string | null
): boolean {
  const nm = normalizeMallName(mallName);
  if (!nm || nm === '네이버') return false; // catalog representative / generic
  if (allowedStoreName) {
    const na = normalizeMallName(allowedStoreName);
    return na.length > 0 && (nm.includes(na) || na.includes(nm));
  }
  // No confirmed allowlist entry → fall back to brand-name containment.
  if (brand) {
    const nb = normalizeMallName(brand.replace(/\s*\([^)]*\)/g, '').split(' ')[0]);
    return nb.length > 0 && nm.includes(nb);
  }
  return false;
}

/** Individual mall offer (not a price-comparison catalog representative). */
export function isIndividualMallOffer(item: NaverShoppingItem): boolean {
  if (item.link && CATALOG_LINK_RE.test(item.link)) return false;
  // Secondary hardening — see INDIVIDUAL_MALL_PRODUCT_TYPES note.
  if (item.productType && !INDIVIDUAL_MALL_PRODUCT_TYPES.has(String(item.productType))) {
    return false;
  }
  return true;
}

/**
 * Select the official-mall offer for a product from Shopping API results.
 * Pure + deterministic so it can be unit-tested without network.
 */
export function pickOfficialOffer(
  items: NaverShoppingItem[],
  input: OfferMatchInput
): OfferMatchResult {
  const individual = items.filter(isIndividualMallOffer);
  if (individual.length === 0) {
    return { matched: null, parsedVolumeRaw: null, identityScore: null, reason: 'no individual-mall offers (only catalog representatives)' };
  }

  const official = individual.filter((it) => matchesOfficialMall(it.mallName, input.allowedStoreName, input.brand));
  if (official.length === 0) {
    return { matched: null, parsedVolumeRaw: null, identityScore: null, reason: 'no offer from the official mall (mallName did not match allowlist/brand)' };
  }

  // Items arrive in relevance order. Gate on product-identity (title tokens),
  // then classify single vs set/multipack. We compare SINGLE units only — a
  // set/기획/더블/2종/1+1 offer is excluded from price comparison (its price is not
  // the product's unit price). Among singles, prefer one whose parsed volume
  // matches the curated DB volume; otherwise take the highest-ranked single.
  const passing = official.filter((it) => productIdentityScore(it.title, input.name) >= IDENTITY_SCORE_THRESHOLD);
  if (passing.length === 0) {
    return { matched: null, parsedVolumeRaw: null, identityScore: null, reason: `official mall offer(s) found but title similarity < ${IDENTITY_SCORE_THRESHOLD}` };
  }

  const parsedVolOf = (it: NaverShoppingItem): number | null => {
    const ext = extractPackageFromTitle(stripHtml(it.title));
    return ext.detected && ext.unitType === 'ml' && ext.unitAmount !== null ? ext.unitAmount : null;
  };

  const singles = passing.filter((it) => classifyOfferComposition(it.title).kind === 'single');
  if (singles.length === 0) {
    // Only set/bundle/multipack official offers exist → no comparable single SKU.
    // Trust-first: exclude (link-only) rather than surface a set price as the unit price.
    const why = classifyOfferComposition(passing[0].title).reason;
    return {
      matched: null,
      parsedVolumeRaw: null,
      identityScore: null,
      reason: `official mall offer(s) found but only set/bundle/multipack (${why}) — excluded from comparison (no comparable single SKU)`,
    };
  }

  // Prefer a single whose volume matches the curated DB volume (when both known);
  // else the highest-relevance single. Volume stays non-blocking otherwise (§1b).
  const volumeMatch = input.volumeMl != null ? singles.find((it) => parsedVolOf(it) === input.volumeMl) : undefined;
  const chosen = volumeMatch ?? singles[0];
  const score = productIdentityScore(chosen.title, input.name);
  return {
    matched: chosen,
    parsedVolumeRaw: parsedVolOf(chosen),
    identityScore: score,
    reason: `matched official mall "${chosen.mallName}" single SKU (identity ${score.toFixed(2)}${volumeMatch ? ', volume-matched' : ''})`,
  };
}

// ---------------------------------------------------------------------------
// Shared search + match (reused by NaverAdapter and OliveYoungAdapter)
// ---------------------------------------------------------------------------
function isPlaceholderKey(v: string | undefined): boolean {
  return !v || v.includes('placeholder') || v.includes('example') || v.includes('dummy') || v.trim() === '';
}

// Per-process cache keyed by query string. A product's brand-official-store
// listing and its OliveYoung listing build the SAME candidate queries (same
// brand+name), so the OliveYoung match reuses the brand-store search results —
// one Shopping API call per product, not one per listing (spec §2.2). Lifetime
// is a single pipeline run (run.ts is one-shot); clear explicitly when needed.
const naverSearchCache = new Map<string, NaverShoppingItem[]>();
export function clearNaverSearchCache(): void {
  naverSearchCache.clear();
}

async function searchNaverShopping(
  query: string,
  clientId: string,
  clientSecret: string
): Promise<NaverShoppingItem[]> {
  const cached = naverSearchCache.get(query);
  if (cached) return cached;
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=40`;
  const res = await fetch(url, {
    headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
  });
  if (!res.ok) throw new Error(`Naver Shopping API request failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  const items: NaverShoppingItem[] = data.items || [];
  naverSearchCache.set(query, items);
  return items;
}

export interface NaverProductLike {
  brand: string | null;
  name: string;
  volume_ml?: number | null;
}

/**
 * Search the Shopping API for a product (broad → narrow queries, stop at first
 * match) and pick the offer from the given official mall (`allowedStoreName`).
 * Same matcher for a brand store and for OliveYoung — only the mall differs.
 */
export async function matchNaverOffer(
  product: NaverProductLike,
  allowedStoreName: string | null,
  clientId: string,
  clientSecret: string
): Promise<OfferMatchResult> {
  const brandWord = product.brand ? product.brand.split(' ')[0] : '';
  const nameWord = product.name ? product.name.split(' ')[0] : '';
  const candidates = Array.from(
    new Set([cleanQuery(product.brand, product.name), `${brandWord} ${nameWord}`].filter((c) => c.length > 0))
  );

  const input: OfferMatchInput = {
    brand: product.brand,
    name: product.name,
    volumeMl: product.volume_ml ?? null,
    allowedStoreName,
  };

  let result: OfferMatchResult = { matched: null, parsedVolumeRaw: null, identityScore: null, reason: 'no queries produced results' };
  for (const query of candidates) {
    const items = await searchNaverShopping(query, clientId, clientSecret);
    result = pickOfficialOffer(items, input);
    if (result.matched) break;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class NaverAdapter implements RetailerAdapter {
  code = 'naver';

  async fetchOffer(listing: Listing): Promise<PriceOffer> {
    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;
    const isMock =
      process.env.VIEWTYPICK_MOCK_MODE === 'true' ||
      process.env.CRAWLER_MODE === 'mock' ||
      isPlaceholderKey(clientId) ||
      isPlaceholderKey(clientSecret);

    // Load product + allowlist + naver seller id (Supabase or mock DB).
    let product: Product | null = null;
    let allowlist: RetailerAllowlist[] = [];
    let naverSellerId = 4;
    if (isSupabaseServerConfigured()) {
      const { data: pData } = await supabaseServer.from('products').select('*').eq('id', listing.product_id).single();
      if (pData) product = pData;
      const { data: alData } = await supabaseServer.from('retailer_allowlist').select('*').eq('is_active', true);
      if (alData) allowlist = alData;
      const { data: sData } = await supabaseServer.from('sellers').select('id').eq('slug', 'naver').single();
      if (sData) naverSellerId = sData.id;
    } else {
      const db = loadMockDB();
      product = db.products.find((p) => p.id === listing.product_id) || null;
      allowlist = db.retailer_allowlist;
      const seller = db.sellers.find((s) => s.slug === 'naver');
      if (seller) naverSellerId = seller.id;
    }
    if (!product) throw new Error(`Product not found for ID: ${listing.product_id}`);

    const allowedStoreName =
      allowlist.find(
        (al) =>
          al.is_active &&
          al.seller_id === naverSellerId &&
          (al.brand || '').toLowerCase() === (product!.brand || '').toLowerCase()
      )?.allowed_store_name || null;

    if (isMock) {
      // Dev/CI fallback: synthesize an OFFICIAL-mall offer (never a reseller).
      const storeName = allowedStoreName || `${(product.brand || '').split(' ')[0]} 공식스토어`;
      return {
        regularPrice: null,
        salePrice: 19900,
        inStock: true,
        promoType: 'none',
        promoText: null,
        sourceText: `[mock] Naver API official-mall offer for product ${product.id}`,
        storeName,
        matchedUrl: listing.url || null,
        matchedMallName: storeName,
      };
    }

    // Search the Shopping API and pick the brand official-store offer.
    const result = await matchNaverOffer(product, allowedStoreName, clientId as string, clientSecret as string);

    if (!result.matched) {
      // Exclude from comparison + flag for inspection. No reseller fallback.
      console.warn(`[Naver Adapter] No official-mall match for product ${product.id} (${product.name}): ${result.reason}`);
      return {
        regularPrice: null,
        salePrice: null, // healthcheck Rule 1 → failed → excluded from comparison
        inStock: false,
        promoType: 'none',
        promoText: null,
        sourceText: `Naver API: excluded — ${result.reason}`,
        storeName: null,
        matchedUrl: null,
        matchedMallName: null,
        matchExcluded: true,
        // Search SUCCEEDED but no official-mall offer exists → not a failure.
        outcome: 'no_offer',
      };
    }

    const item = result.matched;
    const parsedPrice = parseInt(item.lprice, 10);
    if (isNaN(parsedPrice)) throw new Error(`Failed to parse Naver price "${item.lprice}"`);

    return {
      regularPrice: null, // Shopping API returns only the lowest price (lprice)
      salePrice: parsedPrice,
      inStock: true,
      promoType: 'none',
      promoText: null,
      sourceText: `Naver API match: ${stripHtml(item.title)} (${item.productId})`,
      storeName: allowedStoreName || item.mallName,
      parsedVolumeRaw: result.parsedVolumeRaw,
      matchedUrl: item.link || null,
      matchedMallName: item.mallName || null,
      outcome: 'ok',
    };
  }
}
