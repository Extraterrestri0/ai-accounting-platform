DROP POLICY IF EXISTS posting_results_isolation ON posting_results;
DROP POLICY IF EXISTS posting_requests_isolation ON posting_requests;
DROP TRIGGER IF EXISTS posting_results_immutable ON posting_results;
DROP TABLE IF EXISTS posting_results;
DROP TABLE IF EXISTS posting_requests;
