-- 마스터 테이블 정의
CREATE TABLE categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

CREATE TABLE sellers (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  priority INT,
  collect_method TEXT CHECK (collect_method IN ('api','crawl')),
  is_affiliate_supported BOOLEAN DEFAULT false,
  is_price_comparison_enabled BOOLEAN DEFAULT true, -- 브랜드 공식몰 등은 false
  is_trusted BOOLEAN DEFAULT true
);

CREATE TABLE products (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  product_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  volume_ml NUMERIC,
  image_url TEXT,
  features TEXT,
  skin_types TEXT[] DEFAULT '{}',
  hwahae_url TEXT,
  official_info_url TEXT,
  viewty_score NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'sheet',
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE badges (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE product_badges (
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  badge_id BIGINT REFERENCES badges(id) ON DELETE CASCADE,
  detail TEXT,
  source_title TEXT,
  ref_url TEXT,
  source_date DATE,
  PRIMARY KEY (product_id, badge_id)
);

CREATE TABLE listings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_key TEXT UNIQUE NOT NULL,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  seller_id BIGINT REFERENCES sellers(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  affiliate_url TEXT,
  store_name TEXT,
  is_official_store BOOLEAN DEFAULT false,
  is_rocket BOOLEAN DEFAULT false,
  crawl_enabled BOOLEAN DEFAULT true,
  crawl_method TEXT CHECK (crawl_method IN ('api','html','playwright','manual')),
  last_crawled_at TIMESTAMPTZ,
  fail_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE retailer_allowlist (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seller_id BIGINT REFERENCES sellers(id) ON DELETE CASCADE,
  brand TEXT,
  allowed_store_name TEXT,
  is_active BOOLEAN DEFAULT true
);

-- 가격 테이블 정의
CREATE TABLE price_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id BIGINT REFERENCES listings(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  crawled_at TIMESTAMPTZ DEFAULT NOW(),
  regular_price INT,
  sale_price INT,
  base_unit_price INT, -- 조건 없이 1개 구매가
  promo_type TEXT,
  promo_text TEXT,
  min_quantity INT,
  paid_quantity INT,
  free_quantity INT,
  total_quantity INT,
  total_ml NUMERIC,
  unit_price NUMERIC, -- ml당 가격 (price / total_ml)
  effective_unit_price INT, -- 1+1 등 적용 시의 실질 개당 가격
  in_stock BOOLEAN DEFAULT true,
  source_text TEXT,
  parse_confidence TEXT CHECK (parse_confidence IN ('high','low')) DEFAULT 'high',
  status TEXT CHECK (status IN ('ok','warning','failed')) DEFAULT 'ok'
);

CREATE TABLE current_prices (
  product_id BIGINT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  base_lowest_price INT,
  base_lowest_seller TEXT,
  base_lowest_listing_id BIGINT,
  promo_lowest_unit_price INT,
  promo_lowest_seller TEXT,
  promo_label TEXT,
  has_promotion BOOLEAN DEFAULT false,
  last_checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE manual_overrides (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  seller_id BIGINT REFERENCES sellers(id) ON DELETE CASCADE,
  override_type TEXT,
  value TEXT,
  reason TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- 로그 및 집계 테이블 정의
CREATE TABLE affiliate_clicks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id BIGINT,
  listing_id BIGINT,
  seller_code TEXT,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  referrer TEXT,
  page_path TEXT,
  user_agent_hash TEXT,
  session_id TEXT
);

CREATE TABLE crawl_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status TEXT,
  total_links INT,
  success_count INT,
  warning_count INT,
  failure_count INT,
  summary JSONB
);

CREATE TABLE crawl_errors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  crawl_run_id BIGINT REFERENCES crawl_runs(id) ON DELETE CASCADE,
  product_id BIGINT,
  listing_id BIGINT,
  seller_code TEXT,
  error_type TEXT,
  severity TEXT CHECK (severity IN ('info','warning','critical')),
  message TEXT,
  raw_context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sheet_import_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status TEXT,
  products_count INT,
  links_count INT,
  badges_count INT,
  error_count INT,
  summary JSONB
);

CREATE TABLE seo_pages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  page_type TEXT,
  title TEXT,
  h1 TEXT,
  description TEXT,
  category TEXT,
  skin_type TEXT,
  badge_type TEXT,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE score_config (
  key TEXT PRIMARY KEY,
  value NUMERIC
);

-- score_config 가중치 시드 데이터 삽입
INSERT INTO score_config (key, value) VALUES
  ('directorpi', 25),
  ('hwahae_rank', 15),
  ('oliveyoung_best', 15),
  ('multi_source', 10),
  ('perml_top30', 15),
  ('base_below_avg10', 10),
  ('has_effective', 5),
  ('price_drop_7d', 5),
  ('seller_oliveyoung', 5),
  ('seller_coupang', 5),
  ('seller_naver', 5),
  ('sellers_3plus', 5);
