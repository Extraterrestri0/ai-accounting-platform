DROP POLICY IF EXISTS report_snapshots_isolation ON report_snapshots;
DROP POLICY IF EXISTS report_runs_isolation ON report_runs;
DROP TRIGGER IF EXISTS report_snapshots_immutable ON report_snapshots;
DROP TABLE IF EXISTS report_snapshots;
DROP TABLE IF EXISTS report_runs;
