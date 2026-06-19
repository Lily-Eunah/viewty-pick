-- 0015: products.regular_price (정가 / MSRP) for "정가 대비 할인률" display.
--
-- regular_price is the manufacturer's list price for the product's DB
-- representative volume (products.volume_ml). The web layer computes a discount %
-- against it, normalized PER-ML so a per-retailer size difference does not distort
-- the headline (consistent with migration 0014's per-retailer volume):
--   정가 ml당 = regular_price / volume_ml
--   할인률    = round((정가ml당 − listing.unit_price) / 정가ml당 × 100)
--
-- Non-destructive: a single additive nullable column on products. products is read
-- with `select *` by the anon client, so the column is exposed to the web layer
-- with no view/grant change. No backfill — blank regular_price simply hides the
-- discount (never mis-displays).

alter table products add column if not exists regular_price numeric;
