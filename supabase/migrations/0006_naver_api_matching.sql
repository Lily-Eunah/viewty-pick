-- Naver Shopping Search API matching model (final spec §3).
--
-- Naver price is collected via the approved Shopping Search API (brand.naver.com
-- robots.txt disallows crawling). Each snapshot records which API offer it matched
-- (audit + change detection); listings cache the latest matched link for the
-- redirect fallback (affiliate_url → latest_matched_url → no button).
--
-- retailer_allowlist.allowed_store_name already exists and is reused as the
-- official mallName anchor (no schema change there — only seed/sheet data).

ALTER TABLE price_snapshots
  ADD COLUMN IF NOT EXISTS matched_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS matched_mall_name TEXT NULL;

ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS latest_matched_url TEXT NULL;
