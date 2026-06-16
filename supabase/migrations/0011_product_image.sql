-- 0011: product image plumbing for Coupang productImage display.
--
-- The Coupang Partners search response returns a `productImage` (host
-- ads-partners.coupang.com) that members may display on their own site. We store
-- it like the deeplink cache: per-observation on price_snapshots, plus a
-- latest cache on listings. The public view exposes image_url so the web can
-- render a Coupang-sourced image as a FALLBACK behind the operator-owned
-- products.image_url (which the crawler never touches).
--
-- Non-destructive: two additive nullable columns + a CREATE OR REPLACE of the
-- 0010 view with image_url APPENDED as the last column (Postgres only allows
-- CREATE OR REPLACE VIEW to add columns at the end). Grants/filter/columns/
-- security_invoker are otherwise unchanged.

alter table price_snapshots add column if not exists image_url text;
alter table listings       add column if not exists latest_image_url text;

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
  -- appended last so CREATE OR REPLACE VIEW can add it without a drop.
  ps.image_url
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
