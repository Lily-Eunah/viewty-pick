-- 0021: rename products.volume_ml → unit_size, volume_unit → size_unit (PR-5).
--
-- Why: the columns hold a canonical-unit size in the product's OWN unit (ml/g/매/개), not
-- necessarily ml. The old names asserted "ml", which was the root of the "185매"/"200개"
-- mislabeling. This is a metadata-only rename (instant, negligible lock).
--
-- Scope: products only. price_snapshots.total_ml is intentionally NOT renamed — it is
-- written on every crawl and a write cannot tolerate a column-name gap; its meaning is
-- already repurposed to "canonical total". No DB view references products (the price views
-- are over price_snapshots + listings), so no view recreation is needed; Postgres also
-- auto-updates any dependent object on RENAME.
--
-- ⚠️ ORDERING (see docs/title-parsing-canonical-unit-design.md §6):
--   1. Deploy the transition-compat code FIRST (reads unit_size ?? volume_ml; import writes
--      unit_size). Merging/deploying it is backward-safe: pre-rename it reads volume_ml.
--   2. THEN run this migration.
--   3. Verify one crawl reads volumes correctly.
--   4. THEN rename the Google Sheet headers (volume_ml→unit_size, volume_unit→size_unit)
--      and run `sheets:import` ONCE.
--   Running the sheet-header rename before step 2/3 would make import read empty and let
--   normalize's `|| 50` default silently corrupt every ml당 — do NOT reorder.

alter table products rename column volume_ml   to unit_size;
alter table products rename column volume_unit to size_unit;
