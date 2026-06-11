import { z } from 'zod';

// 1. Categories Schema
export const categoryRowSchema = z.object({
  slug: z.string().min(1, 'Category slug is required'),
  name: z.string().min(1, 'Category name is required'),
  sort_order: z.number().or(z.string().transform((v) => parseInt(v, 10) || 0)).default(0),
});

// 2. Products Schema
export const productRowSchema = z.object({
  product_key: z.string().min(1, 'Product key is required'),
  slug: z.string().min(1, 'Product slug is required'),
  name: z.string().min(1, 'Product name is required'),
  brand: z.string().optional(),
  category_slug: z.string().min(1, 'Category slug is required'),
  volume_ml: z.number().or(z.string().transform((v) => parseFloat(v) || 0)).default(0),
  image_url: z.string().url().or(z.literal('')).optional(),
  features: z.string().optional(),
  skin_types: z.string().transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)).default(''),
  hwahae_url: z.string().url().or(z.literal('')).optional(),
  official_info_url: z.string().url().or(z.literal('')).optional(),
  is_active: z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true')]).default(true),
});

// 3. Product Links / Listings Schema
export const listingRowSchema = z.object({
  link_key: z.string().min(1, 'Link key is required'),
  product_key: z.string().min(1, 'Product key is required'),
  seller_code: z.enum(['oliveyoung', 'coupang', 'naver', 'zigzag', 'ably']),
  url: z.string().url('Invalid listing URL'),
  affiliate_url: z.string().url().or(z.literal('')).optional().nullable(),
  store_name: z.string().optional().nullable(),
  is_official_store: z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true')]).default(false),
  is_rocket: z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true')]).default(false),
  crawl_enabled: z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true')]).default(true),
  crawl_method: z.enum(['api', 'html', 'playwright', 'manual']).default('crawl'),
  is_active: z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true')]).default(true),
});

// 4. Badges Schema
export const badgeRowSchema = z.object({
  product_key: z.string().min(1, 'Product key is required'),
  badge_slug: z.string().min(1, 'Badge slug is required'),
  badge_name: z.string().min(1, 'Badge display name is required'),
  detail: z.string().optional().nullable(),
  source_title: z.string().optional().nullable(),
  ref_url: z.string().url().or(z.literal('')).optional().nullable(),
  source_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').or(z.literal('')).optional().nullable(),
  is_active: z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true')]).default(true),
});

// 5. Retailer Allowlist Schema
export const allowlistRowSchema = z.object({
  seller_code: z.enum(['oliveyoung', 'coupang', 'naver', 'zigzag', 'ably']),
  brand: z.string().min(1, 'Brand is required'),
  allowed_store_name: z.string().min(1, 'Allowed store name is required'),
  is_active: z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true')]).default(true),
});

// 6. Manual Overrides Schema
export const overrideRowSchema = z.object({
  product_key: z.string().min(1, 'Product key is required'),
  seller_code: z.enum(['oliveyoung', 'coupang', 'naver', 'zigzag', 'ably']),
  override_type: z.enum(['price', 'promo_type', 'promo_text', 'unit_price', 'in_stock']),
  value: z.string().min(1, 'Override value is required'),
  reason: z.string().optional().nullable(),
  expires_at: z.string().or(z.literal('')).optional().nullable(), // Will parse as timestamptz
  is_active: z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true')]).default(true),
});

// 7. SEO Pages Schema
export const seoPageRowSchema = z.object({
  slug: z.string().min(1, 'SEO page slug is required'),
  page_type: z.string().optional(),
  title: z.string().optional(),
  h1: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  skin_type: z.string().optional(),
  badge_type: z.string().optional(),
  is_active: z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() === 'true')]).default(true),
});
