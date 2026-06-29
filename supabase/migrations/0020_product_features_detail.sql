-- 0020: products.features_detail — write-once backup of the operator's ORIGINAL
-- detailed product write-up.
--
-- `products.features` is shown on screen as the recommendation reason (split on ','
-- into chips + used as the description). Operators authored long free-form notes in
-- that cell; those were summarized/normalized into the concise `features` value, and
-- the verbatim original is preserved here so nothing is lost and a future re-edit can
-- start from the source text.
--
-- Non-destructive: a single additive nullable text column on products. products is
-- read with `select *` by the anon client, so the column is exposed with no
-- view/grant change. features_detail is backup-only and is not rendered. No backfill
-- — blank simply means "no detailed original" (e.g. the seed sunscreen rows).

alter table products add column if not exists features_detail text;
