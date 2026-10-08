-- =====================================================================
-- 0018 Document trash / soft-delete.
-- Adds 'trashed' (recoverable) and 'deleted' (purged tombstone) statuses and a
-- trashed_at timestamp. Permanent delete removes the storage object bytes and
-- tombstones the record (status='deleted') — the immutable document_versions and
-- the hash-chained audit trail are RETAINED for compliance (nothing is hard-deleted).
-- =====================================================================
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE documents
  ADD CONSTRAINT documents_status_check CHECK (status IN (
    'pending_upload','uploaded','scanning','ready','quarantined','failed','trashed','deleted'));
ALTER TABLE documents ADD COLUMN IF NOT EXISTS trashed_at timestamptz;
