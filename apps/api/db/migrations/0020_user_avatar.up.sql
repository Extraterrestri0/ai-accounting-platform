-- =====================================================================
-- 0020 User profile picture.
-- Stores a small (client-resized) data URL on the user row. Tenant-isolated by
-- the existing users RLS; app_user gets a column-level UPDATE grant only for it.
-- =====================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;
GRANT UPDATE (avatar_url) ON users TO app_user;
