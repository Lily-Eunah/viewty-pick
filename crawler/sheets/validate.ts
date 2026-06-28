import { z } from 'zod';

const boolField    = z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() !== 'false')]).default(true);
// is_disabled: blank/false → active (is_active=true), 'true' → inactive (is_active=false)
const disabledField = z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true')]).default(false);

// ─── _categories (single source of truth — replaces the old flat `categories` tab)
// One row per minor (소분류); the major (대분류) is repeated across its minors.
// Korean header names match the operator sheet Cowork set up.
export const categoriesRefRowSchema = z.object({
  대분류:      z.string().min(1),
  대분류_slug: z.string().min(1),
  소분류:      z.string().min(1),
  소분류_slug: z.string().min(1),
  sort_order:  z.number().or(z.string().transform((v) => parseInt(v, 10) || 0)).default(0),
});

export interface CategoryMajor { slug: string; name: string }
export interface CategoryMinor { slug: string; name: string; sort_order: number; major_slug: string }

/**
 * Parse the `_categories` ref tab into deduped majors + minors. Majors are keyed
 * by slug (repeated rows collapse to one); minors carry their parent major's slug
 * so the importer can resolve parent_id after upserting the majors. Invalid rows
 * are skipped and surfaced via `errors`.
 */
export function parseCategoriesRef(
  rows: Record<string, string>[],
): { majors: CategoryMajor[]; minors: CategoryMinor[]; errors: string[] } {
  const majorsBySlug = new Map<string, CategoryMajor>();
  const minorsBySlug = new Map<string, CategoryMinor>();
  const errors: string[] = [];
  for (const row of rows) {
    const p = categoriesRefRowSchema.safeParse(row);
    if (!p.success) { errors.push(`_categories: ${p.error.message}`); continue; }
    const majorSlug = p.data.대분류_slug.trim();
    const minorSlug = p.data.소분류_slug.trim();
    if (!majorsBySlug.has(majorSlug)) majorsBySlug.set(majorSlug, { slug: majorSlug, name: p.data.대분류.trim() });
    minorsBySlug.set(minorSlug, { slug: minorSlug, name: p.data.소분류.trim(), sort_order: p.data.sort_order, major_slug: majorSlug });
  }
  return { majors: [...majorsBySlug.values()], minors: [...minorsBySlug.values()], errors };
}

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
  // Unit of the volume_ml amount: ml / g / 매. Blank or unknown → 'ml' (so existing
  // ml products are unchanged). 장/시트/p/매입 are normalized to 매. Display-only;
  // the per-unit price math is unit-agnostic.
  volume_unit: z
    .string()
    .optional()
    .transform((v) => {
      const t = (v ?? '').trim().toLowerCase();
      if (t === 'g') return 'g';
      if (['매', '장', '시트', 'p', '매입'].includes(t)) return '매';
      if (['개', 'ea', 'count', '입'].includes(t)) return '개';
      return 'ml';
    }),
  // 정가 / MSRP for volume_ml. Blank → null (discount simply hidden). A non-positive
  // value is coerced to null so a stray 0 never produces a bogus 100% discount.
  // Operators type currency-formatted values (e.g. "₩35,000", "35,000원"), so strip
  // every non-digit/decimal char before parsing — a raw parseFloat("₩35,000") is NaN.
  regular_price: z
    .number()
    .or(z.string().transform((v) => parseFloat(v.replace(/[^\d.-]/g, ''))))
    .transform((v) => (Number.isFinite(v) && v > 0 ? v : null))
    .nullable()
    .default(null),
  skin_types:  z.string().transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)).default([]),
  features:    z.string().optional(),
  hwahae_url:  z.string().url().or(z.literal('')).optional(),
  image_url:   z.string().url().or(z.literal('')).optional(),
  is_disabled: disabledField,
  // Optional English URL slug; blank → DB slug falls back to product_key.
  slug:        z.string().optional(),
});

/** DB slug = explicit sheet slug if present, else the stable product_key. */
export function resolveDisplaySlug(sheetSlug: string | undefined, productKey: string): string {
  return sheetSlug?.trim() || productKey;
}

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

// ─── badges (wide, per-source) ────────────────────────────────────────────────
// One row per product (row-aligned with products). Each badge source is a group
// of columns `<source>_detail`, `<source>_source`, `<source>_ref_url`,
// `<source>_date`. Sources are DISCOVERED from the `_detail` header suffix, so
// adding a new source (e.g. hwahae_detail/…) needs NO code change. A product can
// carry several badges (one per filled source group).
export interface FlatBadge {
  product_key:  string;
  badge_type:   string;
  detail:       string | null;
  source_title: string | null;
  ref_url:      string | null;
  source_date:  string | null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Discover badge sources from `<source>_detail` headers across all rows. */
export function discoverBadgeSources(rows: Record<string, string>[]): string[] {
  const sources = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const m = /^(.+)_detail$/.exec(key.trim());
      if (m) sources.add(m[1]);
    }
  }
  return [...sources];
}

/**
 * Expand wide badge rows into flat per-source product_badge records. A source
 * group is emitted only when it has content (detail / source / ref_url non-empty;
 * a lone date is ignored). Invalid ref_url/date are dropped to null (kept lenient
 * so one bad cell never blocks the rest). Rows whose product can't be resolved AND
 * that carry badge data are returned as `skipped` for the caller to report.
 */
export function expandBadges(
  rawBadges: Record<string, string>[],
  nameToKey: Map<string, string>,
): { flat: FlatBadge[]; skipped: string[] } {
  const sources = discoverBadgeSources(rawBadges);
  const flat: FlatBadge[] = [];
  const skipped: string[] = [];
  for (const row of rawBadges) {
    const groups = sources
      .map((src) => {
        const detail       = (row[`${src}_detail`]   ?? '').trim();
        const source_title = (row[`${src}_source`]   ?? '').trim();
        const refRaw       = (row[`${src}_ref_url`]  ?? '').trim();
        const dateRaw      = (row[`${src}_date`]     ?? '').trim();
        const hasData = !!(detail || source_title || refRaw);
        return { src, detail, source_title, refRaw, dateRaw, hasData };
      })
      .filter((g) => g.hasData);
    if (groups.length === 0) continue;

    const productKey = resolveProductKey(
      { product_key: row.product_key, product_name: row.product_name },
      nameToKey,
    );
    if (!productKey) {
      skipped.push(row.product_key?.trim() || row.product_name?.trim() || '(unknown)');
      continue;
    }
    for (const g of groups) {
      flat.push({
        product_key:  productKey,
        badge_type:   g.src,
        detail:       g.detail || null,
        source_title: g.source_title || null,
        ref_url:      /^https?:\/\//i.test(g.refRaw) ? g.refRaw : null,
        source_date:  DATE_RE.test(g.dateRaw) ? g.dateRaw : null,
      });
    }
  }
  return { flat, skipped };
}

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
 * Plan product_key freeze: for product rows whose product_key cell is BLANK,
 * compute the stable key (same derivation the importer uses) and the sheet row to
 * write it back to. Rows that already have a key are left untouched (never
 * overwritten) so a later rename can't regenerate the product id. Pure (no I/O):
 * `rowNumber` = array index + 2 (header occupies sheet row 1). The caller does the
 * actual batched write-back, and tolerates write failure.
 */
export function planKeyFreeze(
  rawProducts: Record<string, string>[],
): { rowNumber: number; key: string }[] {
  const out: { rowNumber: number; key: string }[] = [];
  rawProducts.forEach((row, i) => {
    const p = simpleProductRowSchema.safeParse(row);
    if (!p.success) return;
    if (p.data.product_key?.trim()) return; // already frozen — never overwrite
    out.push({ rowNumber: i + 2, key: makeProductKey(p.data.brand, p.data.name) });
  });
  return out;
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
  // same product_name maps to more than one distinct product_key — name-based
  // link/badge join would be ambiguous (v2 links/badges have no product_key col)
  duplicateProductNames: { name: string; product_keys: string[] }[];
  // same explicit (non-blank) slug used by more than one product — routing clash
  duplicateSlugs: { slug: string; product_keys: string[] }[];
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
  const nameToKeys = new Map<string, Set<string>>();   // product_name → distinct keys
  const slugToKeys = new Map<string, Set<string>>();   // explicit slug → distinct keys
  for (const row of rawProducts) {
    const p = simpleProductRowSchema.safeParse(row);
    if (!p.success) continue;
    const name = p.data.name.trim();
    const key = p.data.product_key?.trim() || makeProductKey(p.data.brand, p.data.name);
    if (!keyToNames.has(key)) keyToNames.set(key, []);
    keyToNames.get(key)!.push(name);
    if (!nameToKeys.has(name)) nameToKeys.set(name, new Set());
    nameToKeys.get(name)!.add(key);
    const slug = p.data.slug?.trim();
    if (slug) {
      if (!slugToKeys.has(slug)) slugToKeys.set(slug, new Set());
      slugToKeys.get(slug)!.add(key);
    }
  }
  const duplicateProductKeys = [...keyToNames.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([product_key, names]) => ({ product_key, names: [...new Set(names)] }));
  const duplicateProductNames = [...nameToKeys.entries()]
    .filter(([, keys]) => keys.size > 1)
    .map(([name, keys]) => ({ name, product_keys: [...keys] }));
  const duplicateSlugs = [...slugToKeys.entries()]
    .filter(([, keys]) => keys.size > 1)
    .map(([slug, keys]) => ({ slug, product_keys: [...keys] }));

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

  return { duplicateProductKeys, duplicateProductNames, duplicateSlugs, duplicateLinkKeys, duplicateUrls };
}

export function hasDuplicates(r: SheetDuplicateReport): boolean {
  return r.duplicateProductKeys.length > 0
    || r.duplicateProductNames.length > 0
    || r.duplicateSlugs.length > 0
    || r.duplicateLinkKeys.length > 0
    || r.duplicateUrls.length > 0;
}

// Human-readable conflict report for fail-fast logging.
export function formatDuplicateReport(r: SheetDuplicateReport): string {
  const lines: string[] = [];
  for (const d of r.duplicateProductKeys) {
    lines.push(`  duplicate product_key "${d.product_key}" shared by names: ${d.names.join(' | ')}`);
  }
  for (const d of r.duplicateProductNames) {
    lines.push(`  duplicate product_name "${d.name}" maps to keys: ${d.product_keys.join(', ')} (name-join would be ambiguous)`);
  }
  for (const d of r.duplicateSlugs) {
    lines.push(`  duplicate slug "${d.slug}" used by products: ${d.product_keys.join(', ')}`);
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
