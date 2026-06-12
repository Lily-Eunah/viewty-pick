-- 1. Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE retailer_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE score_config ENABLE ROW LEVEL SECURITY;

-- 2. Create Read-Only Policies for Public/Anonymous access
CREATE POLICY "Allow public read on active categories" ON categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public read on active sellers" ON sellers
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public read on active products" ON products
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Allow public read on badges" ON badges
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public read on product_badges" ON product_badges
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public read on active listings" ON listings
  FOR SELECT TO anon, authenticated USING (is_active = true);

CREATE POLICY "Allow public read on current_prices" ON current_prices
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public read on active seo_pages" ON seo_pages
  FOR SELECT TO anon, authenticated USING (is_active = true);

-- Note: Other tables (price_snapshots, retailer_allowlist, manual_overrides, affiliate_clicks,
-- crawl_runs, crawl_errors, sheet_import_runs, score_config) do NOT have public read policies.
-- Writes are performed using the service_role key, which bypasses RLS policies.
