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
export const productLinksWideRowSchema = z.object({
  product_name: z.string().min(1),
  oliveyoung:   z.string().default(''),
  coupang:      z.string().default(''),
  naver:        z.string().default(''),
  zigzag:       z.string().default(''),
  ably:         z.string().default(''),
});

// ─── badges ──────────────────────────────────────────────────────────────────
export const simpleBadgeRowSchema = z.object({
  product_name: z.string().min(1),
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
  product_name:  z.string().min(1),
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
