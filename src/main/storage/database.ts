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
  `
];

export function openDatabase(databasePath: string): DatabaseSync {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON');
  runMigrations(db);
  return db;
}

function runMigrations(db: DatabaseSync): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let version = row.user_version; version < MIGRATIONS.length; version++) {
    db.exec(MIGRATIONS[version]);
    db.exec(`PRAGMA user_version = ${version + 1}`);
  }
}
