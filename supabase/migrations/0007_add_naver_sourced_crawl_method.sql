-- Add 'naver_sourced' to the listings.crawl_method CHECK (final spec §2/§3).
--
-- OliveYoung prices are no longer crawled (Playwright retired). They are read
-- from the OliveYoung offer that surfaces on the approved Naver Shopping Search
-- API. OliveYoung listings therefore move from crawl_method='playwright' to a
-- value that records this provenance: 'naver_sourced'. The original CHECK from
-- 0001 (api/html/playwright/manual) is unnamed inline, so Postgres named it
-- listings_crawl_method_check; drop and re-create it with the extra value.

ALTER TABLE listings DROP CONSTRAINT IF EXISTS listings_crawl_method_check;

ALTER TABLE listings
  ADD CONSTRAINT listings_crawl_method_check
  CHECK (crawl_method IN ('api','html','playwright','manual','naver_sourced'));

-- Re-provenance existing OliveYoung listings (seller slug 'oliveyoung').
UPDATE listings l
SET crawl_method = 'naver_sourced'
FROM sellers s
WHERE l.seller_id = s.id
  AND s.slug = 'oliveyoung'
  AND l.crawl_method = 'playwright';
