-- SEO landing pages: add a free-form keyword column so a topic can select
-- products by synonym match (여드름·블랙헤드·미백 …) on top of category/skin/badge
-- filters. CSV of tokens, OR-matched against product name/features/tags by the
-- /best/[slug] route (see lib/seo/match.ts). Nullable; existing rows unaffected.
ALTER TABLE seo_pages ADD COLUMN IF NOT EXISTS keywords TEXT;
