-- 0017: products.volume_unit — the unit of the volume_ml number (ml / g / 매).
--
-- volume_ml has always held a numeric "amount", but the unit was hardcoded to "ml"
-- across the UI. Many products are NOT measured in ml — pads are counted in 매(장),
-- some balms/sticks in g. volume_unit names the unit so the web layer can render
-- "70매" / "50g" / "ml당↔매당↔g당" correctly. The per-unit price math is unchanged
-- (it was always unit-agnostic numerically); this only drives display labels.
--
-- Default 'ml' → every existing product keeps its current behavior with no backfill.
-- The operator fills 매/g only for pad / gram products.
--
-- Non-destructive additive column. products is read with `select *` by the anon
-- client, so it is exposed to the web layer with no view/grant change (same as 0015).

alter table products add column if not exists volume_unit text not null default 'ml';
