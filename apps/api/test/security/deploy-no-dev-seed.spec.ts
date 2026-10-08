/**
 * Static regression test for Finding B (predictable demo credentials in production).
 * Proves, without running anything, that:
 *   1) the production deploy script never invokes the dev/demo seed and never prints the
 *      demo credential, and
 *   2) the dev seed is fail-closed (refuses to run without an explicit opt-in), and
 *   3) no migration auto-creates a predictable credential (a user row carrying a password).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const apiRoot = path.resolve(__dirname, '..', '..');            // apps/api
const repoRoot = path.resolve(apiRoot, '..', '..');             // repo root
const read = (p: string) => fs.readFileSync(p, 'utf8');

describe('production deploy does not seed predictable credentials', () => {
  const deploy = read(path.join(repoRoot, 'infra', 'deploy-sofia.sh'));

  it('deploy-sofia.sh does not execute seed-dev.sql', () => {
    // no uncommented line may pipe/run the dev seed
    const runsSeed = deploy.split('\n').some((l) => {
      const code = l.replace(/#.*$/, '');
      return /seed-dev\.sql/.test(code) && /psql|<|exec|-f\b/.test(code);
    });
    expect(runsSeed).toBe(false);
  });

  it('deploy-sofia.sh does not print the demo credential', () => {
    expect(/demo@demo\.bg/.test(deploy)).toBe(false);
    expect(/Demo1234/.test(deploy)).toBe(false);
  });
});

describe('dev seed is fail-closed (opt-in only)', () => {
  const seed = read(path.join(apiRoot, 'scripts', 'seed-dev.sql'));

  it('refuses to run without allow_dev_seed and quits before writing', () => {
    expect(seed).toMatch(/allow_dev_seed/);
    expect(seed).toMatch(/\\quit/);
    // the guard (and its \quit) must appear before the first INSERT
    const guardAt = seed.indexOf('\\quit');
    const firstInsert = seed.search(/INSERT\s+INTO/i);
    expect(guardAt).toBeGreaterThan(-1);
    expect(firstInsert).toBeGreaterThan(guardAt);
  });
});

describe('no migration auto-creates a predictable credential', () => {
  const dir = path.join(apiRoot, 'db', 'migrations');
  const upFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.up.sql'));

  it('no *.up.sql inserts a users row that carries a password hash', () => {
    const offenders: string[] = [];
    for (const f of upFiles) {
      const sql = read(path.join(dir, f));
      // an INSERT INTO users that also supplies a password_hash column value
      const insertsUserWithPassword =
        /INSERT\s+INTO\s+users\b[\s\S]*?password_hash/i.test(sql) &&
        !/p_password_hash|\$\d|function|RETURNING/i.test(
          (sql.match(/INSERT\s+INTO\s+users\b[\s\S]*?;/i) ?? [''])[0],
        );
      if (insertsUserWithPassword) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });

  it('no migration hardcodes the demo credential', () => {
    for (const f of upFiles) {
      const sql = read(path.join(dir, f));
      expect(/Demo1234/.test(sql)).toBe(false);
      // referencing demo@demo.bg is only allowed in a conditional SELECT (CMS owner link),
      // never together with a password_hash in the same statement.
      if (/demo@demo\.bg/.test(sql)) {
        expect(/password_hash/i.test(sql)).toBe(false);
      }
    }
  });
});
