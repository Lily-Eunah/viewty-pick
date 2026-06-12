import { z } from 'zod';

const boolField = z.union([z.boolean(), z.string().transform((v) => v.toLowerCase() !== 'false')]).default(true);

// ─── categories (unchanged) ──────────────────────────────────────────────────
export const categoryRowSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  sort_order: z.number().or(z.string().transform((v) => parseInt(v, 10) || 0)).default(0),
});

// ─── products (simplified — product_key/slug auto-generated) ─────────────────
// Optional product_key: provide only when preserving existing DB keys.
export const simpleProductRowSchema = z.object({
  product_key: z.string().optional(),             // leave blank → auto-generated
  name:         z.string().min(1),
  brand:        z.string().default(''),
  category:     z.string().min(1),                // slug (e.g. sunscreen)
  volume_ml:    z.number().or(z.string().transform((v) => parseFloat(v) || 0)).default(0),
  skin_types:   z.string().transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)).default([]),
  features:     z.string().optional(),
  image_url:    z.string().url().or(z.literal('')).optional(),
  is_active:    boolField,
});

// ─── product_links (wide — one row per product, one column per seller) ────────
// Admin fills only the URLs they have; empty cells are skipped.
export const productLinksWideRowSchema = z.object({
  product_name: z.string().min(1),
  oliveyoung:   z.string().default(''),
  coupang:      z.string().default(''),
  naver:        z.string().default(''),
  zigzag:       z.string().default(''),
  ably:         z.string().default(''),
});

// ─── badges (simplified — badge_type replaces badge_slug + badge_name) ────────
export const simpleBadgeRowSchema = z.object({
  product_name: z.string().min(1),
  badge_type:   z.string().min(1),    // e.g. 'directorpi', 'hwahae_best'
  detail:       z.string().optional().nullable(),
  source_title: z.string().optional().nullable(),
  ref_url:      z.string().url().or(z.literal('')).optional().nullable(),
  source_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional().nullable(),
});

// ─── retailer_allowlist (simplified — seller instead of seller_code) ──────────
export const simpleAllowlistRowSchema = z.object({
  seller:             z.enum(['oliveyoung', 'coupang', 'naver', 'zigzag', 'ably']),
  brand:              z.string().min(1),
  allowed_store_name: z.string().min(1),
});

// ─── manual_overrides (simplified — product_name + seller instead of keys) ───
export const simpleOverrideRowSchema = z.object({
  product_name:  z.string().min(1),
  seller:        z.enum(['oliveyoung', 'coupang', 'naver', 'zigzag', 'ably']),
  override_type: z.enum(['price', 'promo_type', 'promo_text', 'unit_price', 'in_stock']),
  value:         z.string().min(1),
  reason:        z.string().optional().nullable(),
  expires_at:    z.string().or(z.literal('')).optional().nullable(),
});

// ─── seo_pages (unchanged) ───────────────────────────────────────────────────
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
