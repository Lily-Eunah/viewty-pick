-- Add shipping label fields to price_snapshots
-- shipping_fee: raw numeric value (label use only, never included in price calculations)
-- shipping_note: display label e.g. '무료배송', '3,000원', '로켓배송', '조건부 무료'
ALTER TABLE price_snapshots
  ADD COLUMN IF NOT EXISTS shipping_fee INT NULL,
  ADD COLUMN IF NOT EXISTS shipping_note TEXT NULL;
