DROP POLICY IF EXISTS review_comments_isolation ON review_comments;
DROP POLICY IF EXISTS review_actions_isolation ON review_actions;
DROP POLICY IF EXISTS review_packages_isolation ON review_packages;
DROP TRIGGER IF EXISTS review_comments_immutable ON review_comments;
DROP TRIGGER IF EXISTS review_actions_immutable ON review_actions;
DROP TABLE IF EXISTS review_comments;
DROP TABLE IF EXISTS review_actions;
DROP TABLE IF EXISTS review_packages;
