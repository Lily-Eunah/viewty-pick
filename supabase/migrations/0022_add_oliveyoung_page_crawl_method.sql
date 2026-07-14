-- Add 'oliveyoung_page' to the listings.crawl_method CHECK.
--
-- OliveYoung price now comes from a HEADFUL page crawl of our own curated links
-- (operator holds OliveYoung's explicit crawl permission), replacing the
-- Naver-sourced path as the primary source. The Naver Shopping API frequently has
-- no OliveYoung offer for a curated product (→ link_only), so we read title+price
-- straight from the product page instead. Mark OliveYoung listings with this
-- provenance so the source is auditable (and a future Naver-sourced fallback can
-- tell page-crawled listings apart). Mirrors 0007's drop/re-create of the inline
-- CHECK named listings_crawl_method_check.

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_crawl_method_check;

ALTER TABLE listings
  ADD CONSTRAINT listings_crawl_method_check
  CHECK (crawl_method IN ('api','html','playwright','manual','naver_sourced','oliveyoung_page'));

-- Re-provenance existing OliveYoung listings (seller slug 'oliveyoung'), which were
-- moved to 'naver_sourced' by 0007.
UPDATE listings l
SET crawl_method = 'oliveyoung_page'
FROM sellers s
WHERE l.seller_id = s.id
  AND s.slug = 'oliveyoung'
  AND l.crawl_method = 'naver_sourced';
