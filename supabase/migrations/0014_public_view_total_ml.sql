-- Per-retailer volume: expose total_ml on the public per-store view so the web
-- layer can show each seller's own size (네이버 100ml / 올리브영 80ml …) and rank
-- ml당 when volumes differ. total_ml = (listing volume) × total_quantity; the
-- per-unit listing volume is derived web-side as total_ml / pack quantity.
--
-- unit_price (ml당) is already exposed (gated by unit_price_reliable). After the
-- per-retailer-volume change a listing whose size differs from the DB is priced
-- ml당 from its own size and stays reliable, so unit_price is now populated for
-- those rows too.
--
-- Non-destructive: CREATE OR REPLACE of the 0011 view with total_ml APPENDED as
-- the last column (Postgres only allows CREATE OR REPLACE VIEW to add columns at
-- the end and forbids reordering existing ones). The 0011 column order, §2.4
-- latest-ok-only filter, security_invoker, and grants are otherwise unchanged.

create or replace view public.listing_prices_public
with (security_invoker = false)
as
select distinct on (ps.listing_id)
  ps.listing_id,
  ps.product_id,
  l.seller_id,
  ps.sale_price,
  ps.base_unit_price,
  ps.effective_unit_price,
  case when ps.unit_price_reliable then ps.unit_price end as unit_price,
  ps.promo_type,
  ps.promo_text,
  ps.in_stock,
  ps.shipping_note,
  ps.matched_mall_name,
  ps.crawled_at,
  ps.image_url,
  -- appended last so CREATE OR REPLACE VIEW can add it without a drop.
  ps.total_ml
from price_snapshots ps
join listings l on l.id = ps.listing_id and l.is_active
where ps.status = 'ok'
  and ps.parse_confidence = 'high'
  -- §2.4: the ok row must be the listing's most recent snapshot.
  and ps.crawled_at = (
    select max(p2.crawled_at) from price_snapshots p2 where p2.listing_id = ps.listing_id
  )
order by ps.listing_id, ps.crawled_at desc;

grant select on public.listing_prices_public to anon, authenticated;
