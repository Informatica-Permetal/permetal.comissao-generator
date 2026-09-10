import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from './database';

describe('openDatabase', () => {
  let baseDir: string;
  let dbPath: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'fc-db-'));
    dbPath = join(baseDir, 'Formatador Comissao com Espaco', 'formatador-comissao.db');
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('creates the database file and parent folder even with a space in the path', () => {
    const db = openDatabase(dbPath);
    db.close();
    expect(existsSync(dbPath)).toBe(true);
  });

  it('creates the baseline schema (settings, company_profiles, batches, documents)', () => {
    const db = openDatabase(dbPath);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    db.close();

    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining(['settings', 'company_profiles', 'batches', 'documents'])
    );
  });

  it('is idempotent across repeated opens (safe to run migrations again on every startup)', () => {
    openDatabase(dbPath).close();
    expect(() => openDatabase(dbPath).close()).not.toThrow();
  });
});
