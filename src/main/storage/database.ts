import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS company_profiles (
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

  CREATE TABLE IF NOT EXISTS batches (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    source_original_name TEXT NOT NULL,
    source_archived_path TEXT,
    source_hash TEXT,
    imported_at TEXT NOT NULL,
    source_row_count INTEGER,
    output_count INTEGER,
    status TEXT NOT NULL,
    app_version TEXT,
    warning_json TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_batches_mode ON batches (mode);
  CREATE INDEX IF NOT EXISTS idx_batches_imported_at ON batches (imported_at);

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    batch_id TEXT NOT NULL REFERENCES batches (id),
    mode TEXT NOT NULL,
    branch_code TEXT NOT NULL,
    branch_name TEXT,
    seller_code TEXT NOT NULL,
    seller_name TEXT,
    source_row_count INTEGER,
    commission_total TEXT,
    pdf_path TEXT,
    generated_at TEXT NOT NULL,
    template_version TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_documents_batch_id ON documents (batch_id);
  CREATE INDEX IF NOT EXISTS idx_documents_mode ON documents (mode);
  CREATE INDEX IF NOT EXISTS idx_documents_branch_code ON documents (branch_code);
  CREATE INDEX IF NOT EXISTS idx_documents_seller_code ON documents (seller_code);
  CREATE INDEX IF NOT EXISTS idx_documents_generated_at ON documents (generated_at);
  `,
  `
  CREATE TABLE IF NOT EXISTS company_groups (
    group_key TEXT PRIMARY KEY,
    display_name TEXT,
    legal_name TEXT,
    headquarters_branch_code TEXT,
    headquarters_cnpj TEXT,
    headquarters_address_json TEXT,
    updated_at TEXT NOT NULL
  );

  ALTER TABLE company_profiles ADD COLUMN group_key TEXT REFERENCES company_groups (group_key);
  CREATE INDEX IF NOT EXISTS idx_company_profiles_group_key ON company_profiles (group_key);
  `,
  `
  ALTER TABLE documents ADD COLUMN grouping_mode TEXT NOT NULL DEFAULT 'separate_by_branch';

  CREATE TABLE IF NOT EXISTS document_branches (
    document_id TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    branch_code TEXT NOT NULL,
    branch_name TEXT,
    position INTEGER NOT NULL,
    row_count INTEGER NOT NULL,
    subtotal TEXT NOT NULL,
    PRIMARY KEY (document_id, branch_code)
  );
  CREATE INDEX IF NOT EXISTS idx_document_branches_branch_code ON document_branches (branch_code);

  INSERT INTO document_branches (document_id, branch_code, branch_name, position, row_count, subtotal)
  SELECT id, branch_code, branch_name, 0, COALESCE(source_row_count, 0), COALESCE(commission_total, '-')
  FROM documents;
  `,
  `
  CREATE TABLE IF NOT EXISTS batch_seller_grouping (
    batch_id TEXT NOT NULL REFERENCES batches (id) ON DELETE CASCADE,
    seller_code TEXT NOT NULL,
    grouping_mode TEXT NOT NULL,
    PRIMARY KEY (batch_id, seller_code)
  );

  INSERT OR IGNORE INTO batch_seller_grouping (batch_id, seller_code, grouping_mode)
  SELECT DISTINCT batch_id, seller_code, grouping_mode FROM documents;
  `
];

export function openDatabase(databasePath: string): DatabaseSync {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON');
  try {
    runMigrations(db);
  } catch (error) {
    db.close();
    throw error;
  }
  return db;
}

/**
 * Each migration's DDL/backfill and its `user_version` bump commit as one
 * atomic transaction - if the process is killed mid-migration, SQLite's
 * transaction atomicity guarantees the database lands on EITHER the old
 * version (nothing applied) or the new one (everything applied +
 * user_version bumped), never a half-applied state that would crash every
 * future launch by re-running DDL that already partially succeeded.
 */
function runMigrations(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let version = row.user_version; version < MIGRATIONS.length; version++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}
