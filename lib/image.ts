/**
 * "No image" sentinel for products.image_url.
 *
 * An operator writes `none` (case-insensitive) in the sheet's image_url cell to mean
 * "this product should have NO image" — e.g. Coupang only surfaces messy set/promo
 * thumbnails for it. Without this, the crawler's automated image-gathering pass
 * (crawler/run.ts Step 6.5) re-fills any empty image every run, so the messy
 * thumbnail keeps coming back.
 *
 * Effect of the sentinel:
 *   - crawler: keep the value as-is and skip auto image-gathering (crawler/run.ts).
 *   - web: treated as "no image" → clean category placeholder. resolveDisplayImage
 *     returns '' (so the Coupang fallback is not used either), and
 *     ProductImageWithFallback shows the placeholder because the value is not an
 *     http URL.
 */
export const NO_IMAGE_SENTINEL = 'none';

export function isNoImageSentinel(value: string | null | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === NO_IMAGE_SENTINEL;
}
