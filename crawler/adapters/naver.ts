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
 *  - Same product verified by title token similarity. Volume is NEVER a reject
 *    (per-retailer size allowed): a parsed volume is forwarded to normalize so
 *    ml당 is computed from the listing's own size, not the DB volume.
 *  - Price (`lprice`) and `link` come from the SAME matched offer.
 *  - No match → exclude from comparison + inspection flag (NO reseller fallback).
 */
import { Listing, Product, RetailerAllowlist } from '../../lib/types';
import { PriceOffer, RetailerAdapter } from './index';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { loadMockDB } from '../../lib/supabase/mockDb';
import { extractPackageFromTitle, stripPromoGifts, isBareNJong } from '../core/packageExtractor';
import { goodsNoFromOyOfferLink } from '../core/oliveyoungAnchor';
import { crawlNaverPagePrice, isNaverStorefrontUrl } from '../core/naverPageCrawl';

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
  // True when an anchored/matched SKU combines two DIFFERENT products (heterogeneous
  // set) → per-unit price not computable → excluded for operator inspection.
  needsInspection?: boolean;
  // Price hint for a needsInspection candidate (e.g. the low-confidence band's
  // lprice). null/absent when no price is derivable (heterogeneous set price) →
  // the inspection tab row is left blank for the operator to fill before O.
  inspectionEstimatedPrice?: number | null;
  // Set when this match came from a NON-ANCHORED anchor-miss fallback (not the
  // curated SKU): 'official-store' = an official Naver brand-store offer matched by
  // mallName. (The 가격비교 catalog lprice fallback was removed — reseller/non-official
  // prices rarely matched the operator's link → anchor-miss w/o official store = link-only.)
  // Surfaced as warning (inspection) — see NaverAdapter.fetchOffer + healthcheck.
  fallbackTier?: 'official-store';
  // True → route this priced match to the Discord set/구성 verify line (informational,
  // does NOT block the price): a bare "N종" option-select, OR a 본품+소량 부스트 that was
  // add-on-stripped (case C). The price IS shown; the operator confirms set-vs-단품.
  nJongVerify?: boolean;
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
const SET_KEYWORDS = /(선물\s*세트|기획\s*세트|세트\s*구성|더블\s*기획|더블팩|콜렉션|컬렉션|패키지|한정|리필|세트|디바이스|기기|업소용|도매|벌크)/;
const MULTIPACK_COUNT = /(\d+)\s*(?:개|팩|병|입|매)/; // \b不可: 한글은 \w가 아님

// "N종" (2종/3종/4종) is, on its own, almost always an OPTION-SELECT page ("N종 중
// 택1" → 단품 구매), NOT a physical set — so a BARE "N종" stays a comparable single
// (옵션선택 → 정상 가격). Evidence-based (fix/set-classification-evidence-based): it
// counts as a set ONLY when an explicit set COMPOUND is present (선물세트/기획세트/세트
// 구성/패키지/콜렉션 — via SET_KEYWORDS); an ambiguous "기획 3종"/"선물 2종" is a single.
// isBareNJong (packageExtractor) flags a bare "N종" for the Discord set-vs-option check.

/**
 * True when an offer title carries a BARE "N종" — i.e. an "N종 중 택1" option-select
 * marker NOT accompanied by a set-context word. Such offers ARE priced (single), but
 * are surfaced to Discord for a manual set-vs-option check in case a genuine set
 * slipped through as 단독 "N종". A "N종 세트/구성/기획…" returns false here (already
 * classified as a set / heterogeneous upstream, never priced).
 */
export function containsBareNJong(title: string): boolean {
  return isBareNJong(stripHtml(title || ''));
}

// Product form/type nouns. Used to reject same-line cross-product matches: if the
// curated name's form noun (e.g. 올인원/선스틱/로션) is ABSENT from the candidate
// title and the title carries a DIFFERENT form noun (e.g. 크림), it is a different
// SKU in the same line — exclude (trust-first). Longer/compound forms first so a
// "선크림" isn't reduced to "크림".
const FORM_TOKENS = [
  '올인원', '선크림', '선스틱', '선세럼', '선쿠션', '선밤', '클렌징폼', '클렌징오일', '클렌징젤',
  '클렌저', '클렌징', '에멀전', '쿠션', '크림', '로션', '세럼', '앰플', '에센스', '토너', '스킨',
  '미스트', '오일', '젤', '폼', '밤', '패드', '마스크', '파우더', '스틱', '밤',
];
function formNounsIn(s: string): string[] {
  const n = stripHtml(s || '').toLowerCase().replace(/\s+/g, '');
  return FORM_TOKENS.filter((t) => n.includes(t));
}
/**
 * True when the candidate is a DIFFERENT form/type within the same product line —
 * the curated name's form noun(s) appear nowhere in the title while the title has
 * its own form noun (e.g. curated "…포맨 올인원" vs candidate "…클리어 수딩 크림").
 * Conservative: returns false when either side has no recognizable form noun.
 */
export function hasFormConflict(name: string, title: string): boolean {
  const nf = formNounsIn(name);
  const tf = formNounsIn(title);
  if (nf.length === 0 || tf.length === 0) return false;
  return !nf.some((t) => tf.includes(t));
}
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
  // Evidence-based (fix/set-classification-evidence-based): a "N종" makes an offer a
  // set ONLY through an explicit set COMPOUND in SET_KEYWORDS (선물세트/기획세트/세트
  // 구성/패키지/콜렉션/세트…). A bare "기획 3종" / "선물 2종" carries no such word → it
  // falls through to a single (대개 'N종 중 택1' 옵션선택), surfaced to Discord verify.
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

  // A comparable single = classified single AND not a same-line different form
  // (e.g. curated "…올인원" must not match "…수딩 크림").
  const singles = passing.filter(
    (it) => classifyOfferComposition(it.title).kind === 'single' && !hasFormConflict(input.name, it.title)
  );
  if (singles.length === 0) {
    // Only sets/multipacks or different-form SKUs exist → no comparable single.
    // Trust-first: exclude (link-only) rather than surface a wrong/set price.
    const top = passing[0];
    const why = hasFormConflict(input.name, top.title) ? 'different form/variant in same line' : classifyOfferComposition(top.title).reason;
    return {
      matched: null,
      parsedVolumeRaw: null,
      identityScore: null,
      reason: `official mall offer(s) found but no comparable single SKU (${why}) — excluded from comparison`,
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
// Tier-1: link-id anchoring to the operator-curated SKU.
//
// Experiment (docs/worklog/naver-id-anchor-experiment.md): the Shopping API's
// item.productId never equals the curated channel-product-number, but the result
// item's LINK resolves to /products/{N} in ~60% of listings. So we anchor on the
// curated URL's N matched against each result's link — that result IS the exact
// curated SKU, eliminating variant/cross-product/set mis-selection. When the
// curated SKU is itself a set/multipack (operator linked a set page), we exclude
// it (trust-first) and flag it for sheet-URL cleanup.
// ---------------------------------------------------------------------------
/** Channel-product number from a Naver URL/link (/products/{N} or channelProductNo=). */
export function productNoFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  const p = url.match(/\/products\/(\d+)/);
  if (p) return p[1];
  const c = url.match(/channelProductNo=(\d+)/);
  if (c) return c[1];
  return null;
}

// Resolve the curated listing URL → channel-product number. brand.naver.com /
// smartstore carry it directly; naver.me shortlinks need ONE redirect (cached;
// globally capped to bound cost / block risk). Result items do NOT need resolution
// (their link already contains /products/{N}).
const curatedNoCache = new Map<string, string | null>();
let redirectResolves = 0;
const MAX_REDIRECT_RESOLVES = 80;
export async function resolveCuratedProductNo(url: string): Promise<string | null> {
  if (!url) return null;
  const direct = productNoFrom(url);
  if (direct) return direct;
  if (curatedNoCache.has(url)) return curatedNoCache.get(url)!;
  let n: string | null = null;
  if (/naver\.me\//.test(url) && redirectResolves < MAX_REDIRECT_RESOLVES) {
    redirectResolves++;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      n = productNoFrom(res.url);
    } catch {
      n = null;
    }
  }
  curatedNoCache.set(url, n);
  return n;
}

/**
 * C — minor add-on (부스트/증정) strip on a heterogeneous-looking anchored SKU
 * (fix/set-classification-evidence-based). When the curated DB volume (본품) is one of
 * the detected title volumes and EVERY other detected volume is STRICTLY smaller (a
 * 소량 부스트/증정, not a 2nd 본품), and the title is neither a different form
 * (hasFormConflict) nor a device bundle, the offer is the 본품 priced at the DB volume.
 * The bundle price is attributed wholly to the 본품 (보수적 → ml당 약간↑, 가짜 최저가
 * 방지). Returns null → keep the heterogeneous-set (inspection) treatment when the DB
 * volume is absent, an add-on is ≥ 본품, or the form differs.
 */
export function stripMinorAddOn(
  title: string,
  mainVolumeMl: number | null,
  name: string | null
): { mainMl: number; note: string } | null {
  if (!mainVolumeMl || mainVolumeMl <= 0) return null;
  const t = stripHtml(title || '');
  if (/디바이스|기기/.test(t)) return null; // a device bundle is a real set, never a strip
  if (name && hasFormConflict(name, t)) return null; // different form/variant in same line
  const vols = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(ml|g)\b/gi)].map((m) => ({ amt: parseFloat(m[1]), unit: m[2].toLowerCase() }));
  if (vols.length < 2) return null; // need ≥2 volumes for there to be an add-on to strip
  if (new Set(vols.map((v) => v.unit)).size > 1) return null; // ml vs g mix → different products
  const amts = vols.map((v) => v.amt);
  if (!amts.includes(mainVolumeMl)) return null; // DB volume must BE one of the detected (본품)
  const addOns = amts.filter((a) => a !== mainVolumeMl);
  if (addOns.length === 0 || !addOns.every((a) => a < mainVolumeMl)) return null; // every add-on < 본품
  return { mainMl: mainVolumeMl, note: `본품 ${mainVolumeMl}ml + 부속 ${addOns.map((a) => `${a}ml`).join('/')} 포함` };
}

/**
 * Quantity of a NO-volume HOMOGENEOUS bundle — the SAME product sold as multiple
 * units when extractPackageFromTitle could not derive a per-unit (no ml on the unit),
 * e.g. "쿠션 기획 (본품+리필)". 본품+리필 / 1+1·2+1 / N개·N팩·N병·N입·N매 / ×N of the same
 * product return the unit count; a bare "N종" option-select, a 세트 of DIFFERENT items,
 * or a plain single returns null. A device/기기 bundle is never a homogeneous multipack.
 * (Used only when no clean per-unit volume exists — so the bundle lprice is divided by
 * the count to estimate the 본품 unit price; trust-operator-anchored-bundles.)
 */
export function homogeneousBundleQty(title: string): number | null {
  const t = stripHtml(title || '');
  if (/디바이스|기기/.test(t)) return null;
  // 본품 + 리필 = the same product twice (1+1). Require BOTH words so a standalone
  // "리필팩" SKU (no 본품) is not miscounted as a bundle.
  if (/본품/.test(t) && /리필/.test(t)) return 2;
  const pm = t.match(/(?:^|[^0-9])([1-9])\s*\+\s*([1-9])(?![0-9])/); // 1+1, 2+1
  if (pm) { const q = parseInt(pm[1], 10) + parseInt(pm[2], 10); if (q >= 2 && q <= 20) return q; }
  const cm = t.match(/(\d+)\s*(?:개|팩|병|입|매)/); // N개/팩/병/입/매 (N≥2)
  if (cm) { const q = parseInt(cm[1], 10); if (q >= 2 && q <= 20) return q; }
  const xm = t.match(/[xX×*]\s*(\d+)\b/);
  if (xm) { const q = parseInt(xm[1], 10); if (q >= 2 && q <= 20) return q; }
  return null;
}

/**
 * 본품 + 증정(소품목) on an anchored/curated offer (trust-operator-anchored-bundles):
 * the curated DB volume (본품) appears in the title, the form matches (no form
 * conflict), it is not a device bundle, and EVERY other detected volume is strictly
 * smaller than 본품 (a 소량 증정/부스트, not a 2nd 본품) — ALSO accepting the case where
 * the gift carries NO volume ("(+로션, 세럼)") as long as a gift/번들 context word is
 * present. The whole bundle price is then attributed to the 본품 (보수적 ml당) and the
 * offer is surfaced to inspection (O/X). Returns null when 본품 is not identifiable
 * (→ a genuine multi-main 이종 세트; the caller still routes it to inspection, blank).
 */
export function priceGiftBundleOnMain(
  title: string,
  mainVolumeMl: number | null,
  name: string | null
): { mainMl: number } | null {
  if (!mainVolumeMl || mainVolumeMl <= 0) return null;
  const t = stripHtml(title || '');
  if (/디바이스|기기/.test(t)) return null;
  if (name && hasFormConflict(name, t)) return null;
  const vols = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(ml|g)\b/gi)].map((m) => ({ amt: parseFloat(m[1]), unit: m[2].toLowerCase() }));
  if (new Set(vols.map((v) => v.unit)).size > 1) return null; // ml vs g mix → different products
  const amts = vols.map((v) => v.amt);
  if (!amts.includes(mainVolumeMl)) return null;                       // 본품(DB) must be present
  if (amts.filter((a) => a === mainVolumeMl).length > 1) return null;  // 본품 volume twice → 2nd equal main → real set
  if (amts.some((a) => a !== mainVolumeMl && a >= mainVolumeMl)) return null; // a 2nd 본품-sized item → real set
  if (!/\+|증정|사은품|샘플|미니|기획|세트|패키지|키트|콜렉션|컬렉션/.test(t)) return null; // need gift/번들 context
  return { mainMl: mainVolumeMl };
}

/**
 * Tier-1 selection: find the result whose link is the curated SKU (productNo N).
 * Returns null when no anchor number is given or none matches (→ caller falls back
 * to tier-2 title matching). A single anchor is accepted as-is (exact SKU); a
 * set/multipack anchor is excluded (matched=null, anchorWasSet=true). A heterogeneous
 * anchor that is really 본품(DB volume) + a 소량 부스트 is add-on-stripped and priced as
 * the 본품 (case C) when mainVolumeMl/name are supplied.
 */
export function pickAnchoredOffer(
  items: NaverShoppingItem[],
  anchorProductNo: string | null,
  mainVolumeMl: number | null = null,
  name: string | null = null
): OfferMatchResult | null {
  if (!anchorProductNo) return null;
  const anchored = items.find((it) => productNoFrom(it.link) === anchorProductNo);
  if (!anchored) return null;
  const ext = extractPackageFromTitle(stripHtml(anchored.title));
  const lprice = parseInt(anchored.lprice, 10);
  const priceHint = Number.isFinite(lprice) && lprice > 0 ? lprice : null;
  const base = `id-anchored to curated SKU (productNo ${anchorProductNo}) @${anchored.mallName}`;

  // Heterogeneous-LOOKING anchored SKU (이종 세트 / 증정 번들). The operator linked it,
  // so we TRUST the link and NEVER drop it to link_only — we compute a 본품(main-unit)
  // price when we can and route to inspection (O/X) with it pre-filled; otherwise we
  // still route to inspection (anchor price as a hint), never link_only.
  if (ext.heterogeneous) {
    // (a) 본품 + 소량 부스트 (an add-on with a SMALLER known volume) → high-confidence
    //     auto-price on the 본품 (#47 minor add-on; unchanged — price IS shown).
    const stripped = stripMinorAddOn(anchored.title, mainVolumeMl, name);
    if (stripped) {
      return {
        matched: anchored,
        parsedVolumeRaw: stripped.mainMl, // 본품=DB volume; bundle price attributed to it (보수적)
        identityScore: 1,
        reason: `${base} — ${stripped.note} (소량 부스트 strip, 본품 기준 가격)`,
        nJongVerify: true, // surface to Discord set/구성 verify (price IS shown)
      };
    }
    // (b) 본품 + 증정(소품목, 다른 품목): the curated 본품(DB volume) is identifiable and
    //     the rest are gifts → attribute the WHOLE bundle price to the 본품 (보수적 ml당)
    //     and pre-fill it into inspection (O/X). [제니피끄 세럼 115ml 세트 (+로션, 세럼)]
    if (priceGiftBundleOnMain(anchored.title, mainVolumeMl, name)) {
      return {
        matched: null,
        parsedVolumeRaw: mainVolumeMl,
        identityScore: 1,
        reason: `${base} — 증정/번들, 본품 ${mainVolumeMl}ml 기준 추정(확인 후 O)`,
        needsInspection: true,
        inspectionEstimatedPrice: priceHint, // whole bundle price on the 본품 (conservative)
      };
    }
    // (c) 본품 식별 불가 (진짜 다중-main 이종 세트) → inspection with the anchor price as a
    //     starting hint (operator corrects + O), never link_only.
    return {
      matched: null,
      parsedVolumeRaw: null,
      identityScore: null,
      reason: `${base} — 이종 세트 의심(본품 식별 불가, 확인 후 O)`,
      needsInspection: true,
      inspectionEstimatedPrice: priceHint,
    };
  }

  // Non-heterogeneous: a clean single OR a clean (volume-bearing) homogeneous bundle.
  // Both are priced; normalize derives the per-unit (effective) price from the title
  // quantity. Gifts are not counted (packageExtractor strips them).
  const parsedVolumeRaw = ext.detected && ext.unitType === 'ml' && ext.unitAmount !== null ? ext.unitAmount : null;
  const qty = ext.unitCount && ext.unitCount > 1 ? ext.unitCount : 1;

  // A NO-volume homogeneous bundle (본품+리필 / 1+1 / N개 with no ml on the unit) reads
  // here as a "single" (the extractor needs a volume to split it), so its lprice is the
  // BUNDLE price, NOT the unit price. Route to inspection with a per-unit estimate
  // (lprice / qty) and the curated DB volume as the 본품 size. [VDL 쿠션 기획 (본품+리필)]
  if (qty === 1 && parsedVolumeRaw === null) {
    const bundleQty = homogeneousBundleQty(anchored.title);
    if (bundleQty && bundleQty > 1) {
      return {
        matched: null,
        parsedVolumeRaw: mainVolumeMl,
        identityScore: 1,
        reason: `${base} — 동종 번들 ×${bundleQty}, 본품가 추정(확인 후 O)`,
        needsInspection: true,
        inspectionEstimatedPrice: priceHint ? Math.round(priceHint / bundleQty) : null,
      };
    }
  }

  return {
    matched: anchored,
    parsedVolumeRaw,
    identityScore: 1,
    reason: `${base}${qty > 1 ? ` ×${qty} (per-unit)` : ''}`,
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
  curatedNoCache.clear();
  redirectResolves = 0;
}

async function searchNaverShopping(
  query: string,
  clientId: string,
  clientSecret: string
): Promise<NaverShoppingItem[]> {
  const cached = naverSearchCache.get(query);
  if (cached) return cached;
  // display=100 (API max): more candidates → higher tier-1 anchor hit-rate
  // (experiment used 100) and a fuller tier-2 official-mall set.
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${encodeURIComponent(query)}&display=100`;
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
 * Candidate search queries to maximize the chance the curated SKU (and thus its
 * channel-product number N) appears in results. Broad → narrow:
 *   1. brand + full name (precise)            2. brand + first name token
 *   3. brand + form/category noun (세럼/크림/토너…)  — recovers typo'd names
 *      (e.g. "유세린 하이아르론…" → "유세린 세럼") so the brand store's offer surfaces.
 */
export function buildAnchorQueries(brand: string | null, name: string): string[] {
  const brandWord = brand ? brand.split(' ')[0] : '';
  const nameWord = name ? name.split(' ')[0] : '';
  const formNoun = formNounsIn(name)[0];
  return Array.from(
    new Set(
      [cleanQuery(brand, name), `${brandWord} ${nameWord}`.trim(), formNoun ? `${brandWord} ${formNoun}`.trim() : '']
        .filter((c) => c.length > 0)
    )
  );
}

// ---------------------------------------------------------------------------
// Anchor-miss fallback (operator decision): brand.naver.com channelProductNo lives
// in a different namespace than the Shopping API's smartstore productId, so the
// curated SKU number frequently never appears in results (anchor miss) AND a direct
// page crawl is hard-blocked (HTTP 429 anti-bot; see diagnose-naver-crawl). BUT the
// official brand store itself DOES surface in results by mallName (에뛰드 본사직영샵,
// 코스알엑스, 토리든…). So on anchor miss we recover a price WITHOUT crawling, in tiers:
//   Tier-2  official Naver brand-store offer matched by mallName  → 공식가
//   Tier-3  가격비교 catalog lprice (no official store)            → 전판매처 최저가
//   Tier-4  none of the above                                    → link-only
// Fallback adoption is NON-ANCHORED (fuzzy title identity, not the curated SKU), so
// identity is STRICT (sim ≥ 0.6 on gift-stripped title + a distinctive core token +
// no form conflict + volume agreement). Whether it is surfaced as warning depends on
// price/link coherence (see fallbackPolicy + fetchOffer): an official-store price on
// a non-affiliate listing also gets its buy link updated to that store → coherent →
// no warning; an official-store price under a kept affiliate link, or any catalog
// lprice, is warning (inspection).
// ---------------------------------------------------------------------------

// A Naver-HOSTED individual store (smartstore/main, brand.naver, window-products),
// NOT the 가격비교 catalog or an external reseller mall.
const NAVER_STORE_LINK_RE =
  /(?:(?:m\.)?smartstore\.naver\.com\/[^/]+\/products\/|brand\.naver\.com\/[^/]+\/products\/|shopping\.naver\.com\/window)/i;
export function isNaverHostedStore(link?: string | null): boolean {
  return !!link && NAVER_STORE_LINK_RE.test(link);
}

/**
 * WHOLE-WORD brand match: the brand must appear in the mallName at a space/string
 * boundary — `(^|space) brand (space|$)` — NOT as a substring. This stops a short
 * brand from false-matching a longer name (브랜드 `올리브` must NOT match `올리브영`
 * or `콩올리브`, but DOES match `올리브 공식몰` / `공식 올리브`). Normalization: strip
 * parentheticals, collapse whitespace, case-insensitive (English: VDL=vdl). Uses a
 * SPACE-preserving normalize (NOT normalizeMallName, which removes spaces).
 */
export function mallNameHasBrandWord(mallName: string | null | undefined, brand: string | null | undefined): boolean {
  const norm = (s: string) => (s || '').replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const b = norm(brand || '');
  const m = norm(mallName || '');
  if (!b || !m) return false;
  const esc = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape regex specials in the brand
  return new RegExp(`(?:^|\\s)${esc}(?:\\s|$)`).test(m);
}

/**
 * Official-mall gate (operator-confirmed, strict): an individual Naver-hosted store
 * whose mallName carries the product brand as a WHOLE WORD (a NECESSARY condition —
 * a mall that does not carry the brand in its name is a reseller/other mall and is
 * excluded). retailer_allowlist mallName, when present, is authoritative. The
 * remaining confidence (single-product, right size) comes from the strict identity
 * gate applied by the pickers, plus the always-warning/operator-review of every
 * non-anchored adoption.
 */
export function isOfficialBrandStoreOffer(
  item: NaverShoppingItem,
  allowedStoreName: string | null,
  brand: string | null
): boolean {
  if (!isIndividualMallOffer(item)) return false; // not a catalog representative
  if (!isNaverHostedStore(item.link)) return false; // smartstore/brand/window host only
  const nm = normalizeMallName(item.mallName);
  if (!nm || nm === '네이버') return false;
  if (allowedStoreName) {
    const na = normalizeMallName(allowedStoreName);
    return na.length > 0 && (nm.includes(na) || na.includes(nm));
  }
  if (!brand) return false;
  // mallName must carry the brand as a whole word (space/boundary), not a substring.
  return mallNameHasBrandWord(item.mallName, brand);
}

/** Affiliate (monetized) Naver link = a naver.me short link ONLY (operator rule). */
export function isNaverAffiliate(url?: string | null): boolean {
  return !!url && /naver\.me\//i.test(url);
}

/**
 * Link/warning policy for a NON-ANCHORED official-store fallback adoption:
 *   - official store + affiliate listing (naver.me): keep the affiliate buy link
 *     (do NOT update), warning (price-owner ≠ link-owner; record affiliate). [A2]
 *   - official store + non-affiliate listing: adopt the official price AND update
 *     the buy link to that official store → price/link same owner → NO warning. [B2]
 * (catalog/가격비교 fallback was removed — see fallbackTier.)
 */
export function fallbackPolicy(
  tier: 'official-store',
  isAffiliate: boolean
): { updateLink: boolean; warn: boolean } {
  void tier;
  return isAffiliate ? { updateLink: false, warn: true } : { updateLink: true, warn: false };
}

/**
 * STRICT identity gate shared by both fallback tiers — same bar as OY auto-price.
 * On the gift-stripped title: similarity ≥ 0.6, a distinctive core token present,
 * no form conflict, and not a heterogeneous set.
 *
 * Per-retailer volume (operator decision): a parsed volume that DIFFERS from the
 * curated DB volume is NOT a reject — cosmetics are sold in different sizes per
 * retailer (네이버 100ml / 올리브영 80ml …). Identity (sim + distinctive token + no
 * form conflict + not a set) already guarantees "same product"; the size is just
 * carried through (parsedVol) so normalize can price ml당 from the listing's own
 * volume. chooseFallback still PREFERS a volume-exact match, but never drops a
 * different size. (volumeMl is retained for that downstream tie-break.)
 */
function passesStrictIdentity(
  title: string,
  name: string,
  _volumeMl: number | null
): { ok: boolean; score: number; parsedVol: number | null; reason: string } {
  void _volumeMl; // volume no longer gates identity (per-retailer size allowed)
  const t = stripPromoGifts(stripHtml(title));
  const score = productIdentityScore(t, name);
  if (score < OY_AUTO_PRICE_SIMILARITY) return { ok: false, score, parsedVol: null, reason: `sim ${score.toFixed(2)} < ${OY_AUTO_PRICE_SIMILARITY}` };
  if (hasFormConflict(name, t)) return { ok: false, score, parsedVol: null, reason: 'form conflict' };
  const distinct = distinctiveTokens(name);
  const tn = t.toLowerCase().replace(/\s+/g, '');
  if (distinct.length > 0 && !distinct.some((d) => tn.includes(d))) return { ok: false, score, parsedVol: null, reason: 'no distinctive core token' };
  const ext = extractPackageFromTitle(t);
  if (ext.heterogeneous) return { ok: false, score, parsedVol: null, reason: 'heterogeneous set' };
  const parsedVol = ext.detected && ext.unitType === 'ml' && ext.unitAmount !== null ? ext.unitAmount : null;
  return { ok: true, score, parsedVol, reason: `sim ${score.toFixed(2)}` };
}

type ScoredCandidate = { it: NaverShoppingItem; score: number; parsedVol: number | null };

/**
 * Among strict-identity-passing candidates, drop cross-seller price outliers vs the
 * search-result median (only when the distribution is broad enough), then prefer a
 * volume-exact match, then higher identity, then lowest price.
 */
function chooseFallback(passing: ScoredCandidate[], items: NaverShoppingItem[], volumeMl: number | null): ScoredCandidate {
  let cands = passing;
  if (cands.length > 1) {
    const distribution = items.filter(isIndividualMallOffer).map((it) => parseInt(it.lprice, 10));
    const median = medianPrice(distribution);
    if (median && distribution.filter((n) => Number.isFinite(n) && n > 0).length >= OY_MIN_DISTRIBUTION) {
      const inBand = cands.filter((c) => priceInBand(parseInt(c.it.lprice, 10), median));
      if (inBand.length > 0 && inBand.length < cands.length) cands = inBand;
    }
  }
  return [...cands].sort((a, b) => {
    const av = volumeMl != null && a.parsedVol === volumeMl ? 1 : 0;
    const bv = volumeMl != null && b.parsedVol === volumeMl ? 1 : 0;
    if (av !== bv) return bv - av;
    if (b.score !== a.score) return b.score - a.score;
    return parseInt(a.it.lprice, 10) - parseInt(b.it.lprice, 10);
  })[0];
}

/** Tier-2: an official Naver brand-store offer matched by mallName + strict identity. */
export function pickOfficialStoreFallback(items: NaverShoppingItem[], input: OfferMatchInput): OfferMatchResult {
  const official = items.filter((it) => isOfficialBrandStoreOffer(it, input.allowedStoreName, input.brand));
  if (official.length === 0) {
    return { matched: null, parsedVolumeRaw: null, identityScore: null, reason: 'no official Naver brand-store offer in results' };
  }
  const passing: ScoredCandidate[] = official
    .map((it) => { const id = passesStrictIdentity(it.title, input.name, input.volumeMl); return { it, score: id.score, parsedVol: id.parsedVol, ok: id.ok }; })
    .filter((x) => x.ok)
    .map(({ it, score, parsedVol }) => ({ it, score, parsedVol }));
  if (passing.length === 0) {
    return { matched: null, parsedVolumeRaw: null, identityScore: null, reason: 'official store offer(s) failed strict identity' };
  }
  const chosen = chooseFallback(passing, items, input.volumeMl);
  return {
    matched: chosen.it,
    parsedVolumeRaw: chosen.parsedVol,
    identityScore: chosen.score,
    reason: `official Naver store fallback "${chosen.it.mallName}" (sim ${chosen.score.toFixed(2)})`,
    fallbackTier: 'official-store',
  };
}


/**
 * Resolve a Naver price: Tier-1 ANCHOR to the curated SKU, then anchor-miss
 * fallback (Tier-2 official Naver store → Tier-3 가격비교 catalog → Tier-4 link-only).
 *
 * Tier-1 (anchor) is the trusted path: the price comes from the result whose link is
 * the curated channel-product number N (single or homogeneous bundle priced;
 * heterogeneous set → inspection). When N is absent from results (anchor miss) — or
 * no N could be resolved — we DO NOT fabricate, but we attempt the NON-ANCHORED
 * fallbacks above, each gated by STRICT identity and surfaced as warning. There is
 * still no loose anchored-path price for a name-similar different product/size.
 *
 * Multi-query recall (buildAnchorQueries) widens the search. OliveYoung uses its
 * own matchOliveYoungOffer, not this path. pickOfficialOffer/hasFormConflict remain
 * exported for the OY-strict alternative.
 */
export async function matchNaverOffer(
  product: NaverProductLike,
  allowedStoreName: string | null,
  clientId: string,
  clientSecret: string,
  anchorProductNo: string | null = null
): Promise<OfferMatchResult> {
  const candidates = buildAnchorQueries(product.brand, product.name);
  const merged: NaverShoppingItem[] = [];
  const seen = new Set<string>();
  for (const query of candidates) {
    const items = await searchNaverShopping(query, clientId, clientSecret);
    if (anchorProductNo) {
      // Pass the DB volume + name so a heterogeneous anchor that is really 본품(DB용량)
      // + a 소량 부스트 is add-on-stripped and priced as the 본품 (case C).
      const anchor = pickAnchoredOffer(items, anchorProductNo, product.volume_ml ?? null, product.name);
      if (anchor) return anchor; // Tier-1: anchored single/bundle (price) OR set (inspection)
    }
    for (const it of items) {
      const k = it.link || it.productId;
      if (k && !seen.has(k)) { seen.add(k); merged.push(it); }
    }
  }

  // Anchor missed (or no curated N). Try the non-anchored fallbacks (warning-flagged).
  const input: OfferMatchInput = {
    brand: product.brand,
    name: product.name,
    volumeMl: product.volume_ml ?? null,
    allowedStoreName,
  };
  // Tier-2 official Naver brand-store only. The 가격비교 catalog lprice fallback was
  // removed: those all-sellers-lowest prices are usually reseller/non-official and
  // rarely matched the operator's linked price → not worth holding for inspection.
  // No official-store match → link-only (routed by run.ts).
  const tier2 = pickOfficialStoreFallback(merged, input);
  if (tier2.matched) return tier2;

  return {
    matched: null,
    parsedVolumeRaw: null,
    identityScore: null,
    reason: anchorProductNo
      ? `anchor miss (productNo ${anchorProductNo}) + no official-store fallback — link-only`
      : 'no curated productId + no official-store fallback — link-only',
  };
}

// ---------------------------------------------------------------------------
// OliveYoung (Tier-2) — LOOSE match. OY's oy.run URL has no anchorable N, so we
// take the OliveYoung sales-point offer on Naver (mallName='올리브영' — an exact,
// trusted single seller). Strict variant tokens are NOT applied (OY titles carry
// influencer-pick/gift promo noise that would drop valid products); we reject only
// a clear form mismatch (크림 vs 올인원) and low similarity. Sets/bundles are
// included with per-unit pricing; ambiguity/heterogeneous → inspection (manual).
// ---------------------------------------------------------------------------
const OY_MALL = '올리브영';
const OY_MIN_SIMILARITY = 0.4; // below → no confident OY offer (Tier 4 link-only)
const OY_AUTO_PRICE_SIMILARITY = 0.6; // HIGH band: only ≥ this AND a core token → auto-price

// Cross-seller price-outlier rejection (operator decision: NO keyword exclusion —
// a 디바이스/번들 may be a legit product; reject only on PRICE). A candidate priced
// outside [ref/RATIO, ref×RATIO] of a reference price is dropped as an outlier.
// Reference priority: ① an injected same-product other-seller (쿠팡/네이버) matched
// price, else ② the median of the Naver search-result price distribution. Started
// conservative (2.5×) so a normal candidate is never cut.
const OY_OUTLIER_RATIO = 2.5;
// Need a meaningful distribution before trusting the median as the ② reference —
// with too few offers the median ≈ the candidates themselves (no signal) → skip
// outlier rejection and lean on the 단품 rule only ("참조 빈약 → 보수적").
const OY_MIN_DISTRIBUTION = 4;

/** Median of positive finite numbers (null when none). */
function medianPrice(nums: number[]): number | null {
  const xs = nums.filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

/** A price is within the trusted band around a reference (not an outlier). */
function priceInBand(price: number, ref: number): boolean {
  return price >= ref / OY_OUTLIER_RATIO && price <= ref * OY_OUTLIER_RATIO;
}

// Marketing / packaging words that are NOT product-distinctive — stripped when
// deriving the "core" tokens that must appear in an OY title to auto-price.
const PROMO_WORDS = new Set([
  '증정', '기획', '단독', '세일', '한정', '추가', '적립', '할인', '특가', 'new', '리뉴얼', '정품',
  '본품', '대용량', '더블', '구성', '세트', '파데프리', '픽', 'pick', '쿨링', '진정',
]);

/**
 * Distinctive product-name tokens: significant tokens minus form/category nouns
 * (선크림/토너/세럼…) and promo words. e.g. "스테이 프레쉬 톤업 선크림 퍼플" → [스테이,
 * 프레쉬, 톤업, 퍼플]. At least one must appear in an OY title to auto-price, so a
 * same-brand DIFFERENT product (조선미녀 맑은쌀) is held rather than mis-priced.
 */
export function distinctiveTokens(name: string): string[] {
  return significantTokens(name).filter((t) => !FORM_TOKENS.includes(t) && !PROMO_WORDS.has(t));
}

/**
 * Confidence band for the OliveYoung sales-point offer (mallName='올리브영').
 *   - auto-price (Tier 2): similarity ≥ HIGH AND a distinctive core token present.
 *   - hold + inspection (Tier 3 candidate): plausible (sim ≥ MIN) but below the band,
 *     missing a core token, ambiguous (top-2 too close), or heterogeneous.
 *   - no confident offer (Tier 4 link-only): nothing ≥ MIN similarity.
 * Stays loose (no strict variant tokens — promo/influencer noise tolerated); the
 * band only gates AUTO-PRICE, never drops a product.
 */
export function pickOliveYoungOffer(
  items: NaverShoppingItem[],
  productName: string,
  referencePrice?: number | null,
  mainVolumeMl?: number | null,
  anchorGoodsNo?: string | null
): OfferMatchResult {
  let oy = items.filter((it) => isIndividualMallOffer(it) && normalizeMallName(it.mallName) === OY_MALL);
  if (oy.length === 0) {
    return { matched: null, parsedVolumeRaw: null, identityScore: null, reason: 'no 올리브영 offer on Naver (Tier 4 link-only)' };
  }
  // goodsNo 앵커: 큐레이션 SKU(goodsNo)와 동일한 offer만 남긴다(정확 SKU 고정 → 형제 변종
  // 오매칭 제거). 일치 offer가 없으면(이번 검색에 큐레이션 SKU 미노출) 기존 느슨 매칭으로 폴백.
  if (anchorGoodsNo) {
    const anchored = oy.filter((it) => goodsNoFromOyOfferLink(it.link) === anchorGoodsNo);
    if (anchored.length > 0) oy = anchored;
  }
  // Score/judge on the GIFT-STRIPPED title so a freebie ("(+올인원크림 30ml)") cannot
  // lend its token to a different product (e.g. a 토너 set masquerading as 올인원).
  const scored = oy
    .map((it) => {
      const t = stripPromoGifts(stripHtml(it.title));
      return { it, t, s: productIdentityScore(t, productName) };
    })
    .filter((x) => !hasFormConflict(productName, x.t))
    .sort((a, b) => b.s - a.s);
  if (scored.length === 0 || scored[0].s < OY_MIN_SIMILARITY) {
    return { matched: null, parsedVolumeRaw: null, identityScore: scored[0]?.s ?? null, reason: `no confident 올리브영 offer (best ${(scored[0]?.s ?? 0).toFixed(2)} < ${OY_MIN_SIMILARITY}) — Tier 4 link-only` };
  }

  // Disambiguate among multiple plausible OY candidates BEFORE the band check, so a
  // cross-seller price-outlier (e.g. a 157,700 device 기획 next to a 39,000 단품)
  // cannot become the chosen `top` or force a needless hold. No keyword exclusion —
  // a 디바이스/번들 is dropped only via the 단품 rule or a pure price outlier.
  let candidates = scored;
  if (candidates.length > 1) {
    // (1) "단품" literal preference — an explicit single-unit label outranks 기획/증정
    //     siblings (바이오힐보 …30ml [단품/기획] 39,000; 몰바니 …단품 18,900).
    const danpum = candidates.filter((x) => /단품/.test(stripHtml(x.it.title)));
    if (danpum.length > 0 && danpum.length < candidates.length) candidates = danpum;
  }
  if (candidates.length > 1) {
    // (2) Price-outlier rejection vs a reference price. ① an injected other-seller
    //     matched price; else ② the median of the search-result distribution (only
    //     trusted when the distribution is broad enough — otherwise too thin → skip).
    const distribution = items
      .filter(isIndividualMallOffer)
      .map((it) => parseInt(it.lprice, 10));
    const median = medianPrice(distribution);
    const ref =
      referencePrice && referencePrice > 0
        ? referencePrice
        : distribution.filter((n) => Number.isFinite(n) && n > 0).length >= OY_MIN_DISTRIBUTION
          ? median
          : null;
    if (ref) {
      const inBand = candidates.filter((x) => priceInBand(parseInt(x.it.lprice, 10), ref));
      // Only prune when it removes outliers AND leaves at least one in-band candidate.
      if (inBand.length > 0 && inBand.length < candidates.length) candidates = inBand;
    }
  }

  // Core-token guard: a distinctive token of the curated name must be in the title.
  const distinct = distinctiveTokens(productName);
  const hasCoreToken = (t: string): boolean => {
    const tn = t.toLowerCase().replace(/\s+/g, '');
    return distinct.length === 0 || distinct.some((d) => tn.includes(d));
  };

  // "동일 제품명 후보 중 최저가" (operator decision): among the candidates that EACH pass
  // the auto-price band (sim ≥ HIGH, a core token present, not a heterogeneous set),
  // adopt the CHEAPEST — they are the same product, so the lowest price is the best
  // offer. This replaces the previous "two close different-price → hold": close
  // same-product prices now resolve to the lowest (바이오힐보 39,000, 몰바니 18,900).
  const adoptable = candidates.filter(
    (c) => c.s >= OY_AUTO_PRICE_SIMILARITY && hasCoreToken(c.t) && !extractPackageFromTitle(c.t).heterogeneous
  );
  if (adoptable.length > 0) {
    const chosen = adoptable.reduce(
      (lo, c) => (parseInt(c.it.lprice, 10) < parseInt(lo.it.lprice, 10) ? c : lo),
      adoptable[0]
    );
    const ext = extractPackageFromTitle(chosen.t);
    const parsedVolumeRaw = ext.detected && ext.unitType === 'ml' && ext.unitAmount !== null ? ext.unitAmount : null;
    const qty = ext.unitCount && ext.unitCount > 1 ? ext.unitCount : 1;

    // A NO-volume homogeneous bundle (본품+리필 / 1+1 / N개 with no ml on the unit) reads
    // as a "single" here but its lprice is the BUNDLE price, not the unit price. OY
    // matching is loose (no anchor), so route it to inspection with a per-unit estimate
    // (lprice / qty) for the operator to confirm once (O) — never auto-shown at the
    // bundle price. Volume-bearing bundles keep their per-unit auto-price (qty>1 above).
    // [VDL 커버스테인 하이커버 쿠션 기획 (본품+리필)]
    if (qty === 1 && parsedVolumeRaw === null) {
      const bundleQty = homogeneousBundleQty(chosen.t);
      if (bundleQty && bundleQty > 1) {
        const lp = parseInt(chosen.it.lprice, 10);
        return {
          matched: null,
          parsedVolumeRaw: mainVolumeMl ?? null,
          identityScore: chosen.s,
          reason: `올리브영 동종 번들 ×${bundleQty} (본품가 추정, 확인 후 O)`,
          needsInspection: true,
          inspectionEstimatedPrice: Number.isFinite(lp) && lp > 0 ? Math.round(lp / bundleQty) : null,
        };
      }
    }

    const note = adoptable.length > 1 ? `, lowest of ${adoptable.length}` : '';
    return { matched: chosen.it, parsedVolumeRaw, identityScore: chosen.s, reason: `올리브영 match (sim ${chosen.s.toFixed(2)}${note})${qty > 1 ? ` ×${qty} (per-unit)` : ''}` };
  }

  // No candidate qualifies for auto-price → hold for manual_override. Report the top
  // candidate's reason (heterogeneous set, or below band / no core token).
  const top = candidates[0];
  if (extractPackageFromTitle(top.t).heterogeneous) {
    // A heterogeneous set price is not a per-unit price → no hint; operator fills it.
    return { matched: null, parsedVolumeRaw: null, identityScore: top.s, reason: '올리브영 offer is a heterogeneous set — hold/inspection', needsInspection: true, inspectionEstimatedPrice: null };
  }
  // Low-confidence band: the top candidate's lprice is a usable price hint for the
  // operator (it just falls below the auto-price band / lacks a core token).
  const topPrice = parseInt(top.it.lprice, 10);
  return {
    matched: null, parsedVolumeRaw: null, identityScore: top.s,
    reason: `올리브영 below auto-price band (sim ${top.s.toFixed(2)}${top.s >= OY_AUTO_PRICE_SIMILARITY ? ', no core token' : ''}) — hold/inspection`,
    needsInspection: true,
    inspectionEstimatedPrice: Number.isFinite(topPrice) && topPrice > 0 ? topPrice : null,
  };
}

/** Search Naver and pick the OliveYoung sales-point offer (loose). */
export async function matchOliveYoungOffer(
  product: NaverProductLike,
  clientId: string,
  clientSecret: string,
  anchorGoodsNo: string | null = null
): Promise<OfferMatchResult> {
  // Recall: brand+name queries PLUS a "+올리브영" query that pulls the OliveYoung
  // sales-point's own listing into the result window (brand+name alone often ranks
  // it out — verified: #34 / #76 singles only surface with this). The mallName
  // filter in pickOliveYoungOffer still gates adoption, so title-stuffed resellers
  // are excluded — the appended term only improves recall, not trust.
  const candidates = Array.from(
    new Set([...buildAnchorQueries(product.brand, product.name), `${cleanQuery(product.brand, product.name)} 올리브영`])
  );
  let inspection: OfferMatchResult | null = null;
  for (const query of candidates) {
    const items = await searchNaverShopping(query, clientId, clientSecret);
    const r = pickOliveYoungOffer(items, product.name, null, product.volume_ml ?? null, anchorGoodsNo);
    if (r.matched) return r;
    if (r.needsInspection && !inspection) inspection = r;
  }
  return inspection ?? { matched: null, parsedVolumeRaw: null, identityScore: null, reason: 'no 올리브영 offer found (Tier 3/4)' };
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

    // Tier-1: resolve the curated channel-product number from the listing URL
    // (naver.me shortlinks are redirect-resolved + cached). Tier-2 falls back to
    // official-mall title matching when the anchor is absent from results.
    const anchorProductNo = await resolveCuratedProductNo(listing.url);
    const result = await matchNaverOffer(product, allowedStoreName, clientId as string, clientSecret as string, anchorProductNo);

    if (!result.matched) {
      // ── DORMANT page-crawl fallback (gated OFF) ────────────────────────────
      // Direct page crawl proved HARD-BLOCKED (HTTP 429 anti-bot on brand.naver.com;
      // naver.me → brandconnect affiliate; see diagnose-naver-crawl) → recovery 0.
      // The anchor-miss recovery now happens via matchNaverOffer's Tier-2/Tier-3
      // (official-store / catalog) above, which is robots-clean. The crawl is kept
      // behind NAVER_PAGE_CRAWL=on (default off) so it costs no Playwright timeout
      // per anchor-miss product, but the parser stays available if Naver relents.
      // A KNOWN set (needsInspection) is never crawled (its page price is a set price).
      if (process.env.NAVER_PAGE_CRAWL === 'on' && !isMock && !result.needsInspection && isNaverStorefrontUrl(listing.url)) {
        const crawled = await crawlNaverPagePrice(listing.url);
        if (crawled && crawled.found && !crawled.soldOut && crawled.salePrice !== null) {
          // 정가만 있으면 sale=정가 (parser already collapses that). Keep regular only
          // when it is a real, higher 정가 so "공식몰 대비" is against the 정가 baseline.
          const regular =
            crawled.regularPrice !== null && crawled.regularPrice >= crawled.salePrice
              ? crawled.regularPrice
              : null;
          // Volume/단품 from the page title via the existing packageExtractor path.
          const titleClean = crawled.title ? stripHtml(crawled.title) : '';
          const ext = titleClean ? extractPackageFromTitle(titleClean) : null;
          const parsedVolumeRaw =
            ext && ext.detected && ext.unitType === 'ml' && ext.unitAmount !== null ? ext.unitAmount : null;
          console.log(
            `[Naver Adapter] page-crawl recovered product ${product.id} (${product.name}) — 정가 ${regular ?? '-'} / 할인가 ${crawled.salePrice}`
          );
          return {
            regularPrice: regular,
            salePrice: crawled.salePrice,
            inStock: true,
            promoType: 'none',
            promoText: null,
            sourceText: `Naver page crawl: ${titleClean || product.name} (정가 ${regular ?? '-'} / 할인가 ${crawled.salePrice})`,
            storeName: allowedStoreName || null,
            parsedVolumeRaw,
            matchedUrl: listing.url || null,
            matchedMallName: allowedStoreName || null,
            nJongVerify: containsBareNJong(titleClean),
            outcome: 'ok',
          };
        }
        console.warn(
          `[Naver Adapter] page-crawl fallback found no usable price for product ${product.id} (${product.name})` +
            `${crawled?.soldOut ? ' (sold out / sale suspended)' : ''} — link-only`
        );
      }

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
        // A suspected set (id-anchored heterogeneous 2-product set) → route to the
        // inspection O/X tab instead of link_only. A plain anchor-miss leaves these
        // false → stays link_only.
        needsInspection: result.needsInspection ?? false,
        inspectionEstimatedPrice: result.inspectionEstimatedPrice ?? null,
      };
    }

    const item = result.matched;
    const parsedPrice = parseInt(item.lprice, 10);
    if (isNaN(parsedPrice)) throw new Error(`Failed to parse Naver price "${item.lprice}"`);

    // Affiliate = a naver.me link (operator-entered or cached as affiliate_url). The
    // affiliate buy link is monetized and must NEVER be replaced (Case A).
    const isAffiliate = isNaverAffiliate(listing.url) || isNaverAffiliate(listing.affiliate_url);

    // ── Non-anchored fallback (Tier-2 official store only) ────────────────────
    // Price/link handling via fallbackPolicy:
    //   A2 official + affiliate  → keep naver.me link, warning, record affiliate URL.
    //   B2 official + non-affil. → update buy link to the official store, NO warning.
    if (result.fallbackTier) {
      const { updateLink, warn } = fallbackPolicy(result.fallbackTier, isAffiliate);
      const priceStr = parsedPrice.toLocaleString('ko-KR');
      let inspectionWarning: string | null = null;
      let matchedUrl: string | null = null;
      let matchedMallName: string | null;
      let storeName: string | null;
      let sourceText: string;

      // official-store fallback only (catalog removed).
      matchedUrl = updateLink ? item.link || null : null; // B2 updates; A2 keeps affiliate
      matchedMallName = item.mallName || null;
      storeName = allowedStoreName || item.mallName;
      if (warn) {
        // A2: price from an official store but buy link stays the affiliate → record
        // the affiliate URL (for later affiliate-application review) + flag mismatch.
        inspectionWarning =
          `비앵커 공식몰 매칭(검수): ${item.mallName} ${priceStr}원 · 구매링크=어필리에이트 유지(가격주체 불일치 가능) · affiliate=${listing.url}`;
        sourceText = `Naver official-store fallback (affiliate kept): ${stripHtml(item.title)} — affiliate=${listing.url} — ${result.reason}`;
      } else {
        // B2: link updated to the official store → price/link same owner → coherent.
        sourceText = `Naver official-store match (link → 공식몰): ${stripHtml(item.title)} — ${result.reason}`;
      }

      console.warn(
        `[Naver Adapter] anchor-miss ${result.fallbackTier} fallback for product ${product.id} (${product.name}) → ${parsedPrice}원 ${warn ? '[warning]' : '[ok, link→공식몰]'} — ${result.reason}`
      );
      return {
        regularPrice: null, // fallback gives only a current price, no 정가 baseline
        salePrice: parsedPrice,
        inStock: true,
        promoType: 'none',
        promoText: null,
        sourceText,
        storeName,
        parsedVolumeRaw: result.parsedVolumeRaw,
        matchedUrl,
        matchedMallName,
        inspectionWarning,
        nJongVerify: containsBareNJong(item.title),
        // B2 only (official-store fallback that UPDATES the buy link on a non-affiliate
        // listing): the curated SKU was missing, so this priced offer is a DIFFERENT
        // official-mall 구성. run.ts adopts the link end-to-end + preserves the operator
        // original. A2 (affiliate kept → updateLink=false) and catalog never substitute.
        linkSubstituted: result.fallbackTier === 'official-store' && updateLink,
        outcome: 'ok', // priced; healthcheck downgrades to warning when inspectionWarning set
      };
    }

    // Tier-1: anchored to the curated SKU — the trusted price (no warning). For an
    // affiliate (naver.me) listing the buy link is never overwritten (matchedUrl null).
    return {
      regularPrice: null, // Shopping API returns only the lowest price (lprice)
      salePrice: parsedPrice,
      inStock: true,
      promoType: 'none',
      promoText: null,
      sourceText: `Naver API match: ${stripHtml(item.title)} (${item.productId})`,
      storeName: allowedStoreName || item.mallName,
      parsedVolumeRaw: result.parsedVolumeRaw,
      matchedUrl: isAffiliate ? null : item.link || null,
      matchedMallName: item.mallName || null,
      // Bare "N종" option-select OR a case-C 본품+부스트 strip → Discord set/구성 verify.
      nJongVerify: containsBareNJong(item.title) || !!result.nJongVerify,
      outcome: 'ok',
    };
  }
}
