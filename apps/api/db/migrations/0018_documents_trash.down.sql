ALTER TABLE documents DROP COLUMN IF EXISTS trashed_at;
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_status_check CHECK (status IN (
    'pending_upload','uploaded','scanning','ready','quarantined','failed'));
