import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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

  it('adds company_groups and company_profiles.group_key on a brand new database', () => {
    const db = openDatabase(dbPath);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    const columns = db.prepare('PRAGMA table_info(company_profiles)').all() as { name: string }[];
    db.close();

    expect(tables.map((t) => t.name)).toContain('company_groups');
    expect(columns.map((c) => c.name)).toContain('group_key');
  });

  it('migrates an existing database (only the original schema applied) without losing data', () => {
    // Simulates a real pre-existing installation: only the very first
    // migration ran (user_version = 1), so `company_groups` and
    // `company_profiles.group_key` do not exist yet, and a real branch row
    // (created by a user before this app version existed) is already there.
    mkdirSync(dirname(dbPath), { recursive: true });
    const legacyDb = new DatabaseSync(dbPath);
    legacyDb.exec(`
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE company_profiles (
        branch_code TEXT PRIMARY KEY,
        display_name TEXT,
        legal_name TEXT,
        trade_name TEXT,
        cnpj TEXT,
        address_json TEXT,
        logo_path TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE batches (id TEXT PRIMARY KEY, mode TEXT NOT NULL, source_original_name TEXT NOT NULL,
        source_archived_path TEXT, source_hash TEXT, imported_at TEXT NOT NULL, source_row_count INTEGER,
        output_count INTEGER, status TEXT NOT NULL, app_version TEXT, warning_json TEXT);
      CREATE TABLE documents (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches (id), mode TEXT NOT NULL,
        branch_code TEXT NOT NULL, branch_name TEXT, seller_code TEXT NOT NULL, seller_name TEXT,
        source_row_count INTEGER, commission_total TEXT, pdf_path TEXT, generated_at TEXT NOT NULL, template_version TEXT);
      PRAGMA user_version = 1;
    `);
    legacyDb.prepare(
      `INSERT INTO company_profiles (branch_code, display_name, cnpj, active, updated_at)
       VALUES ('0103', 'PERMETAL SAO PAULO - EDITADO PELO USUARIO', '11.111.111/0001-11', 1, '2026-01-01T00:00:00.000Z')`
    ).run();
    legacyDb.close();

    const db = openDatabase(dbPath);
    const columns = db.prepare('PRAGMA table_info(company_profiles)').all() as { name: string }[];
    const preExisting = db.prepare('SELECT * FROM company_profiles WHERE branch_code = ?').get('0103') as
      | Record<string, unknown>
      | undefined;
    db.close();

    expect(columns.map((c) => c.name)).toContain('group_key');
    // A filial cadastrada antes desta versao deve permanecer intacta apos a migracao.
    expect(preExisting?.display_name).toBe('PERMETAL SAO PAULO - EDITADO PELO USUARIO');
    expect(preExisting?.cnpj).toBe('11.111.111/0001-11');
    expect(preExisting?.group_key).toBeNull();
  });
});
