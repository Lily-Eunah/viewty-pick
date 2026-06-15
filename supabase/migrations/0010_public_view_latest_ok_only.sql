-- Trust-first per-store view (§2.4): a listing surfaces ONLY when its most
-- recent snapshot is itself 'ok'.
--
-- The 0008 view picked the latest status='ok' row per listing. After a
-- priced→no_offer transition (offer disappeared), the latest snapshot is
-- 'no_offer' (null price) but 0008 fell back to the previous 'ok' row and kept
-- showing the now-stale price. §2.4 requires the opposite: drop the listing, do
-- not resurrect a stale price behind a disappeared offer.
--
-- Fix: require the 'ok' row to also be the listing's latest snapshot
-- (crawled_at = max). If the newest observation is no_offer / failed / warning /
-- low-confidence, no row qualifies and the listing drops out of the view.
--
-- Columns, security_invoker=false, and grants are unchanged from 0008, so this is
-- a safe CREATE OR REPLACE. The idx_price_snapshots_listing_crawled index (0008)
-- keeps the per-listing max(crawled_at) lookup fast.

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
  ps.crawled_at
from price_snapshots ps
join listings l on l.id = ps.listing_id and l.is_active
where ps.status = 'ok'
  and ps.parse_confidence = 'high'
  -- §2.4: the ok row must be the listing's most recent snapshot.
  and ps.crawled_at = (
    select max(p2.crawled_at) from price_snapshots p2 where p2.listing_id = ps.listing_id
  )
order by ps.listing_id, ps.crawled_at desc;
