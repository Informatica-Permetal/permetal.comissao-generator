import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from './database';

/**
 * Test-only: opens a database exactly the way production does, then relaxes SQLite's
 * durability guarantees (no fsync per commit, in-memory rollback journal instead of an
 * on-disk `-journal` file). Safe ONLY because these are throwaway temp-directory databases
 * deleted at the end of every test - never real user data, never the production code path
 * (`openDatabase` itself, used by `main/index.ts`, is untouched).
 *
 * Exists because production's defaults (full fsync + on-disk rollback journal - correct and
 * required for real user data) make write-heavy tests disproportionately slow on GitHub
 * Actions' Windows runners, whose disk I/O is measurably slower than a local dev machine's -
 * slow enough to occasionally brush against Vitest's default 5s per-test timeout on the tests
 * that issue the most SQLite write transactions (e.g. seeding 7 branches × 2 writes each).
 */
export function openTestDatabase(path: string): DatabaseSync {
  const db = openDatabase(path);
  db.exec('PRAGMA synchronous = OFF');
  db.exec('PRAGMA journal_mode = MEMORY');
  return db;
}
