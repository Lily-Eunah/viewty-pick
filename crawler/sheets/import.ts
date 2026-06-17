import { google } from 'googleapis';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { loadMockDB, saveMockDB } from '../../lib/supabase/mockDb';
import * as v from './validate';
import * as mockSheets from './mock_sheets_data';
import { ProductBadge } from '../../lib/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isGoogleConfigured(): boolean {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const id   = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  return !!(
    json && json !== 'your-google-service-account-credentials-json-string' &&
    id   && id   !== 'placeholder-sheet-id'
  );
}

async function fetchSheet(spreadsheetId: string, range: string): Promise<Record<string, string>[]> {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth  = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  const sheets = google.sheets({ version: 'v4', auth });
  const res    = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows   = res.data.values ?? [];
  if (rows.length < 2) return [];
  const headers = rows[0].map((h: string) => h.trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}

// 0-based column index → A1 letter (A, B, … Z, AA …). product_key is normally col
// A, but we resolve it from the header row so a reordered sheet still freezes the
// right column.
function colLetter(n: number): string {
  let s = '';
  for (let i = n; i >= 0; i = Math.floor(i / 26) - 1) s = String.fromCharCode(65 + (i % 26)) + s;
  return s;
}

/**
 * Freeze auto-generated product_keys back into the sheet (write-back). Only BLANK
 * product_key cells are filled — existing keys are never touched — so once a key is
 * frozen, renaming the product no longer regenerates its id. Idempotent, batched,
 * and best-effort: a write failure is logged but never aborts the import (the DB
 * upsert still proceeds with the same generated keys). Returns the number frozen.
 */
async function freezeProductKeys(spreadsheetId: string, rawProducts: Record<string, string>[]): Promise<number> {
  const plan = v.planKeyFreeze(rawProducts);
  if (plan.length === 0) return 0;
  try {
    const creds  = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
    const auth   = new google.auth.GoogleAuth({ credentials: creds, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    // Resolve the product_key column from the header row (fallback: A).
    const headerRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'products!1:1' });
    const header    = (headerRes.data.values?.[0] ?? []).map((h: string) => String(h).trim());
    const keyColIdx = Math.max(0, header.indexOf('product_key'));
    const col       = colLetter(keyColIdx);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: plan.map((p) => ({ range: `products!${col}${p.rowNumber}`, values: [[p.key]] })),
      },
    });
    console.log(`[Sheet Import] Froze ${plan.length} auto-generated product_key(s) back to the sheet.`);
    return plan.length;
  } catch (e: unknown) {
    console.warn(`[Sheet Import] product_key freeze write-back failed (continuing import): ${(e as Error).message}`);
    return 0;
  }
}

// makeProductKey / buildNameToKey / expandListings now live in ./validate as the
// single source of truth shared with duplicate detection.
const makeProductKey = v.makeProductKey;

// Seller defaults applied automatically
const SELLER_META: Record<string, { crawl_method: 'api' | 'playwright' | 'naver_sourced'; store_name: string }> = {
  oliveyoung: { crawl_method: 'naver_sourced', store_name: '올리브영'  },
  coupang:    { crawl_method: 'api',           store_name: '쿠팡'     },
  naver:      { crawl_method: 'api',           store_name: '네이버'   },
  zigzag:     { crawl_method: 'playwright',    store_name: '지그재그' },
  ably:       { crawl_method: 'playwright',    store_name: '에이블리' },
};

// brand.naver.com/* = official brand store
function inferIsOfficialStore(url: string, seller: string): boolean {
  if (seller === 'naver') return url.includes('brand.naver.com/');
  return false;
}

// Badge display names by source slug (badge_type). New sources fall back to the
// raw slug, so adding a badge source needs no code change here.
const BADGE_NAMES: Record<string, string> = {
  directorpi:      '디렉터파이 추천',
  hwahae:          '화해 추천',
  hwahae_best:     '화해 베스트',
  oliveyoung_best: '올리브영 베스트',
};

// ---------------------------------------------------------------------------

interface ImportStats {
  productsCount: number;
  linksCount: number;
  badgesCount: number;
  categoriesCount: number;
  productsDeactivated: number;
  listingsDeactivated: number;
  errorCount: number;
  errors: string[];
}

export async function runSheetImport(): Promise<ImportStats> {
  const startedAt = new Date().toISOString();
  console.log(`[Sheet Import] Starting import run at ${startedAt}`);

  const stats: ImportStats = { productsCount: 0, linksCount: 0, badgesCount: 0, categoriesCount: 0, productsDeactivated: 0, listingsDeactivated: 0, errorCount: 0, errors: [] };

  const useSupabase    = isSupabaseServerConfigured();
  const useGoogleSheets = isGoogleConfigured();
  console.log(`[Sheet Import] Destination: ${useSupabase ? 'Supabase Database' : 'Local Mock Database File'}`);
  console.log(`[Sheet Import] Source: ${useGoogleSheets ? 'Google Sheets' : 'Mock data'}`);

  // ── Load raw data ──────────────────────────────────────────────────────────
  let rawCategories: Record<string, string>[];
  let rawProducts:   Record<string, string>[];
  let rawLinks:      Record<string, string>[];
  let rawBadges:     Record<string, string>[];
  let rawAllowlist:  Record<string, string>[];
  let rawOverrides:  Record<string, string>[];
  let rawSeoPages:   Record<string, string>[];

  if (useGoogleSheets) {
    const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
    console.log('[Sheet Import] Fetching data from Google Sheets...');
    [rawCategories, rawProducts, rawLinks, rawBadges, rawAllowlist, rawOverrides, rawSeoPages] = await Promise.all([
      fetchSheet(id, '_categories!A:Z'),
      fetchSheet(id, 'products!A:Z'),
      fetchSheet(id, 'product_links!A:Z'),
      fetchSheet(id, 'badges!A:Z'),
      fetchSheet(id, 'retailer_allowlist!A:Z'),
      fetchSheet(id, 'manual_overrides!A:Z'),
      fetchSheet(id, 'seo_pages!A:Z'),
    ]);
    console.log(`[Sheet Import] Fetched: ${rawProducts.length} products, ${rawLinks.length} listings, ${rawBadges.length} badges`);
  } else {
    rawCategories = mockSheets.mockCategoriesRefSheet;
    rawProducts   = mockSheets.mockProductsSheet;
    rawLinks      = mockSheets.mockProductLinksSheet;
    rawBadges     = mockSheets.mockBadgesWideSheet;
    rawAllowlist  = mockSheets.mockAllowlistSheet;
    rawOverrides  = mockSheets.mockOverridesSheet;
    rawSeoPages   = mockSheets.mockSeoPagesSheet;
  }

  // ── Fail-fast: reject duplicate product_key / link_key / url before writing ─
  // A dirty sheet (same product seeded under two key schemes, or one url reused
  // across link_keys) is the root cause of DB duplicates. Refuse to import it so
  // re-import can never resurrect duplicates. (Runbook Part 1 §2.1)
  const dupReport = v.detectSheetDuplicates(rawProducts, rawLinks);
  if (v.hasDuplicates(dupReport)) {
    const report = v.formatDuplicateReport(dupReport);
    console.error('[Sheet Import] ABORT — duplicate keys/urls detected in sheet:\n' + report);
    stats.errorCount++;
    stats.errors.push('Duplicate detection failed — import aborted:\n' + report);
    if (useSupabase) {
      await supabaseServer.from('sheet_import_runs').insert({
        started_at: startedAt, finished_at: new Date().toISOString(), status: 'failed',
        products_count: 0, links_count: 0, badges_count: 0, error_count: stats.errorCount,
        summary: { error: 'duplicate_detection_failed', duplicates: dupReport },
      });
    }
    return stats;
  }

  // ── Freeze auto-generated product_keys back to the sheet (Google path only) ──
  // Run once the sheet is known clean: persist generated keys into blank cells so a
  // later product rename keeps the same product id. Best-effort (never aborts).
  if (useGoogleSheets) {
    await freezeProductKeys(process.env.GOOGLE_SHEETS_SPREADSHEET_ID!, rawProducts);
  }

  // ── Build product_key map + expand wide rows → flat listings (shared) ──────
  const nameToKey = v.buildNameToKey(rawProducts);
  const flatListings = v.expandListings(rawLinks, nameToKey);

  // ==========================================================================
  // PATH A — Supabase
  // ==========================================================================
  if (useSupabase) {
    try {
      // 1. Categories (from _categories: majors first, then minors → parent_id)
      console.log('[Sheet Import] Syncing categories (_categories) to Supabase...');
      const cats = v.parseCategoriesRef(rawCategories);
      for (const e of cats.errors) { stats.errorCount++; stats.errors.push(e); }
      // Majors (대분류)
      for (const major of cats.majors) {
        const { error } = await supabaseServer.from('categories').upsert(
          { slug: major.slug, name: major.name, level: 'major', parent_id: null },
          { onConflict: 'slug' }
        );
        if (error) throw error;
        stats.categoriesCount++;
      }
      // Resolve major slug → id, then minors (소분류)
      const { data: majorRows, error: majErr } = await supabaseServer
        .from('categories').select('id, slug').eq('level', 'major');
      if (majErr) throw majErr;
      const majorIdBySlug = new Map((majorRows ?? []).map((m) => [m.slug, m.id as number]));
      for (const minor of cats.minors) {
        const parentId = majorIdBySlug.get(minor.major_slug) ?? null;
        if (parentId === null) { stats.errorCount++; stats.errors.push(`Minor "${minor.slug}": major "${minor.major_slug}" not found`); continue; }
        const { error } = await supabaseServer.from('categories').upsert(
          { slug: minor.slug, name: minor.name, sort_order: minor.sort_order, level: 'minor', parent_id: parentId },
          { onConflict: 'slug' }
        );
        if (error) throw error;
        stats.categoriesCount++;
      }

      // 2. Products
      console.log('[Sheet Import] Syncing products to Supabase...');
      const { data: dbCategories, error: catErr } = await supabaseServer.from('categories').select('*');
      if (catErr) throw catErr;

      for (const row of rawProducts) {
        const p = v.simpleProductRowSchema.safeParse(row);
        if (!p.success) { stats.errorCount++; stats.errors.push(`Product: ${p.error.message}`); continue; }
        const productKey = p.data.product_key?.trim() || makeProductKey(p.data.brand, p.data.name);
        const categoryId = dbCategories?.find((c) => c.slug === p.data.category || c.name === p.data.category)?.id ?? null;

        const { error } = await supabaseServer.from('products').upsert({
          product_key: productKey,
          slug:        v.resolveDisplaySlug(p.data.slug, productKey),
          name:        p.data.name,
          brand:       p.data.brand || null,
          category_id: categoryId,
          volume_ml:   p.data.volume_ml,
          hwahae_url:  p.data.hwahae_url  || null,
          image_url:   p.data.image_url   || null,
          features:    p.data.features    || null,
          skin_types:  p.data.skin_types,
          is_active:   !p.data.is_disabled,
        }, { onConflict: 'product_key' });
        if (error) throw error;
        stats.productsCount++;
      }

      // 3. Listings (from expanded flat list)
      const { data: dbProducts } = await supabaseServer.from('products').select('*');
      const { data: dbSellers  } = await supabaseServer.from('sellers').select('*');

      console.log('[Sheet Import] Syncing listings to Supabase...');
      for (const listing of flatListings) {
        const productId = dbProducts?.find((p) => p.product_key === listing.product_key)?.id;
        const sellerId  = dbSellers?.find((s) => s.slug === listing.seller)?.id;
        if (!productId || !sellerId) {
          stats.errorCount++;
          stats.errors.push(`Listing skipped: product_key=${listing.product_key} seller=${listing.seller}`);
          continue;
        }
        const meta = SELLER_META[listing.seller];
        const { error } = await supabaseServer.from('listings').upsert({
          link_key:          listing.link_key,
          product_id:        productId,
          seller_id:         sellerId,
          url:               listing.url,
          // Coupang: leave affiliate_url blank. The product-detail URL is NOT an
          // affiliate link, so the adapter caches the search-sourced deeplink on
          // latest_matched_url and the /go redirect falls back url → home. (The
          // global "blank→url copy" for other sellers is a worklog follow-up.)
          affiliate_url:     listing.seller === 'coupang' ? null : listing.url,
          store_name:        meta.store_name,
          is_official_store: inferIsOfficialStore(listing.url, listing.seller),
          is_rocket:         false,
          crawl_enabled:     true,
          crawl_method:      meta.crawl_method,
          is_active:         true,
        }, { onConflict: 'link_key' });
        if (error) throw error;
        stats.linksCount++;
      }

      // 4. Badges
      const { data: dbBadgesRaw } = await supabaseServer.from('badges').select('*');
      const badgeCache = new Map((dbBadgesRaw ?? []).map((b) => [b.slug, b.id as number]));

      console.log('[Sheet Import] Syncing product badges (wide per-source) to Supabase...');
      const { flat: flatBadges, skipped: skippedBadges } = v.expandBadges(rawBadges, nameToKey);
      for (const s of skippedBadges) { stats.errorCount++; stats.errors.push(`Badge skipped: product "${s}" not found`); }
      for (const b of flatBadges) {
        const productId = dbProducts?.find((pr) => pr.product_key === b.product_key)?.id;
        if (!productId) { stats.errorCount++; stats.errors.push(`Badge skipped: product_key "${b.product_key}" not found`); continue; }

        // Upsert badge master row (slug → display name, fallback to the slug)
        let badgeId = badgeCache.get(b.badge_type);
        if (!badgeId) {
          const badgeName = BADGE_NAMES[b.badge_type] ?? b.badge_type;
          const { data: nb, error: bErr } = await supabaseServer
            .from('badges')
            .upsert({ slug: b.badge_type, name: badgeName }, { onConflict: 'slug' })
            .select().single();
          if (bErr) throw bErr;
          badgeId = nb.id as number;
          badgeCache.set(b.badge_type, badgeId);
        }

        const { error } = await supabaseServer.from('product_badges').upsert({
          product_id:   productId,
          badge_id:     badgeId,
          detail:       b.detail,
          source_title: b.source_title,
          ref_url:      b.ref_url,
          source_date:  b.source_date,
        }, { onConflict: 'product_id,badge_id' });
        if (error) throw error;
        stats.badgesCount++;
      }

      // 5. Retailer allowlist
      for (const row of rawAllowlist) {
        const p = v.simpleAllowlistRowSchema.safeParse(row);
        if (!p.success) { stats.errorCount++; continue; }
        const sellerId = dbSellers?.find((s) => s.slug === p.data.seller)?.id;
        if (!sellerId) continue;
        await supabaseServer.from('retailer_allowlist').upsert(
          { seller_id: sellerId, brand: p.data.brand, allowed_store_name: p.data.allowed_store_name, is_active: true },
          { onConflict: 'seller_id,brand,allowed_store_name' } as never
        );
      }

      // 6. Manual overrides
      for (const row of rawOverrides) {
        const p = v.simpleOverrideRowSchema.safeParse(row);
        if (!p.success) { stats.errorCount++; continue; }
        const productKey = v.resolveProductKey(p.data, nameToKey);
        const productId  = dbProducts?.find((pr) => pr.product_key === productKey)?.id;
        const sellerId   = dbSellers?.find((s) => s.slug === p.data.seller)?.id;
        if (!productId || !sellerId) continue;
        await supabaseServer.from('manual_overrides').insert({
          product_id:    productId,
          seller_id:     sellerId,
          override_type: p.data.override_type,
          value:         p.data.value,
          reason:        p.data.reason     ?? null,
          expires_at:    p.data.expires_at ?? null,
          is_active:     true,
        });
      }

      // 7. SEO pages
      for (const row of rawSeoPages) {
        const p = v.seoPageRowSchema.safeParse(row);
        if (!p.success) { stats.errorCount++; continue; }
        await supabaseServer.from('seo_pages').upsert({
          slug:        p.data.slug,
          page_type:   p.data.page_type   ?? null,
          title:       p.data.title       ?? null,
          h1:          p.data.h1          ?? null,
          description: p.data.description ?? null,
          category:    p.data.category    ?? null,
          skin_type:   p.data.skin_type   ?? null,
          badge_type:  p.data.badge_type  ?? null,
          is_active:   p.data.is_active,
        }, { onConflict: 'slug' });
      }

      // 8. Reconcile orphans — deactivate (no hard delete) DB rows that are no
      //    longer present in the sheet, so re-import converges DB → sheet.
      const sheetProductKeys = new Set(nameToKey.values());
      const sheetLinkKeys    = new Set(flatListings.map((l) => l.link_key));

      const { data: dbAllListings } = await supabaseServer.from('listings').select('id, link_key, is_active');
      const orphanListingIds = (dbAllListings ?? [])
        .filter((l) => l.is_active && !sheetLinkKeys.has(l.link_key))
        .map((l) => l.id);
      if (orphanListingIds.length) {
        const { error } = await supabaseServer.from('listings').update({ is_active: false }).in('id', orphanListingIds);
        if (error) throw error;
      }
      stats.listingsDeactivated = orphanListingIds.length;

      const { data: dbAllProducts } = await supabaseServer.from('products').select('id, product_key, is_active');
      const orphanProductIds = (dbAllProducts ?? [])
        .filter((p) => p.is_active && !sheetProductKeys.has(p.product_key))
        .map((p) => p.id);
      if (orphanProductIds.length) {
        const { error } = await supabaseServer.from('products').update({ is_active: false }).in('id', orphanProductIds);
        if (error) throw error;
      }
      stats.productsDeactivated = orphanProductIds.length;
      console.log(`[Sheet Import] Reconcile: deactivated ${stats.listingsDeactivated} orphan listings, ${stats.productsDeactivated} orphan products.`);

      await supabaseServer.from('sheet_import_runs').insert({
        started_at: startedAt, finished_at: new Date().toISOString(),
        status: stats.errorCount > 0 ? 'completed_with_warnings' : 'completed',
        products_count: stats.productsCount, links_count: stats.linksCount,
        badges_count: stats.badgesCount, error_count: stats.errorCount, summary: stats,
      });

    } catch (e: unknown) {
      const err = e as Error;
      console.error('[Sheet Import] Import to Supabase failed:', err);
      stats.errorCount++;
      stats.errors.push(`Critical import error: ${err.message}`);
      await supabaseServer.from('sheet_import_runs').insert({
        started_at: startedAt, finished_at: new Date().toISOString(), status: 'failed',
        products_count: stats.productsCount, links_count: stats.linksCount,
        badges_count: stats.badgesCount, error_count: stats.errorCount,
        summary: { error: err.message, ...stats },
      });
    }

  // ==========================================================================
  // PATH B — Local mock DB
  // ==========================================================================
  } else {
    console.log('[Sheet Import] Running import process on local mock database file...');
    const db = loadMockDB();

    // Categories (from _categories: majors first, then minors → parent_id)
    const cats = v.parseCategoriesRef(rawCategories);
    for (const e of cats.errors) { stats.errorCount++; stats.errors.push(e); }
    const nextCatId = () => (db.categories.length ? Math.max(...db.categories.map((c) => c.id)) + 1 : 1);
    for (const major of cats.majors) {
      const existing = db.categories.find((c) => c.slug === major.slug);
      if (existing) { existing.name = major.name; existing.level = 'major'; existing.parent_id = null; }
      else { db.categories.push({ id: nextCatId(), slug: major.slug, name: major.name, sort_order: 0, level: 'major', parent_id: null }); }
      stats.categoriesCount++;
    }
    for (const minor of cats.minors) {
      const parentId = db.categories.find((c) => c.slug === minor.major_slug)?.id ?? null;
      if (parentId === null) { stats.errorCount++; stats.errors.push(`Minor "${minor.slug}": major "${minor.major_slug}" not found`); continue; }
      const existing = db.categories.find((c) => c.slug === minor.slug);
      const data = { slug: minor.slug, name: minor.name, sort_order: minor.sort_order, level: 'minor' as const, parent_id: parentId };
      if (existing) { Object.assign(existing, data); }
      else { db.categories.push({ id: nextCatId(), ...data }); }
      stats.categoriesCount++;
    }

    // Products
    for (const row of rawProducts) {
      const p = v.simpleProductRowSchema.safeParse(row);
      if (!p.success) { stats.errorCount++; stats.errors.push(`Product: ${p.error.message}`); continue; }
      const productKey = p.data.product_key?.trim() || makeProductKey(p.data.brand, p.data.name);
      const categoryId = db.categories.find((c) => c.slug === p.data.category || c.name === p.data.category)?.id ?? null;
      const existing   = db.products.find((pr) => pr.product_key === productKey);
      const data = { product_key: productKey, slug: v.resolveDisplaySlug(p.data.slug, productKey), name: p.data.name, brand: p.data.brand || null, category_id: categoryId, volume_ml: p.data.volume_ml, hwahae_url: p.data.hwahae_url || null, image_url: p.data.image_url || null, features: p.data.features || null, skin_types: p.data.skin_types, official_info_url: null, viewty_score: 0, source: 'sheet', is_active: !p.data.is_disabled };
      if (existing) { Object.assign(existing, data); }
      else { db.products.push({ id: (db.products.length ? Math.max(...db.products.map((pr) => pr.id)) + 1 : 1), ...data }); }
      nameToKey.set(p.data.name.trim(), productKey);
      stats.productsCount++;
    }

    // Listings (from flat list)
    for (const listing of flatListings) {
      const product = db.products.find((pr) => pr.product_key === listing.product_key);
      const seller  = db.sellers.find((s) => s.slug === listing.seller);
      if (!product || !seller) { stats.errorCount++; continue; }
      const meta     = SELLER_META[listing.seller];
      const existing = db.listings.find((l) => l.link_key === listing.link_key);
      const data = { link_key: listing.link_key, product_id: product.id, seller_id: seller.id, url: listing.url, affiliate_url: listing.seller === 'coupang' ? null : listing.url, store_name: meta.store_name, is_official_store: inferIsOfficialStore(listing.url, listing.seller), is_rocket: false, crawl_enabled: true, crawl_method: meta.crawl_method, last_crawled_at: null, fail_count: 0, is_active: true };
      if (existing) { Object.assign(existing, data); }
      else { db.listings.push({ id: (db.listings.length ? Math.max(...db.listings.map((l) => l.id)) + 1 : 1), ...data }); }
      stats.linksCount++;
    }

    // Badges (wide per-source)
    const { flat: flatBadges, skipped: skippedBadges } = v.expandBadges(rawBadges, nameToKey);
    for (const s of skippedBadges) { stats.errorCount++; stats.errors.push(`Badge skipped: product "${s}" not found`); }
    for (const b of flatBadges) {
      const product = db.products.find((pr) => pr.product_key === b.product_key);
      if (!product) { stats.errorCount++; stats.errors.push(`Badge skipped: product_key "${b.product_key}" not found`); continue; }

      let badge = db.badges.find((bd) => bd.slug === b.badge_type);
      if (!badge) {
        const id = db.badges.length ? Math.max(...db.badges.map((bd) => bd.id)) + 1 : 1;
        badge = { id, slug: b.badge_type, name: BADGE_NAMES[b.badge_type] ?? b.badge_type };
        db.badges.push(badge);
      }
      const pbData: ProductBadge = { product_id: product.id, badge_id: badge.id, detail: b.detail, source_title: b.source_title, ref_url: b.ref_url, source_date: b.source_date };
      const idx = db.product_badges.findIndex((pb) => pb.product_id === product.id && pb.badge_id === badge!.id);
      if (idx >= 0) db.product_badges[idx] = pbData; else db.product_badges.push(pbData);
      stats.badgesCount++;
    }

    // Allowlist
    for (const row of rawAllowlist) {
      const p = v.simpleAllowlistRowSchema.safeParse(row);
      if (!p.success) continue;
      const seller = db.sellers.find((s) => s.slug === p.data.seller);
      if (!seller) continue;
      const exists = db.retailer_allowlist.some((al) => al.seller_id === seller.id && al.brand === p.data.brand && al.allowed_store_name === p.data.allowed_store_name);
      if (!exists) {
        const id = db.retailer_allowlist.length ? Math.max(...db.retailer_allowlist.map((al) => al.id)) + 1 : 1;
        db.retailer_allowlist.push({ id, seller_id: seller.id, brand: p.data.brand, allowed_store_name: p.data.allowed_store_name, is_active: true });
      }
    }

    // Overrides
    for (const row of rawOverrides) {
      const p = v.simpleOverrideRowSchema.safeParse(row);
      if (!p.success) continue;
      const productKey = v.resolveProductKey(p.data, nameToKey);
      const product    = db.products.find((pr) => pr.product_key === productKey);
      const seller     = db.sellers.find((s) => s.slug === p.data.seller);
      if (!product || !seller) continue;
      const existing = db.manual_overrides.find((mo) => mo.product_id === product.id && mo.seller_id === seller.id && mo.override_type === p.data.override_type);
      if (existing) { existing.value = p.data.value; existing.reason = p.data.reason ?? null; existing.expires_at = p.data.expires_at ?? null; }
      else {
        const id = db.manual_overrides.length ? Math.max(...db.manual_overrides.map((mo) => mo.id)) + 1 : 1;
        db.manual_overrides.push({ id, product_id: product.id, seller_id: seller.id, override_type: p.data.override_type, value: p.data.value, reason: p.data.reason ?? null, expires_at: p.data.expires_at ?? null, is_active: true });
      }
    }

    // SEO pages
    for (const row of rawSeoPages) {
      const p = v.seoPageRowSchema.safeParse(row);
      if (!p.success) continue;
      const existing = db.seo_pages.find((sp) => sp.slug === p.data.slug);
      const data = { slug: p.data.slug, page_type: p.data.page_type ?? null, title: p.data.title ?? null, h1: p.data.h1 ?? null, description: p.data.description ?? null, category: p.data.category ?? null, skin_type: p.data.skin_type ?? null, badge_type: p.data.badge_type ?? null, is_active: p.data.is_active };
      if (existing) { Object.assign(existing, data); }
      else { db.seo_pages.push({ id: (db.seo_pages.length ? Math.max(...db.seo_pages.map((sp) => sp.id)) + 1 : 1), ...data }); }
    }

    // Reconcile orphans (mock) — deactivate rows absent from the sheet.
    const sheetProductKeys = new Set(nameToKey.values());
    const sheetLinkKeys    = new Set(flatListings.map((l) => l.link_key));
    for (const l of db.listings) {
      if (l.is_active && !sheetLinkKeys.has(l.link_key)) { l.is_active = false; stats.listingsDeactivated++; }
    }
    for (const pr of db.products) {
      if (pr.is_active && !sheetProductKeys.has(pr.product_key)) { pr.is_active = false; stats.productsDeactivated++; }
    }

    saveMockDB(db);
    console.log(`[Sheet Import] Reconcile: deactivated ${stats.listingsDeactivated} orphan listings, ${stats.productsDeactivated} orphan products.`);
    console.log('[Sheet Import] Sheet data imported successfully to local mock DB file.');
  }

  const finishedAt = new Date().toISOString();
  console.log(`[Sheet Import] Import finished at ${finishedAt}. Success: ${stats.productsCount} products, ${stats.linksCount} links, ${stats.badgesCount} badges. Deactivated: ${stats.productsDeactivated} products, ${stats.listingsDeactivated} listings. Errors: ${stats.errorCount}`);
  return stats;
}

if (require.main === module) {
  runSheetImport()
    .then((stats) => { if (stats.errorCount > 0) console.error('[Sheet Import] Warnings detected!'); process.exit(0); })
    .catch((err)  => { console.error('[Sheet Import] Critical Sync Error:', err); process.exit(1); });
}
