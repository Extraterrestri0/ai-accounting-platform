DROP FUNCTION IF EXISTS app.authenticate_lookup(text);
-- role drop is operational, not schema rollback; left in place
DROP POLICY IF EXISTS auth_sessions_isolation ON auth_sessions;
DROP POLICY IF EXISTS memberships_isolation ON memberships;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS memberships;
ALTER TABLE users
  DROP COLUMN IF EXISTS last_login_at,
  DROP COLUMN IF EXISTS locked_until,
  DROP COLUMN IF EXISTS failed_login_attempts,
  DROP COLUMN IF EXISTS mfa_secret,
  DROP COLUMN IF EXISTS mfa_enabled,
  DROP COLUMN IF EXISTS password_algo,
  DROP COLUMN IF EXISTS password_hash;
