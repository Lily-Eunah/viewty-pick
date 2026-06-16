import { z } from 'zod';

const boolField    = z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() !== 'false')]).default(true);
// is_disabled: blank/false → active (is_active=true), 'true' → inactive (is_active=false)
const disabledField = z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true')]).default(false);

// ─── categories ──────────────────────────────────────────────────────────────
export const categoryRowSchema = z.object({
  slug:       z.string().min(1),
  name:       z.string().min(1),
  sort_order: z.number().or(z.string().transform((v) => parseInt(v, 10) || 0)).default(0),
});

// ─── products ────────────────────────────────────────────────────────────────
// product_key: leave blank → auto-generated from brand|name hash
// category: accepts slug (sunscreen) or display name (선크림) — matched in import
// is_disabled: blank = active, 'true' = inactive
export const simpleProductRowSchema = z.object({
  product_key: z.string().optional(),
  name:        z.string().min(1),
  brand:       z.string().default(''),
  category:    z.string().min(1),
  volume_ml:   z.number().or(z.string().transform((v) => parseFloat(v) || 0)).default(0),
  skin_types:  z.string().transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)).default([]),
  features:    z.string().optional(),
  hwahae_url:  z.string().url().or(z.literal('')).optional(),
  image_url:   z.string().url().or(z.literal('')).optional(),
  is_disabled: disabledField,
});

// ─── product_links (wide — one row per product, one column per seller) ────────
// product_key (stable) is the primary join; product_name is a formula-synced
// display column kept only as a backward-compat fallback. Matching by key means a
// product rename never breaks links/badges (the recurring badge-skip cause).
export const productLinksWideRowSchema = z.object({
  product_key:  z.string().optional(),
  product_name: z.string().default(''),
  oliveyoung:   z.string().default(''),
  coupang:      z.string().default(''),
  naver:        z.string().default(''),
  zigzag:       z.string().default(''),
  ably:         z.string().default(''),
});

// ─── badges ──────────────────────────────────────────────────────────────────
export const simpleBadgeRowSchema = z.object({
  product_key:  z.string().optional(),
  product_name: z.string().default(''),
  badge_type:   z.string().min(1),
  detail:       z.string().optional().nullable(),
  source_title: z.string().optional().nullable(),
  ref_url:      z.string().url().or(z.literal('')).optional().nullable(),
  source_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional().nullable(),
});

// ─── retailer_allowlist ──────────────────────────────────────────────────────
export const simpleAllowlistRowSchema = z.object({
  seller:             z.enum(['oliveyoung', 'coupang', 'naver', 'zigzag', 'ably']),
  brand:              z.string().min(1),
  allowed_store_name: z.string().min(1),
});

// ─── manual_overrides ────────────────────────────────────────────────────────
export const simpleOverrideRowSchema = z.object({
  product_key:   z.string().optional(),
  product_name:  z.string().default(''),
  seller:        z.enum(['oliveyoung', 'coupang', 'naver', 'zigzag', 'ably']),
  override_type: z.enum(['price', 'promo_type', 'promo_text', 'unit_price', 'in_stock']),
  value:         z.string().min(1),
  reason:        z.string().optional().nullable(),
  expires_at:    z.string().or(z.literal('')).optional().nullable(),
});

// ─── seo_pages ───────────────────────────────────────────────────────────────
export const seoPageRowSchema = z.object({
  slug:        z.string().min(1),
  page_type:   z.string().optional(),
  title:       z.string().optional(),
  h1:          z.string().optional(),
  description: z.string().optional(),
  category:    z.string().optional(),
  skin_type:   z.string().optional(),
  badge_type:  z.string().optional(),
  is_active:   boolField,
});

// ─── shared key derivation (single source of truth for import + dedup) ────────
const SELLERS = ['oliveyoung', 'coupang', 'naver', 'zigzag', 'ably'] as const;
export type Seller = (typeof SELLERS)[number];

// Stable product key from brand + name (djb2 hash → base36). Used when the sheet
// leaves product_key blank.
export function makeProductKey(brand: string, name: string): string {
  let h = 5381;
  for (const c of `${brand.trim()}|${name.trim()}`) {
    h = (Math.imul(h, 33) ^ c.charCodeAt(0)) >>> 0;
  }
  return 'p' + h.toString(36);
}

// product name → product_key, derived exactly as the importer does.
export function buildNameToKey(rawProducts: Record<string, string>[]): Map<string, string> {
  const nameToKey = new Map<string, string>();
  for (const row of rawProducts) {
    const p = simpleProductRowSchema.safeParse(row);
    if (!p.success) continue;
    const key = p.data.product_key?.trim() || makeProductKey(p.data.brand, p.data.name);
    nameToKey.set(p.data.name.trim(), key);
  }
  return nameToKey;
}

/**
 * Resolve a row's product_key: prefer the explicit, stable product_key column;
 * fall back to looking up the (formula-synced) product_name. Key-first matching is
 * what makes a product rename non-breaking for links / badges / overrides.
 */
export function resolveProductKey(
  row: { product_key?: string; product_name?: string },
  nameToKey: Map<string, string>,
): string | undefined {
  const key = row.product_key?.trim();
  if (key) return key;
  const name = row.product_name?.trim();
  return name ? nameToKey.get(name) : undefined;
}

export interface FlatListing { link_key: string; product_key: string; seller: Seller; url: string }

/**
 * Normalize a product_links cell into a usable URL, or null when the cell is not
 * a URL (an empty cell, or an operator placeholder such as "?"). Returning null
 * means "no listing for this seller" — the cell is skipped, so a placeholder can
 * never create a bogus listing or trip the duplicate-url fail-fast gate.
 *
 * Scheme-less but real host+path values (e.g. "coupang.com/vp/products/123?…",
 * which operators often paste from the address bar) are upgraded to https so the
 * /go redirect (which resolves the stored url against the site origin) does not
 * break.
 */
export function normalizeListingUrl(raw: string | undefined | null): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  // host.tld followed by /, ?, # or end → a real (scheme-less) URL → assume https.
  if (/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?:[/?#]|$)/i.test(v)) return `https://${v}`;
  // Anything else (e.g. "?", "TODO", "n/a") is a placeholder, not a URL.
  return null;
}

// Expand wide product_links rows (one row/product, one column/seller) into flat
// per-seller listing records — the shape the importer upserts.
export function expandListings(
  rawLinks: Record<string, string>[],
  nameToKey: Map<string, string>,
): FlatListing[] {
  const flat: FlatListing[] = [];
  for (const row of rawLinks) {
    const r = productLinksWideRowSchema.safeParse(row);
    if (!r.success) continue;
    const productKey = resolveProductKey(r.data, nameToKey);
    if (!productKey) continue;
    for (const seller of SELLERS) {
      const url = normalizeListingUrl(r.data[seller]);
      if (!url) continue;
      flat.push({ link_key: `${seller}_${productKey}`, product_key: productKey, seller, url });
    }
  }
  return flat;
}

// ─── duplicate detection (fail-fast before any write) ─────────────────────────
export interface SheetDuplicateReport {
  // same product_key produced by more than one distinct product name
  duplicateProductKeys: { product_key: string; names: string[] }[];
  // same (seller, product) listing appears in more than one product_links row
  duplicateLinkKeys: { link_key: string; count: number }[];
  // same url reused across more than one listing (link_key)
  duplicateUrls: { url: string; link_keys: string[] }[];
}

export function detectSheetDuplicates(
  rawProducts: Record<string, string>[],
  rawLinks: Record<string, string>[],
): SheetDuplicateReport {
  // product_key → every product row (name) that resolves to it. More than one
  // row per key is a duplicate — whether the rows share a name (exact dupe) or
  // differ (two products colliding onto one key).
  const keyToNames = new Map<string, string[]>();
  for (const row of rawProducts) {
    const p = simpleProductRowSchema.safeParse(row);
    if (!p.success) continue;
    const name = p.data.name.trim();
    const key = p.data.product_key?.trim() || makeProductKey(p.data.brand, p.data.name);
    if (!keyToNames.has(key)) keyToNames.set(key, []);
    keyToNames.get(key)!.push(name);
  }
  const duplicateProductKeys = [...keyToNames.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([product_key, names]) => ({ product_key, names: [...new Set(names)] }));

  const nameToKey = buildNameToKey(rawProducts);
  const flat = expandListings(rawLinks, nameToKey);

  const linkKeyCounts = new Map<string, number>();
  const urlToLinkKeys = new Map<string, Set<string>>();
  for (const l of flat) {
    linkKeyCounts.set(l.link_key, (linkKeyCounts.get(l.link_key) ?? 0) + 1);
    const url = l.url.trim();
    if (!urlToLinkKeys.has(url)) urlToLinkKeys.set(url, new Set());
    urlToLinkKeys.get(url)!.add(l.link_key);
  }
  const duplicateLinkKeys = [...linkKeyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([link_key, count]) => ({ link_key, count }));
  const duplicateUrls = [...urlToLinkKeys.entries()]
    .filter(([, keys]) => keys.size > 1)
    .map(([url, keys]) => ({ url, link_keys: [...keys] }));

  return { duplicateProductKeys, duplicateLinkKeys, duplicateUrls };
}

export function hasDuplicates(r: SheetDuplicateReport): boolean {
  return r.duplicateProductKeys.length > 0
    || r.duplicateLinkKeys.length > 0
    || r.duplicateUrls.length > 0;
}

// Human-readable conflict report for fail-fast logging.
export function formatDuplicateReport(r: SheetDuplicateReport): string {
  const lines: string[] = [];
  for (const d of r.duplicateProductKeys) {
    lines.push(`  duplicate product_key "${d.product_key}" shared by names: ${d.names.join(' | ')}`);
  }
  for (const d of r.duplicateLinkKeys) {
    lines.push(`  duplicate listing (link_key) "${d.link_key}" appears ${d.count}×`);
  }
  for (const d of r.duplicateUrls) {
    lines.push(`  duplicate url "${d.url}" used by listings: ${d.link_keys.join(', ')}`);
  }
  return lines.join('\n');
}

// ─── orphan reconcile ─────────────────────────────────────────────────────────
// DB keys that are no longer present in the sheet → should be deactivated so a
// re-import converges the DB to the sheet (no hard delete).
export function computeOrphanKeys(dbKeys: string[], sheetKeys: Set<string>): string[] {
  return dbKeys.filter((k) => !sheetKeys.has(k));
}
