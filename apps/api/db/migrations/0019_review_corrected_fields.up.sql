-- =====================================================================
-- 0019 Human field corrections on the review package.
-- The AI extraction is immutable (append-only); human corrections / added fields
-- live here as a key→value map and are overlaid for display + feed the suggestion/posting.
-- =====================================================================
ALTER TABLE review_packages ADD COLUMN IF NOT EXISTS corrected_fields jsonb NOT NULL DEFAULT '{}'::jsonb;
