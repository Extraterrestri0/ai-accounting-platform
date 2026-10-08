/**
 * Gate for real-DB (release-blocking) test suites.
 *
 * - PG env present  → the suite RUNS (CI provisions Postgres + roles + migrations).
 * - CI_REQUIRE_DB=1 → a missing DB is a FAILING test (no silent skip — enforced in CI).
 * - otherwise (local, no DB) → the suite skips so `npm test` stays green for contributors.
 *
 * This removes "automatic skipping" in CI: with CI_REQUIRE_DB=1 the suites cannot silently
 * no-op — they either execute or fail the build.
 */
const HAVE_DB = !!(process.env.PGHOST && process.env.PGUSER && process.env.MIGRATION_USER);
const REQUIRE_DB = process.env.CI_REQUIRE_DB === '1';

export function dbDescribe(name: string, fn: () => void): void {
  if (HAVE_DB) { describe(name, fn); return; }
  if (REQUIRE_DB) {
    describe(name, () => {
      it('release-blocking DB suite was not executed but CI_REQUIRE_DB=1', () => {
        throw new Error(`${name}: PGHOST/PGUSER/MIGRATION_USER must be set so this suite runs in CI`);
      });
    });
    return;
  }
  describe.skip(name, fn);
}
