import { google } from 'googleapis';
import { isSupabaseServerConfigured, supabaseServer } from '../../lib/supabase/server';
import { loadMockDB, saveMockDB } from '../../lib/supabase/mockDb';
import * as validate from './validate';
import * as mockSheets from './mock_sheets_data';
import { ProductBadge } from '../../lib/types';

// ---------------------------------------------------------------------------
// Google Sheets helpers
// ---------------------------------------------------------------------------

function isGoogleConfigured(): boolean {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  return !!(json && json !== 'your-google-service-account-credentials-json-string' && id && id !== 'placeholder-sheet-id');
}

async function fetchSheet(spreadsheetId: string, range: string): Promise<Record<string, string>[]> {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values ?? [];
  if (rows.length < 2) return [];
  const headers = rows[0].map((h: string) => h.trim());
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h: string, i: number) => { obj[h] = row[i] ?? ''; });
    return obj;
  });
}

interface ImportStats {
  productsCount: number;
  linksCount: number;
  badgesCount: number;
  categoriesCount: number;
  errorCount: number;
  errors: string[];
}

export async function runSheetImport(): Promise<ImportStats> {
  const startedAt = new Date().toISOString();
  console.log(`[Sheet Import] Starting import run at ${startedAt}`);

  const stats: ImportStats = {
    productsCount: 0,
    linksCount: 0,
    badgesCount: 0,
    categoriesCount: 0,
    errorCount: 0,
    errors: [],
  };

  const useSupabase = isSupabaseServerConfigured();
  const useGoogleSheets = isGoogleConfigured();
  console.log(`[Sheet Import] Destination: ${useSupabase ? 'Supabase Database' : 'Local Mock Database File'}`);
  console.log(`[Sheet Import] Source: ${useGoogleSheets ? 'Google Sheets' : 'Mock data'}`);

  // Load raw data — prefer real Google Sheets when credentials are present
  let rawCategories: Record<string, string>[];
  let rawProducts: Record<string, string>[];
  let rawListings: Record<string, string>[];
  let rawBadges: Record<string, string>[];
  let rawAllowlist: Record<string, string>[];
  let rawOverrides: Record<string, string>[];
  let rawSeoPages: Record<string, string>[];

  if (useGoogleSheets) {
    const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
    console.log('[Sheet Import] Fetching data from Google Sheets...');
    [rawCategories, rawProducts, rawListings, rawBadges, rawAllowlist, rawOverrides, rawSeoPages] = await Promise.all([
      fetchSheet(id, 'categories!A:Z'),
      fetchSheet(id, 'products!A:Z'),
      fetchSheet(id, 'product_links!A:Z'),
      fetchSheet(id, 'badges!A:Z'),
      fetchSheet(id, 'retailer_allowlist!A:Z'),
      fetchSheet(id, 'manual_overrides!A:Z'),
      fetchSheet(id, 'seo_pages!A:Z'),
    ]);
    console.log(`[Sheet Import] Fetched: ${rawProducts.length} products, ${rawListings.length} listings, ${rawBadges.length} badges`);
  } else {
    rawCategories = mockSheets.mockCategoriesSheet;
    rawProducts = mockSheets.mockProductsSheet;
    rawListings = mockSheets.mockListingsSheet;
    rawBadges = mockSheets.mockBadgesSheet;
    rawAllowlist = mockSheets.mockAllowlistSheet;
    rawOverrides = mockSheets.mockOverridesSheet;
    rawSeoPages = mockSheets.mockSeoPagesSheet;
  }

  if (useSupabase) {
    try {
      console.log('[Sheet Import] Syncing categories to Supabase...');
      for (const row of rawCategories) {
        const parsed = validate.categoryRowSchema.safeParse(row);
        if (!parsed.success) {
          stats.errorCount++;
          stats.errors.push(`Category validation failed: ${parsed.error.message}`);
          continue;
        }
        const { error } = await supabaseServer
          .from('categories')
          .upsert({ slug: parsed.data.slug, name: parsed.data.name, sort_order: parsed.data.sort_order }, { onConflict: 'slug' });
        if (error) throw error;
        stats.categoriesCount++;
      }

      // Sync Products
      console.log('[Sheet Import] Syncing products to Supabase...');
      // Load categories from DB first to get IDs
      const { data: dbCategories, error: catErr } = await supabaseServer.from('categories').select('*');
      if (catErr) throw catErr;

      for (const row of rawProducts) {
        const parsed = validate.productRowSchema.safeParse(row);
        if (!parsed.success) {
          stats.errorCount++;
          stats.errors.push(`Product validation failed: ${parsed.error.message}`);
          continue;
        }
        const categoryId = dbCategories?.find((c) => c.slug === parsed.data.category_slug)?.id || null;

        const { error } = await supabaseServer.from('products').upsert({
          product_key: parsed.data.product_key,
          slug: parsed.data.slug,
          name: parsed.data.name,
          brand: parsed.data.brand || null,
          category_id: categoryId,
          volume_ml: parsed.data.volume_ml,
          image_url: parsed.data.image_url || null,
          features: parsed.data.features || null,
          skin_types: parsed.data.skin_types,
          hwahae_url: parsed.data.hwahae_url || null,
          official_info_url: parsed.data.official_info_url || null,
          is_active: parsed.data.is_active,
        }, { onConflict: 'product_key' });
        if (error) throw error;
        stats.productsCount++;
      }

      // Sync Listings, Badges, etc.
      // Load products and sellers from DB
      const { data: dbProducts } = await supabaseServer.from('products').select('*');
      const { data: dbSellers } = await supabaseServer.from('sellers').select('*');

      console.log('[Sheet Import] Syncing listings to Supabase...');
      for (const row of rawListings) {
        const parsed = validate.listingRowSchema.safeParse(row);
        if (!parsed.success) {
          stats.errorCount++;
          stats.errors.push(`Listing validation failed: ${parsed.error.message}`);
          continue;
        }
        const productId = dbProducts?.find((p) => p.product_key === parsed.data.product_key)?.id;
        const sellerId = dbSellers?.find((s) => s.slug === parsed.data.seller_code)?.id;

        if (!productId || !sellerId) {
          stats.errorCount++;
          stats.errors.push(`Listing failed: Product or Seller not found in DB for listing key ${parsed.data.link_key}`);
          continue;
        }

        const { error } = await supabaseServer.from('listings').upsert({
          link_key: parsed.data.link_key,
          product_id: productId,
          seller_id: sellerId,
          url: parsed.data.url,
          affiliate_url: parsed.data.affiliate_url || null,
          store_name: parsed.data.store_name || null,
          is_official_store: parsed.data.is_official_store,
          is_rocket: parsed.data.is_rocket,
          crawl_enabled: parsed.data.crawl_enabled,
          crawl_method: parsed.data.crawl_method,
          is_active: parsed.data.is_active,
        }, { onConflict: 'link_key' });
        if (error) throw error;
        stats.linksCount++;
      }

      // Sync Badges
      const { data: dbBadges } = await supabaseServer.from('badges').select('*');
      console.log('[Sheet Import] Syncing product badges to Supabase...');
      for (const row of rawBadges) {
        const parsed = validate.badgeRowSchema.safeParse(row);
        if (!parsed.success) {
          stats.errorCount++;
          stats.errors.push(`Badge validation failed: ${parsed.error.message}`);
          continue;
        }
        const productId = dbProducts?.find((p) => p.product_key === parsed.data.product_key)?.id;
        let badgeId = dbBadges?.find((b) => b.slug === parsed.data.badge_slug)?.id;

        if (!productId) {
          stats.errorCount++;
          stats.errors.push(`Badge failed: Product not found for product_key ${parsed.data.product_key}`);
          continue;
        }

        if (!badgeId) {
          const { data: newBadge, error: bInsErr } = await supabaseServer
            .from('badges')
            .upsert({ slug: parsed.data.badge_slug, name: parsed.data.badge_name }, { onConflict: 'slug' })
            .select()
            .single();
          if (bInsErr) throw bInsErr;
          badgeId = newBadge.id;
        }

        const { error } = await supabaseServer.from('product_badges').upsert({
          product_id: productId,
          badge_id: badgeId,
          detail: parsed.data.detail || null,
          source_title: parsed.data.source_title || null,
          ref_url: parsed.data.ref_url || null,
          source_date: parsed.data.source_date || null,
        }, { onConflict: 'product_id,badge_id' });
        if (error) throw error;
        stats.badgesCount++;
      }

      // Record Sync Run in Supabase
      await supabaseServer.from('sheet_import_runs').insert({
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        status: stats.errorCount > 0 ? 'completed_with_warnings' : 'completed',
        products_count: stats.productsCount,
        links_count: stats.linksCount,
        badges_count: stats.badgesCount,
        error_count: stats.errorCount,
        summary: stats,
      });

    } catch (e: unknown) {
      const err = e as Error;
      console.error('[Sheet Import] Import to Supabase failed:', err);
      stats.errorCount++;
      stats.errors.push(`Critical import error: ${err.message}`);
      
      await supabaseServer.from('sheet_import_runs').insert({
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        status: 'failed',
        products_count: stats.productsCount,
        links_count: stats.linksCount,
        badges_count: stats.badgesCount,
        error_count: stats.errorCount,
        summary: { error: err.message, ...stats },
      });
    }
  } else {
    // ----------------------------------------------------
    // Fallback to Local Mock JSON database
    // ----------------------------------------------------
    console.log('[Sheet Import] Running import process on local mock database file...');
    const db = loadMockDB();

    // 1. Sync Categories
    for (const row of rawCategories) {
      const parsed = validate.categoryRowSchema.safeParse(row);
      if (!parsed.success) {
        stats.errorCount++;
        stats.errors.push(`Category validation failed: ${parsed.error.message}`);
        continue;
      }
      const existing = db.categories.find((c) => c.slug === parsed.data.slug);
      if (existing) {
        existing.name = parsed.data.name;
        existing.sort_order = parsed.data.sort_order;
      } else {
        const id = db.categories.length > 0 ? Math.max(...db.categories.map(c => c.id)) + 1 : 1;
        db.categories.push({ id, slug: parsed.data.slug, name: parsed.data.name, sort_order: parsed.data.sort_order });
      }
      stats.categoriesCount++;
    }

    // 2. Sync Products
    for (const row of rawProducts) {
      const parsed = validate.productRowSchema.safeParse(row);
      if (!parsed.success) {
        stats.errorCount++;
        stats.errors.push(`Product validation failed: ${parsed.error.message}`);
        continue;
      }
      const category = db.categories.find((c) => c.slug === parsed.data.category_slug);
      const categoryId = category ? category.id : null;

      const existing = db.products.find((p) => p.product_key === parsed.data.product_key);
      if (existing) {
        existing.slug = parsed.data.slug;
        existing.name = parsed.data.name;
        existing.brand = parsed.data.brand || null;
        existing.category_id = categoryId;
        existing.volume_ml = parsed.data.volume_ml;
        existing.image_url = parsed.data.image_url || null;
        existing.features = parsed.data.features || null;
        existing.skin_types = parsed.data.skin_types;
        existing.hwahae_url = parsed.data.hwahae_url || null;
        existing.official_info_url = parsed.data.official_info_url || null;
        existing.is_active = parsed.data.is_active;
      } else {
        const id = db.products.length > 0 ? Math.max(...db.products.map(p => p.id)) + 1 : 1;
        db.products.push({
          id,
          product_key: parsed.data.product_key,
          slug: parsed.data.slug,
          name: parsed.data.name,
          brand: parsed.data.brand || null,
          category_id: categoryId,
          volume_ml: parsed.data.volume_ml,
          image_url: parsed.data.image_url || null,
          features: parsed.data.features || null,
          skin_types: parsed.data.skin_types,
          hwahae_url: parsed.data.hwahae_url || null,
          official_info_url: parsed.data.official_info_url || null,
          viewty_score: 0,
          source: 'sheet',
          is_active: parsed.data.is_active,
        });
      }
      stats.productsCount++;
    }

    // 3. Sync Listings
    for (const row of rawListings) {
      const parsed = validate.listingRowSchema.safeParse(row);
      if (!parsed.success) {
        stats.errorCount++;
        stats.errors.push(`Listing validation failed: ${parsed.error.message}`);
        continue;
      }
      const product = db.products.find((p) => p.product_key === parsed.data.product_key);
      const seller = db.sellers.find((s) => s.slug === parsed.data.seller_code);

      if (!product || !seller) {
        stats.errorCount++;
        stats.errors.push(`Listing failed: Product (${parsed.data.product_key}) or Seller (${parsed.data.seller_code}) not found in mock DB`);
        continue;
      }

      const existing = db.listings.find((l) => l.link_key === parsed.data.link_key);
      if (existing) {
        existing.product_id = product.id;
        existing.seller_id = seller.id;
        existing.url = parsed.data.url;
        existing.affiliate_url = parsed.data.affiliate_url || null;
        existing.store_name = parsed.data.store_name || null;
        existing.is_official_store = parsed.data.is_official_store;
        existing.is_rocket = parsed.data.is_rocket;
        existing.crawl_enabled = parsed.data.crawl_enabled;
        existing.crawl_method = parsed.data.crawl_method;
        existing.is_active = parsed.data.is_active;
      } else {
        const id = db.listings.length > 0 ? Math.max(...db.listings.map(l => l.id)) + 1 : 1;
        db.listings.push({
          id,
          link_key: parsed.data.link_key,
          product_id: product.id,
          seller_id: seller.id,
          url: parsed.data.url,
          affiliate_url: parsed.data.affiliate_url || null,
          store_name: parsed.data.store_name || null,
          is_official_store: parsed.data.is_official_store,
          is_rocket: parsed.data.is_rocket,
          crawl_enabled: parsed.data.crawl_enabled,
          crawl_method: parsed.data.crawl_method,
          last_crawled_at: null,
          fail_count: 0,
          is_active: parsed.data.is_active,
        });
      }
      stats.linksCount++;
    }

    // 4. Sync Badges
    for (const row of rawBadges) {
      const parsed = validate.badgeRowSchema.safeParse(row);
      if (!parsed.success) {
        stats.errorCount++;
        stats.errors.push(`Badge validation failed: ${parsed.error.message}`);
        continue;
      }
      const product = db.products.find((p) => p.product_key === parsed.data.product_key);
      if (!product) {
        stats.errorCount++;
        stats.errors.push(`Badge failed: Product not found for product_key ${parsed.data.product_key}`);
        continue;
      }

      let badge = db.badges.find((b) => b.slug === parsed.data.badge_slug);
      if (!badge) {
        const id = db.badges.length > 0 ? Math.max(...db.badges.map(b => b.id)) + 1 : 1;
        badge = { id, slug: parsed.data.badge_slug, name: parsed.data.badge_name };
        db.badges.push(badge);
      }

      const existingIdx = db.product_badges.findIndex((pb) => pb.product_id === product.id && pb.badge_id === badge!.id);
      const pbData: ProductBadge = {
        product_id: product.id,
        badge_id: badge.id,
        detail: parsed.data.detail || null,
        source_title: parsed.data.source_title || null,
        ref_url: parsed.data.ref_url || null,
        source_date: parsed.data.source_date || null,
      };

      if (existingIdx >= 0) {
        db.product_badges[existingIdx] = pbData;
      } else {
        db.product_badges.push(pbData);
      }
      stats.badgesCount++;
    }

    // 5. Sync Retailer Allowlist
    for (const row of rawAllowlist) {
      const parsed = validate.allowlistRowSchema.safeParse(row);
      if (!parsed.success) {
        stats.errorCount++;
        continue;
      }
      const seller = db.sellers.find((s) => s.slug === parsed.data.seller_code);
      if (!seller) continue;

      const existing = db.retailer_allowlist.find((al) => al.seller_id === seller.id && al.brand === parsed.data.brand && al.allowed_store_name === parsed.data.allowed_store_name);
      if (!existing) {
        const id = db.retailer_allowlist.length > 0 ? Math.max(...db.retailer_allowlist.map(al => al.id)) + 1 : 1;
        db.retailer_allowlist.push({
          id,
          seller_id: seller.id,
          brand: parsed.data.brand,
          allowed_store_name: parsed.data.allowed_store_name,
          is_active: parsed.data.is_active
        });
      }
    }

    // 6. Sync Manual Overrides
    for (const row of rawOverrides) {
      const parsed = validate.overrideRowSchema.safeParse(row);
      if (!parsed.success) {
        stats.errorCount++;
        continue;
      }
      const product = db.products.find((p) => p.product_key === parsed.data.product_key);
      const seller = db.sellers.find((s) => s.slug === parsed.data.seller_code);
      if (!product || !seller) continue;

      const existing = db.manual_overrides.find((mo) => mo.product_id === product.id && mo.seller_id === seller.id && mo.override_type === parsed.data.override_type);
      if (existing) {
        existing.value = parsed.data.value;
        existing.reason = parsed.data.reason || null;
        existing.expires_at = parsed.data.expires_at || null;
        existing.is_active = parsed.data.is_active;
      } else {
        const id = db.manual_overrides.length > 0 ? Math.max(...db.manual_overrides.map(mo => mo.id)) + 1 : 1;
        db.manual_overrides.push({
          id,
          product_id: product.id,
          seller_id: seller.id,
          override_type: parsed.data.override_type,
          value: parsed.data.value,
          reason: parsed.data.reason || null,
          expires_at: parsed.data.expires_at || null,
          is_active: parsed.data.is_active
        });
      }
    }

    // 7. Sync SEO Pages
    for (const row of rawSeoPages) {
      const parsed = validate.seoPageRowSchema.safeParse(row);
      if (!parsed.success) {
        stats.errorCount++;
        continue;
      }
      const existing = db.seo_pages.find((sp) => sp.slug === parsed.data.slug);
      if (existing) {
        existing.page_type = parsed.data.page_type || null;
        existing.title = parsed.data.title || null;
        existing.h1 = parsed.data.h1 || null;
        existing.description = parsed.data.description || null;
        existing.category = parsed.data.category || null;
        existing.skin_type = parsed.data.skin_type || null;
        existing.badge_type = parsed.data.badge_type || null;
        existing.is_active = parsed.data.is_active;
      } else {
        const id = db.seo_pages.length > 0 ? Math.max(...db.seo_pages.map(sp => sp.id)) + 1 : 1;
        db.seo_pages.push({
          id,
          slug: parsed.data.slug,
          page_type: parsed.data.page_type || null,
          title: parsed.data.title || null,
          h1: parsed.data.h1 || null,
          description: parsed.data.description || null,
          category: parsed.data.category || null,
          skin_type: parsed.data.skin_type || null,
          badge_type: parsed.data.badge_type || null,
          is_active: parsed.data.is_active
        });
      }
    }

    saveMockDB(db);
    console.log('[Sheet Import] Sheet data imported successfully to local mock DB file.');
  }

  const finishedAt = new Date().toISOString();
  console.log(`[Sheet Import] Import finished at ${finishedAt}. Success: ${stats.productsCount} products, ${stats.linksCount} links, ${stats.badgesCount} badges. Errors: ${stats.errorCount}`);
  
  return stats;
}

// Allow running directly via tsx
if (require.main === module) {
  runSheetImport()
    .then((stats) => {
      if (stats.errorCount > 0) {
        console.error('[Sheet Import] Warnings or errors detected during import!');
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Sheet Import] Critical Sync Error:', err);
      process.exit(1);
    });
}
