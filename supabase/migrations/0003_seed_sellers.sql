-- Seed static seller master data
INSERT INTO sellers (slug, name, priority, collect_method, is_affiliate_supported, is_price_comparison_enabled, is_trusted)
VALUES
  ('oliveyoung', '올리브영', 1, 'crawl',      true,  true, true),
  ('coupang',    '쿠팡',    2, 'api',        true,  true, true),
  ('naver',      '네이버',  3, 'api',        false, true, true),
  ('zigzag',     '지그재그', 4, 'crawl',     false, true, true),
  ('ably',       '에이블리', 5, 'crawl',     false, true, true)
ON CONFLICT (slug) DO NOTHING;
