-- Add 'no_offer' to price_snapshots.status.
--
-- A fetch can legitimately succeed with NO qualified offer (product not on the
-- platform, no official-mall offer, OliveYoung link-only). That is NOT a failure
-- and must not increment listings.fail_count (which would auto-deactivate a
-- healthy listing). We record such observations as status='no_offer' (null
-- prices) for diagnostics and to detect "offer disappeared" transitions.
--
-- The original CHECK from 0001 (ok/warning/failed) is unnamed inline, so Postgres
-- named it price_snapshots_status_check; drop and re-create it with the new value.
--
-- Exposure: the public view (0008) filters status='ok', and run.ts price
-- aggregation accepts only status ok/warning — so 'no_offer' rows never surface
-- to anon and never feed current_prices. No leak.

ALTER TABLE price_snapshots DROP CONSTRAINT IF EXISTS price_snapshots_status_check;

ALTER TABLE price_snapshots
  ADD CONSTRAINT price_snapshots_status_check
  CHECK (status IN ('ok','warning','failed','no_offer'));
