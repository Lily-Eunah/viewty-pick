-- Public per-store latest-price view (option C).
--
-- Problem: the product detail page reads per-store prices straight from
-- price_snapshots, but that table is intentionally locked to anon (DESIGN §13 —
-- batch-only raw history). anon therefore gets 0 rows and no price renders.
--
-- Option A (anon SELECT policy on the raw table) is rejected: RLS filters rows,
-- not columns, so it would leak source_text / status / parse_confidence and the
-- whole batch-internal history. Instead we keep price_snapshots locked and expose
-- ONLY a safe projection: latest snapshot per listing, safe columns, displayable
-- rows. RLS on price_snapshots is NOT touched here.
--
-- security_invoker = false (the default, stated explicitly): the view runs with
-- its owner's privileges and so bypasses the raw table's RLS by design. This is
-- the whole point of the projection; Supabase advisor flags it as a
-- "security definer view" — accepted, see worklog security note.

-- Optimise the latest-per-listing lookup (distinct on / order by crawled_at desc).
create index if not exists idx_price_snapshots_listing_crawled
  on price_snapshots (listing_id, crawled_at desc);

create view public.listing_prices_public
with (security_invoker = false)
as
select distinct on (ps.listing_id)
  ps.listing_id,
  ps.product_id,
  l.seller_id,
  ps.sale_price,
  ps.base_unit_price,
  ps.effective_unit_price,
  -- §1 compromise: only expose the ml-based unit_price when it is reliable;
  -- otherwise NULL (base/effective stay visible and comparable).
  case when ps.unit_price_reliable then ps.unit_price end as unit_price,
  ps.promo_type,
  ps.promo_text,
  ps.in_stock,
  ps.shipping_note,
  ps.matched_mall_name,
  ps.crawled_at
from price_snapshots ps
join listings l on l.id = ps.listing_id and l.is_active
-- comparison-exclusion policy: only displayable rows surface.
where ps.status = 'ok' and ps.parse_confidence = 'high'
order by ps.listing_id, ps.crawled_at desc;

-- Internal columns (source_text, status, parse_confidence, regular_price,
-- min/paid/free/total_quantity, total_ml, shipping_fee, matched_url, id) are
-- deliberately NOT selected — they never reach anon.

grant select on public.listing_prices_public to anon, authenticated;
