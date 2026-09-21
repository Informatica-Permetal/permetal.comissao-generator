import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openTestDatabase } from './testDatabase';

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
    const db = openTestDatabase(dbPath);
    db.close();
    expect(existsSync(dbPath)).toBe(true);
  });

  it('creates the baseline schema (settings, company_profiles, batches, documents)', () => {
    const db = openTestDatabase(dbPath);
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
    openTestDatabase(dbPath).close();
    expect(() => openTestDatabase(dbPath).close()).not.toThrow();
  });

  it('adds company_groups and company_profiles.group_key on a brand new database', () => {
    const db = openTestDatabase(dbPath);
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

    const db = openTestDatabase(dbPath);
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

  it('adds documents.grouping_mode and the document_branches table on a brand new database', () => {
    const db = openTestDatabase(dbPath);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    const columns = db.prepare('PRAGMA table_info(documents)').all() as { name: string }[];
    db.close();

    expect(tables.map((t) => t.name)).toContain('document_branches');
    expect(columns.map((c) => c.name)).toContain('grouping_mode');
  });

  it('migrates an existing database with real historical documents into grouping_mode + document_branches without losing data', () => {
    // Simulates a real pre-Fase-5 installation: migrations 0 and 1 already
    // applied (user_version = 2), with a real document already generated
    // and registered under the OLD single-branch-per-document shape.
    mkdirSync(dirname(dbPath), { recursive: true });
    const legacyDb = new DatabaseSync(dbPath);
    legacyDb.exec(`
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE company_groups (
        group_key TEXT PRIMARY KEY, display_name TEXT, legal_name TEXT,
        headquarters_branch_code TEXT, headquarters_cnpj TEXT, headquarters_address_json TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE company_profiles (
        branch_code TEXT PRIMARY KEY, display_name TEXT, legal_name TEXT, trade_name TEXT, cnpj TEXT,
        address_json TEXT, logo_path TEXT, group_key TEXT REFERENCES company_groups (group_key),
        active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
      );
      CREATE TABLE batches (id TEXT PRIMARY KEY, mode TEXT NOT NULL, source_original_name TEXT NOT NULL,
        source_archived_path TEXT, source_hash TEXT, imported_at TEXT NOT NULL, source_row_count INTEGER,
        output_count INTEGER, status TEXT NOT NULL, app_version TEXT, warning_json TEXT);
      CREATE TABLE documents (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches (id), mode TEXT NOT NULL,
        branch_code TEXT NOT NULL, branch_name TEXT, seller_code TEXT NOT NULL, seller_name TEXT,
        source_row_count INTEGER, commission_total TEXT, pdf_path TEXT, generated_at TEXT NOT NULL, template_version TEXT);
      PRAGMA user_version = 2;
    `);
    legacyDb.prepare(
      `INSERT INTO batches (id, mode, source_original_name, source_hash, imported_at, source_row_count, output_count, status, app_version)
       VALUES ('batch-1', 'Relacao', 'relacao.xlsx', 'hash', '2026-06-01T00:00:00.000Z', 1, 1, 'completed', '1.0.0')`
    ).run();
    legacyDb.prepare(
      `INSERT INTO documents (id, batch_id, mode, branch_code, branch_name, seller_code, seller_name, source_row_count, commission_total, pdf_path, generated_at, template_version)
       VALUES ('doc-1', 'batch-1', 'Relacao', '0103', 'PERMETAL SAO PAULO', '000001', 'ADEMIR FURLANETO', 3, 'R$ 150,00', 'C:/pdf/doc-1.pdf', '2026-06-01T00:00:00.000Z', '1')`
    ).run();
    legacyDb.close();

    const db = openTestDatabase(dbPath);
    const documentColumns = db.prepare('PRAGMA table_info(documents)').all() as { name: string }[];
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get('doc-1') as Record<string, unknown>;
    const branches = db
      .prepare('SELECT * FROM document_branches WHERE document_id = ? ORDER BY position')
      .all('doc-1') as Record<string, unknown>[];
    db.close();

    expect(documentColumns.map((c) => c.name)).toContain('grouping_mode');
    // O documento pre-existente nunca perde seus dados e passa a ter um modo explicito.
    expect(document.grouping_mode).toBe('separate_by_branch');
    expect(document.branch_code).toBe('0103');
    expect(document.commission_total).toBe('R$ 150,00');
    // O backfill cria exatamente uma associacao em document_branches, espelhando os dados antigos.
    expect(branches).toHaveLength(1);
    expect(branches[0].branch_code).toBe('0103');
    expect(branches[0].branch_name).toBe('PERMETAL SAO PAULO');
    expect(branches[0].position).toBe(0);
    expect(branches[0].row_count).toBe(3);
    expect(branches[0].subtotal).toBe('R$ 150,00');
  });

  it('remove document_branches automaticamente quando o documento correspondente e excluido (cascade)', () => {
    const db = openTestDatabase(dbPath);
    db.prepare(
      `INSERT INTO batches (id, mode, source_original_name, source_hash, imported_at, source_row_count, output_count, status, app_version)
       VALUES ('batch-1', 'Relacao', 'relacao.xlsx', 'hash', '2026-06-01T00:00:00.000Z', 1, 1, 'completed', '1.0.0')`
    ).run();
    db.prepare(
      `INSERT INTO documents (id, batch_id, mode, grouping_mode, branch_code, branch_name, seller_code, seller_name, source_row_count, commission_total, pdf_path, generated_at, template_version)
       VALUES ('doc-1', 'batch-1', 'Relacao', 'separate_by_branch', '0103', 'PERMETAL SAO PAULO', '000001', 'ADEMIR FURLANETO', 1, 'R$ 10,00', 'C:/pdf/doc-1.pdf', '2026-06-01T00:00:00.000Z', '1')`
    ).run();
    db.prepare(
      `INSERT INTO document_branches (document_id, branch_code, branch_name, position, row_count, subtotal)
       VALUES ('doc-1', '0103', 'PERMETAL SAO PAULO', 0, 1, 'R$ 10,00')`
    ).run();

    db.prepare('DELETE FROM documents WHERE id = ?').run('doc-1');
    const remaining = db.prepare('SELECT * FROM document_branches WHERE document_id = ?').all('doc-1');
    db.close();

    expect(remaining).toHaveLength(0);
  });

  it('preenche row_count/subtotal com os defaults do COALESCE quando um documento historico tem esses campos NULL', () => {
    // Uma instalacao real antiga pode ter documentos com commission_total/source_row_count
    // NULL (rowToHistoryDocument ja trata esse caso com `?? '-'`) - o backfill da migracao
    // precisa lidar com isso tambem, sem quebrar a constraint NOT NULL de document_branches.
    mkdirSync(dirname(dbPath), { recursive: true });
    const legacyDb = new DatabaseSync(dbPath);
    legacyDb.exec(`
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE company_groups (
        group_key TEXT PRIMARY KEY, display_name TEXT, legal_name TEXT,
        headquarters_branch_code TEXT, headquarters_cnpj TEXT, headquarters_address_json TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE company_profiles (
        branch_code TEXT PRIMARY KEY, display_name TEXT, legal_name TEXT, trade_name TEXT, cnpj TEXT,
        address_json TEXT, logo_path TEXT, group_key TEXT REFERENCES company_groups (group_key),
        active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
      );
      CREATE TABLE batches (id TEXT PRIMARY KEY, mode TEXT NOT NULL, source_original_name TEXT NOT NULL,
        source_archived_path TEXT, source_hash TEXT, imported_at TEXT NOT NULL, source_row_count INTEGER,
        output_count INTEGER, status TEXT NOT NULL, app_version TEXT, warning_json TEXT);
      CREATE TABLE documents (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches (id), mode TEXT NOT NULL,
        branch_code TEXT NOT NULL, branch_name TEXT, seller_code TEXT NOT NULL, seller_name TEXT,
        source_row_count INTEGER, commission_total TEXT, pdf_path TEXT, generated_at TEXT NOT NULL, template_version TEXT);
      PRAGMA user_version = 2;
    `);
    legacyDb.prepare(
      `INSERT INTO batches (id, mode, source_original_name, source_hash, imported_at, source_row_count, output_count, status, app_version)
       VALUES ('batch-1', 'Relacao', 'relacao.xlsx', 'hash', '2026-06-01T00:00:00.000Z', 1, 1, 'completed', '1.0.0')`
    ).run();
    legacyDb.prepare(
      `INSERT INTO documents (id, batch_id, mode, branch_code, branch_name, seller_code, seller_name, source_row_count, commission_total, pdf_path, generated_at, template_version)
       VALUES ('doc-null', 'batch-1', 'Relacao', '0103', NULL, '000001', 'ADEMIR FURLANETO', NULL, NULL, 'C:/pdf/doc-null.pdf', '2026-06-01T00:00:00.000Z', '1')`
    ).run();
    legacyDb.close();

    const db = openTestDatabase(dbPath);
    const branch = db
      .prepare('SELECT * FROM document_branches WHERE document_id = ?')
      .get('doc-null') as Record<string, unknown>;
    db.close();

    expect(branch.row_count).toBe(0);
    expect(branch.subtotal).toBe('-');
    expect(branch.branch_code).toBe('0103');
  });

  it('uma migracao que falha no meio nunca avanca user_version nem deixa DDL parcial - tudo ou nada', () => {
    // Constroi um banco na versao 2 (migracoes 0 e 1 ja aplicadas), mas sabota a migracao 2
    // de propósito: pre-insere em document_branches exatamente a linha que o backfill da
    // migracao tentaria inserir de novo, forcando uma violacao de UNIQUE (document_id,
    // branch_code) no ultimo statement da migracao 2 - depois que o ALTER TABLE ADD COLUMN
    // e o CREATE TABLE ja teriam rodado com sucesso DENTRO da mesma transacao.
    mkdirSync(dirname(dbPath), { recursive: true });
    const legacyDb = new DatabaseSync(dbPath);
    legacyDb.exec(`
      CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE company_groups (
        group_key TEXT PRIMARY KEY, display_name TEXT, legal_name TEXT,
        headquarters_branch_code TEXT, headquarters_cnpj TEXT, headquarters_address_json TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE company_profiles (
        branch_code TEXT PRIMARY KEY, display_name TEXT, legal_name TEXT, trade_name TEXT, cnpj TEXT,
        address_json TEXT, logo_path TEXT, group_key TEXT REFERENCES company_groups (group_key),
        active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL
      );
      CREATE TABLE batches (id TEXT PRIMARY KEY, mode TEXT NOT NULL, source_original_name TEXT NOT NULL,
        source_archived_path TEXT, source_hash TEXT, imported_at TEXT NOT NULL, source_row_count INTEGER,
        output_count INTEGER, status TEXT NOT NULL, app_version TEXT, warning_json TEXT);
      CREATE TABLE documents (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES batches (id), mode TEXT NOT NULL,
        branch_code TEXT NOT NULL, branch_name TEXT, seller_code TEXT NOT NULL, seller_name TEXT,
        source_row_count INTEGER, commission_total TEXT, pdf_path TEXT, generated_at TEXT NOT NULL, template_version TEXT);
      -- Pre-cria document_branches e ja insere a linha que a migracao 2 tentaria criar de novo,
      -- para o backfill (INSERT sem ON CONFLICT) falhar com violacao de chave primaria.
      CREATE TABLE document_branches (
        document_id TEXT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
        branch_code TEXT NOT NULL, branch_name TEXT, position INTEGER NOT NULL,
        row_count INTEGER NOT NULL, subtotal TEXT NOT NULL,
        PRIMARY KEY (document_id, branch_code)
      );
      PRAGMA user_version = 2;
    `);
    legacyDb.prepare(
      `INSERT INTO batches (id, mode, source_original_name, source_hash, imported_at, source_row_count, output_count, status, app_version)
       VALUES ('batch-1', 'Relacao', 'relacao.xlsx', 'hash', '2026-06-01T00:00:00.000Z', 1, 1, 'completed', '1.0.0')`
    ).run();
    legacyDb.prepare(
      `INSERT INTO documents (id, batch_id, mode, branch_code, branch_name, seller_code, seller_name, source_row_count, commission_total, pdf_path, generated_at, template_version)
       VALUES ('doc-1', 'batch-1', 'Relacao', '0103', 'PERMETAL SAO PAULO', '000001', 'ADEMIR FURLANETO', 1, 'R$ 10,00', 'C:/pdf/doc-1.pdf', '2026-06-01T00:00:00.000Z', '1')`
    ).run();
    // Sabotagem: a mesma linha que o backfill da migracao 2 vai tentar inserir.
    legacyDb.prepare(
      `INSERT INTO document_branches (document_id, branch_code, branch_name, position, row_count, subtotal)
       VALUES ('doc-1', '0103', 'PERMETAL SAO PAULO', 0, 1, 'R$ 10,00')`
    ).run();
    legacyDb.close();

    expect(() => openTestDatabase(dbPath)).toThrow();

    // Reabre com uma conexao totalmente nova para ler o estado REAL persistido em disco,
    // nao um cache em memoria da conexao que falhou.
    const inspectDb = new DatabaseSync(dbPath);
    const version = (inspectDb.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
    const documentsColumns = (inspectDb.prepare('PRAGMA table_info(documents)').all() as { name: string }[]).map(
      (c) => c.name
    );
    inspectDb.close();

    // A versao NUNCA avancou - a proxima tentativa de abrir o banco vai re-executar a
    // migracao 2 do zero, exatamente como se a falha nunca tivesse feito nenhum progresso.
    expect(version).toBe(2);
    // O ALTER TABLE ADD COLUMN, que rodou ANTES do statement que falhou dentro da MESMA
    // transacao, foi desfeito junto - nunca fica pela metade.
    expect(documentsColumns).not.toContain('grouping_mode');
  });
});
