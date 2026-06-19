-- 0016: Create waitlist table for pre-launch subscriptions (launch / price alerts)
--
-- Collected information:
--   - email (unique, check format handled at API level)
--   - intent ('launch' or 'price_alert')
--   - wishlist_slugs (JSONB containing the list of products favorited during price_alert application)
--   - consent_service (boolean, required to apply)
--   - consent_marketing (boolean, optional)
--
-- Security:
--   - RLS is enabled.
--   - No SELECT, INSERT, UPDATE or DELETE policies are granted to 'anon' or 'authenticated' roles.
--   - Only service_role handles writes from the server.
--

CREATE TABLE waitlist (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  intent TEXT NOT NULL CHECK (intent IN ('launch', 'price_alert')),
  wishlist_slugs JSONB,
  consent_service BOOLEAN NOT NULL,
  consent_marketing BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
