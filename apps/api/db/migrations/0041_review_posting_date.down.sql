-- Reverse 0041: drop the confirmed posting date column.
ALTER TABLE review_packages DROP COLUMN IF EXISTS approved_posting_date;
