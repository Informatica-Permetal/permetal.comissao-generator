import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyProfile } from '@shared/types/companyProfile';
import { openTestDatabase } from '../storage/testDatabase';
import { getBatchById } from '../storage/batchRepository';
import { getDocumentById, listDocumentsByBatch } from '../storage/documentRepository';
import { createFixtureDir, removeFixtureDir, writeFixtureWorkbook } from '../reports/testSupport/xlsxFixtures';
import { runBatchGeneration, type RunBatchGenerationDeps } from './batchLifecycle';
import { deleteBatch, deleteDocument, type DeleteDeps } from './deleteService';

const FAKE_PDF_BUFFER = Buffer.from('%PDF-1.7 fake');

const PREVISAO_HEADERS = [
  'Dados do cliente',
  'Dados do titulo',
  'Dados do pedido',
  'Emissao pedido/titulo',
  'Vencimento',
  'Valor base para baixa',
  'Valor total de comissao',
  'DT Baixa',
  'Valor IRRF',
  'Comissao total (liquido)',
  'Dados do vendedor',
  'Classificacao',
  'Nome da filial'
];

function previsaoRow(overrides: Record<string, unknown> = {}): unknown[] {
  const base: Record<string, unknown> = {
    'Dados do cliente': '999999/01 - CLIENTE SINTETICO LTDA',
    'Dados do titulo': '001-000099999--NF',
    'Dados do pedido': null,
    'Emissao pedido/titulo': '01/03/2026',
    Vencimento: '01/04/2026',
    'Valor base para baixa': '1.000,00',
    'Valor total de comissao': '150,00',
    'DT Baixa': '02/04/2026',
    'Valor IRRF': '10,00',
    'Comissao total (liquido)': '140,00',
    'Dados do vendedor': '000009 - VENDEDOR SINTETICO',
    Classificacao: 'Titulo original',
    'Nome da filial': '0103 - PERMETAL SAO PAULO'
  };
  return PREVISAO_HEADERS.map((h) => (h in overrides ? overrides[h] : base[h]));
}

const COMPANY_0103: CompanyProfile = {
  branchCode: '0103',
  displayName: 'PERMETAL SAO PAULO',
  legalName: null,
  tradeName: null,
  cnpj: null,
  address: null,
  logoPath: null,
  groupKey: null,
  active: true,
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const COMPANY_0104: CompanyProfile = { ...COMPANY_0103, branchCode: '0104', displayName: 'PERMETAL CRAVINHOS' };

function lookupOnly0103(code: string): CompanyProfile | null {
  return code === '0103' ? COMPANY_0103 : null;
}

function lookup0103and0104(code: string): CompanyProfile | null {
  if (code === '0103') return COMPANY_0103;
  if (code === '0104') return COMPANY_0104;
  return null;
}

let reportRoot: string;
let sourceDir: string;
let db: DatabaseSync;

beforeEach(() => {
  reportRoot = createFixtureDir('fc-delete-root-');
  sourceDir = createFixtureDir('fc-delete-source-');
  db = openTestDatabase(join(reportRoot, 'app.db'));
});

afterEach(() => {
  db.close();
  removeFixtureDir(reportRoot);
  removeFixtureDir(sourceDir);
});

function generationDeps(renderPdf: RunBatchGenerationDeps['renderPdf']): RunBatchGenerationDeps {
  return { db, reportRoot, lookupCompanyProfile: lookupOnly0103, appVersion: '0.1.0-test', renderPdf };
}

async function seedCompletedBatch(batchId: string, sellerCode = '000009'): Promise<string> {
  const sourcePath = await writeFixtureWorkbook(sourceDir, `${batchId}.xlsx`, PREVISAO_HEADERS, [
    previsaoRow({ 'Dados do vendedor': `${sellerCode} - VENDEDOR SINTETICO` })
  ]);
  const workspaceDir = join(reportRoot, 'Previsão', 'Processamento', batchId);
  mkdirSync(workspaceDir, { recursive: true });
  const workspaceFilePath = join(workspaceDir, 'previsao.xlsx');
  writeFileSync(workspaceFilePath, readFileSync(sourcePath));

  await runBatchGeneration(
    { mode: 'Previsao', batchId, sourcePath, sourceKind: 'external', workspaceFilePath },
    generationDeps(vi.fn().mockResolvedValue(FAKE_PDF_BUFFER))
  );
  return sourcePath;
}

async function seedCompletedBatchWithTwoDocuments(batchId: string): Promise<void> {
  const sourcePath = await writeFixtureWorkbook(sourceDir, `${batchId}.xlsx`, PREVISAO_HEADERS, [
    previsaoRow({ 'Dados do vendedor': '000009 - VENDEDOR UM' }),
    previsaoRow({ 'Dados do vendedor': '000010 - VENDEDOR DOIS' })
  ]);
  const workspaceDir = join(reportRoot, 'Previsão', 'Processamento', batchId);
  mkdirSync(workspaceDir, { recursive: true });
  const workspaceFilePath = join(workspaceDir, 'previsao.xlsx');
  writeFileSync(workspaceFilePath, readFileSync(sourcePath));

  await runBatchGeneration(
    { mode: 'Previsao', batchId, sourcePath, sourceKind: 'external', workspaceFilePath },
    generationDeps(vi.fn().mockResolvedValue(FAKE_PDF_BUFFER))
  );
}

async function seedCompletedConsolidatedBatch(batchId: string): Promise<void> {
  const sourcePath = await writeFixtureWorkbook(sourceDir, `${batchId}.xlsx`, PREVISAO_HEADERS, [
    previsaoRow({ 'Dados do vendedor': '000097 - RODRIGO LEAL MIGNELLA', 'Nome da filial': '0103 - PERMETAL SAO PAULO' }),
    previsaoRow({ 'Dados do vendedor': '000097 - RODRIGO LEAL MIGNELLA', 'Nome da filial': '0104 - PERMETAL CRAVINHOS' })
  ]);
  const workspaceDir = join(reportRoot, 'Previsão', 'Processamento', batchId);
  mkdirSync(workspaceDir, { recursive: true });
  const workspaceFilePath = join(workspaceDir, 'previsao.xlsx');
  writeFileSync(workspaceFilePath, readFileSync(sourcePath));

  await runBatchGeneration(
    {
      mode: 'Previsao',
      batchId,
      sourcePath,
      sourceKind: 'external',
      workspaceFilePath,
      groupingChoices: { '000097': 'consolidated_by_seller' }
    },
    { db, reportRoot, lookupCompanyProfile: lookup0103and0104, appVersion: '0.1.0-test', renderPdf: vi.fn().mockResolvedValue(FAKE_PDF_BUFFER) }
  );
}

/** A fake Recycle Bin: actually removes the file so tests can assert it's gone, without touching the real OS bin. */
function fakeTrash(trashed: string[]): DeleteDeps['trashItem'] {
  return async (path: string) => {
    trashed.push(path);
    rmSync(path, { force: true });
  };
}

describe('deleteDocument', () => {
  it('remove o PDF e o registro, mas preserva a fonte arquivada do lote', async () => {
    await seedCompletedBatch('batch-doc-1');
    const [document] = listDocumentsByBatch(db, 'batch-doc-1');
    const batch = getBatchById(db, 'batch-doc-1');
    expect(batch?.sourceArchivedPath).toBeTruthy();

    const trashed: string[] = [];
    const result = await deleteDocument(document.id, { db, trashItem: fakeTrash(trashed) });

    expect(result.ok).toBe(true);
    expect(trashed).toEqual([document.pdfPath]);
    expect(existsSync(document.pdfPath)).toBe(false);
    expect(getDocumentById(db, document.id)).toBeNull();

    // archived source untouched - other documents of the batch (in theory) may still need it
    expect(batch?.sourceArchivedPath && existsSync(batch.sourceArchivedPath)).toBe(true);
  });

  it('retorna erro estruturado para documento inexistente, sem lancar excecao', async () => {
    const result = await deleteDocument('nao-existe', { db, trashItem: fakeTrash([]) });
    expect(result).toEqual({ ok: false, error: 'Documento não encontrado.' });
  });

  it('em um lote com varios documentos, excluir um deles preserva o PDF e o registro do outro', async () => {
    await seedCompletedBatchWithTwoDocuments('batch-siblings');
    const [documentA, documentB] = listDocumentsByBatch(db, 'batch-siblings');
    expect(documentA.pdfPath).not.toBe(documentB.pdfPath);

    const trashed: string[] = [];
    const result = await deleteDocument(documentA.id, { db, trashItem: fakeTrash(trashed) });

    expect(result.ok).toBe(true);
    expect(trashed).toEqual([documentA.pdfPath]);
    expect(existsSync(documentA.pdfPath)).toBe(false);
    expect(getDocumentById(db, documentA.id)).toBeNull();

    // the sibling document (same batch, different seller/branch) is completely untouched
    expect(getDocumentById(db, documentB.id)).not.toBeNull();
    expect(existsSync(documentB.pdfPath)).toBe(true);

    const remaining = listDocumentsByBatch(db, 'batch-siblings');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(documentB.id);
  });

  it('exclui um documento consolidado (varias filiais) sem afetar a fonte XLSX compartilhada do lote', async () => {
    await seedCompletedConsolidatedBatch('batch-consolidated');
    const [document] = listDocumentsByBatch(db, 'batch-consolidated');
    expect(document.groupingMode).toBe('consolidated_by_seller');
    expect(document.branches).toHaveLength(2);
    const batch = getBatchById(db, 'batch-consolidated');

    const trashed: string[] = [];
    const result = await deleteDocument(document.id, { db, trashItem: fakeTrash(trashed) });

    expect(result.ok).toBe(true);
    expect(trashed).toEqual([document.pdfPath]);
    expect(existsSync(document.pdfPath)).toBe(false);
    expect(getDocumentById(db, document.id)).toBeNull();

    // A fonte arquivada e compartilhada pelo lote - excluir o documento consolidado nunca a toca.
    expect(batch?.sourceArchivedPath && existsSync(batch.sourceArchivedPath)).toBe(true);
  });
});

describe('deleteBatch', () => {
  it('remove todos os PDFs do lote, a fonte arquivada e os registros do banco', async () => {
    const sourcePath = await seedCompletedBatch('batch-full-1');
    const batch = getBatchById(db, 'batch-full-1');
    const documents = listDocumentsByBatch(db, 'batch-full-1');
    expect(documents.length).toBeGreaterThan(0);

    const trashed: string[] = [];
    const result = await deleteBatch('batch-full-1', { db, trashItem: fakeTrash(trashed) });

    expect(result.ok).toBe(true);
    for (const document of documents) {
      expect(existsSync(document.pdfPath)).toBe(false);
    }
    expect(batch?.sourceArchivedPath && existsSync(batch.sourceArchivedPath)).toBe(false);
    expect(getBatchById(db, 'batch-full-1')).toBeNull();
    expect(listDocumentsByBatch(db, 'batch-full-1')).toHaveLength(0);

    // the external original (outside Processados) was never touched by the batch delete
    expect(existsSync(sourcePath)).toBe(true);
  });

  it('retorna erro estruturado para lote inexistente, sem lancar excecao', async () => {
    const result = await deleteBatch('nao-existe', { db, trashItem: fakeTrash([]) });
    expect(result).toEqual({ ok: false, error: 'Lote não encontrado.' });
  });
});
