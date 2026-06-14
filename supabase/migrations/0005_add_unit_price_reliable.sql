-- §1 compromise: volume-mismatch / unverified volume must not gate the price.
-- The actual prices (base_unit_price / effective_unit_price) stay visible and
-- comparable; only the ml-based unit_price is marked unreliable and excluded from
-- ml ranking / Viewty Score ml-항목.
--
-- unit_price_reliable = false  → unit_price is NULL; row excluded from per-ml
--                                ranking but kept for base/effective comparison.
-- Defaults to true so existing rows remain in ml comparison until re-crawled.
ALTER TABLE price_snapshots
  ADD COLUMN IF NOT EXISTS unit_price_reliable BOOLEAN NOT NULL DEFAULT TRUE;
