-- =====================================================================
-- 0041 Confirmed posting date on the review package.
-- The document-driven posting flow must use a HUMAN-confirmed accounting
-- posting date, never the server's current date. The confirmed date is
-- persisted here (one review package per document). Nullable with NO
-- default: existing/unconfirmed packages stay NULL, and posting fails
-- closed when it is absent (enforced in PostingService) — we never
-- backfill a date. Metadata-only change (no table rewrite, no lock risk).
-- =====================================================================
ALTER TABLE review_packages ADD COLUMN approved_posting_date date;
COMMENT ON COLUMN review_packages.approved_posting_date IS
  'Human-confirmed accounting posting date (Дата за осчетоводяване). Consumed by PostingService; posting is refused when NULL.';
