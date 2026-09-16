import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from '../storage/database';
import { persistFirstRunCompletion, getReportRoot } from '../storage/settingsRepository';
import { insertBatch, getBatchById } from '../storage/batchRepository';
import { insertDocument, getDocumentById } from '../storage/documentRepository';
import { upsertCompanyProfile, setCompanyProfileLogo, getCompanyProfile } from '../companies/companyProfileRepository';
import {
  migrateLegacyAppData,
  migrateLegacyReportRootAndPaths,
  remapStoredLogoPaths,
  resolveLegacyUserDataPath
} from './migrateLegacyNaming';
import type { AppDataPaths } from '../app/paths';

let root: string;
let db: DatabaseSync;
let dbOpened = false;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'fc-migrate-naming-'));
  dbOpened = false;
});
afterEach(() => {
  if (dbOpened) db.close();
  rmSync(root, { recursive: true, force: true });
});

describe('migrateLegacyAppData', () => {
  function appDataPaths(userDataPath: string): AppDataPaths {
    return {
      userDataPath,
      logDir: join(userDataPath, 'logs'),
      databasePath: join(userDataPath, 'Formatador Comissão.db')
    };
  }

  it('nao faz nada quando nao existe pasta legada', () => {
    const paths = appDataPaths(join(root, 'Formatador Comissão'));
    migrateLegacyAppData(paths, vi.fn());
    expect(existsSync(paths.userDataPath)).toBe(false);
  });

  it('move o banco, logs e logos da pasta legada ASCII para a nova pasta acentuada', () => {
    const legacyDir = join(root, 'Formatador Comissao');
    mkdirSync(join(legacyDir, 'logs'), { recursive: true });
    mkdirSync(join(legacyDir, 'logos'), { recursive: true });
    writeFileSync(join(legacyDir, 'Formatador Comissao.db'), 'banco de dados');
    writeFileSync(join(legacyDir, 'logs', '2026-01-01.log'), 'log');
    writeFileSync(join(legacyDir, 'logos', 'PERMETAL.png'), 'logo');

    const paths = appDataPaths(join(root, 'Formatador Comissão'));
    migrateLegacyAppData(paths, vi.fn());

    expect(existsSync(legacyDir)).toBe(false);
    expect(readFileSync(join(paths.userDataPath, 'Formatador Comissão.db'), 'utf8')).toBe('banco de dados');
    expect(readFileSync(join(paths.userDataPath, 'logs', '2026-01-01.log'), 'utf8')).toBe('log');
    expect(readFileSync(join(paths.userDataPath, 'logos', 'PERMETAL.png'), 'utf8')).toBe('logo');
  });

  it('tambem move arquivos irmaos do banco (ex.: -journal) preservando o sufixo', () => {
    const legacyDir = join(root, 'Formatador Comissao');
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(join(legacyDir, 'Formatador Comissao.db'), 'banco');
    writeFileSync(join(legacyDir, 'Formatador Comissao.db-journal'), 'journal residual');

    const paths = appDataPaths(join(root, 'Formatador Comissão'));
    migrateLegacyAppData(paths, vi.fn());

    expect(readFileSync(join(paths.userDataPath, 'Formatador Comissão.db'), 'utf8')).toBe('banco');
    expect(readFileSync(join(paths.userDataPath, 'Formatador Comissão.db-journal'), 'utf8')).toBe('journal residual');
  });

  it('e idempotente: rodar duas vezes nao apaga nem duplica', () => {
    const legacyDir = join(root, 'Formatador Comissao');
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(join(legacyDir, 'Formatador Comissao.db'), 'banco');

    const paths = appDataPaths(join(root, 'Formatador Comissão'));
    migrateLegacyAppData(paths, vi.fn());
    migrateLegacyAppData(paths, vi.fn());

    expect(readFileSync(join(paths.userDataPath, 'Formatador Comissão.db'), 'utf8')).toBe('banco');
  });

  it('resolveLegacyUserDataPath aponta para o irmao ASCII do userDataPath atual', () => {
    const paths = appDataPaths(join(root, 'Formatador Comissão'));
    expect(resolveLegacyUserDataPath(paths)).toBe(join(root, 'Formatador Comissao'));
  });
});

describe('remapStoredLogoPaths', () => {
  beforeEach(() => {
    db = openDatabase(join(root, 'app.db'));
    dbOpened = true;
  });

  it('reescreve logo_path apos o diretorio de dados ter sido migrado', () => {
    const oldUserData = join(root, 'Formatador Comissao');
    const newUserData = join(root, 'Formatador Comissão');
    upsertCompanyProfile(db, { branchCode: '0103', displayName: 'PERMETAL SAO PAULO', active: true });
    setCompanyProfileLogo(db, '0103', join(oldUserData, 'logos', 'PERMETAL.png'));

    remapStoredLogoPaths(db, oldUserData, newUserData);

    expect(getCompanyProfile(db, '0103')?.logoPath).toBe(join(newUserData, 'logos', 'PERMETAL.png'));
  });

  it('nao mexe em perfis sem logo', () => {
    upsertCompanyProfile(db, { branchCode: '0199', displayName: 'FILIAL SEM LOGO', active: true });
    expect(() => remapStoredLogoPaths(db, join(root, 'old'), join(root, 'new'))).not.toThrow();
    expect(getCompanyProfile(db, '0199')?.logoPath).toBeNull();
  });
});

describe('migrateLegacyReportRootAndPaths', () => {
  beforeEach(() => {
    db = openDatabase(join(root, 'app.db'));
    dbOpened = true;
  });

  it('retorna reportRoot null quando o primeiro uso ainda nao foi concluido', () => {
    const result = migrateLegacyReportRootAndPaths(db, vi.fn());
    expect(result).toEqual({ reportRoot: null, didMigrateRootFolder: false, didMigrateModeFolders: false });
  });

  it('quando a raiz e customizada (nao e o nome padrao legado), nao renomeia a raiz - so as subpastas', () => {
    const customRoot = join(root, 'Relatorios da Minha Empresa');
    mkdirSync(join(customRoot, 'Previsao', 'Entrada'), { recursive: true });
    mkdirSync(join(customRoot, 'Relacao', 'Historico'), { recursive: true });
    writeFileSync(join(customRoot, 'Previsao', 'Entrada', 'marcador.txt'), 'x');
    persistFirstRunCompletion(db, customRoot);

    const result = migrateLegacyReportRootAndPaths(db, vi.fn());

    expect(result.didMigrateRootFolder).toBe(false);
    expect(result.didMigrateModeFolders).toBe(true);
    expect(result.reportRoot).toBe(customRoot); // raiz em si nao muda de nome
    expect(existsSync(join(customRoot, 'Previsão', 'Entrada', 'marcador.txt'))).toBe(true);
    expect(existsSync(join(customRoot, 'Relação', 'Histórico'))).toBe(true);
    expect(getReportRoot(db)).toBe(customRoot);
  });

  it('quando a raiz e o nome padrao legado, renomeia a propria pasta raiz e persiste o novo caminho', () => {
    const legacyRoot = join(root, 'Formatador Comissao');
    mkdirSync(join(legacyRoot, 'Previsao', 'Gerados'), { recursive: true });
    writeFileSync(join(legacyRoot, 'Previsao', 'Gerados', 'doc.pdf'), '%PDF-1.7');
    persistFirstRunCompletion(db, legacyRoot);

    const result = migrateLegacyReportRootAndPaths(db, vi.fn());

    const expectedNewRoot = join(root, 'Formatador Comissão');
    expect(result.didMigrateRootFolder).toBe(true);
    expect(result.reportRoot).toBe(expectedNewRoot);
    expect(existsSync(legacyRoot)).toBe(false);
    expect(existsSync(join(expectedNewRoot, 'Previsão', 'Gerados', 'doc.pdf'))).toBe(true);
    expect(getReportRoot(db)).toBe(expectedNewRoot);
  });

  it('reescreve source_archived_path e pdf_path persistidos para apontar para os novos caminhos', () => {
    const customRoot = join(root, 'Minha Pasta');
    const oldProcessadosDir = join(customRoot, 'Previsao', 'Processados', '2026', '03', 'batch-1');
    const oldGeradosDir = join(customRoot, 'Previsao', 'Gerados');
    mkdirSync(oldProcessadosDir, { recursive: true });
    mkdirSync(oldGeradosDir, { recursive: true });
    writeFileSync(join(oldProcessadosDir, 'fonte.xlsx'), 'fonte');
    writeFileSync(join(oldGeradosDir, 'doc.pdf'), '%PDF-1.7');
    persistFirstRunCompletion(db, customRoot);

    insertBatch(db, {
      id: 'batch-1',
      mode: 'Previsao',
      sourceOriginalName: 'fonte.xlsx',
      sourceHash: 'hash',
      importedAt: '2026-03-01T00:00:00.000Z',
      sourceRowCount: 1,
      outputCount: 1,
      status: 'completed',
      appVersion: '1.1.0'
    });
    db.prepare('UPDATE batches SET source_archived_path = ? WHERE id = ?').run(
      join(oldProcessadosDir, 'fonte.xlsx'),
      'batch-1'
    );
    insertDocument(db, {
      id: 'doc-1',
      batchId: 'batch-1',
      mode: 'Previsao',
      groupingMode: 'separate_by_branch',
      sellerCode: '000009',
      sellerName: 'VENDEDOR TESTE',
      sourceRowCount: 1,
      commissionTotal: 'R$ 100,00',
      pdfPath: join(oldGeradosDir, 'doc.pdf'),
      generatedAt: '2026-03-01T00:00:00.000Z',
      templateVersion: '1',
      branches: [{ branchCode: '0103', branchName: 'PERMETAL SAO PAULO', rowCount: 1, subtotal: 'R$ 100,00' }]
    });

    migrateLegacyReportRootAndPaths(db, vi.fn());

    expect(getBatchById(db, 'batch-1')?.sourceArchivedPath).toBe(
      join(customRoot, 'Previsão', 'Processados', '2026', '03', 'batch-1', 'fonte.xlsx')
    );
    const migratedDoc = getDocumentById(db, 'doc-1');
    expect(migratedDoc?.pdfPath).toBe(join(customRoot, 'Previsão', 'Gerados', 'doc.pdf'));
    expect(migratedDoc?.pdfAvailable).toBe(true); // o arquivo fisico foi realmente movido para esse caminho
  });

  it('e idempotente: rodar duas vezes seguidas nao falha e mantem o estado correto', () => {
    const legacyRoot = join(root, 'Formatador Comissao');
    mkdirSync(join(legacyRoot, 'Relacao', 'Historico'), { recursive: true });
    persistFirstRunCompletion(db, legacyRoot);
    insertBatch(db, {
      id: 'batch-2',
      mode: 'Relacao',
      sourceOriginalName: 'fonte.xlsx',
      sourceHash: 'hash2',
      importedAt: '2026-03-01T00:00:00.000Z',
      sourceRowCount: 1,
      outputCount: 1,
      status: 'completed',
      appVersion: '1.1.0'
    });

    const first = migrateLegacyReportRootAndPaths(db, vi.fn());
    const second = migrateLegacyReportRootAndPaths(db, vi.fn());

    expect(second.didMigrateRootFolder).toBe(false); // ja migrado - nada a fazer
    expect(second.didMigrateModeFolders).toBe(false);
    expect(second.reportRoot).toBe(first.reportRoot);
  });

  it('nunca sobrescreve um arquivo Gerados colidente ao mesclar - preserva ambos e avisa', () => {
    const customRoot = join(root, 'Raiz');
    mkdirSync(join(customRoot, 'Previsao', 'Gerados'), { recursive: true });
    mkdirSync(join(customRoot, 'Previsão', 'Gerados'), { recursive: true });
    writeFileSync(join(customRoot, 'Previsao', 'Gerados', 'mesmo-nome.pdf'), 'versao legada');
    writeFileSync(join(customRoot, 'Previsão', 'Gerados', 'mesmo-nome.pdf'), 'versao atual');
    persistFirstRunCompletion(db, customRoot);

    const onWarning = vi.fn();
    migrateLegacyReportRootAndPaths(db, onWarning);

    expect(onWarning).toHaveBeenCalled();
    expect(readFileSync(join(customRoot, 'Previsão', 'Gerados', 'mesmo-nome.pdf'), 'utf8')).toBe('versao atual');
    expect(existsSync(join(customRoot, 'Previsao', 'Gerados', 'mesmo-nome.pdf'))).toBe(true); // legado preservado
  });
});
