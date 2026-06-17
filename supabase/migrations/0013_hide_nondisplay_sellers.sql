-- Hide non-display sellers from the price-comparison UI WITHOUT deleting data.
-- zigzag/ably were seeded (0003) for future expansion: link-only, not yet crawled,
-- so they have no price snapshots and were leaking into the UI as tier-4 "보기" rows.
-- Gate them out by reusing is_price_comparison_enabled as the display flag — no
-- crawler/matcher reads this column, so this is purely a render gate. Their listings
-- and links stay intact; flip the flag back to true to surface them when their
-- crawlers ship. Idempotent: safe to re-run.
UPDATE sellers SET is_price_comparison_enabled = false WHERE slug IN ('zigzag', 'ably');
