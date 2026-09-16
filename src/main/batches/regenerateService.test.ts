import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyProfile } from '@shared/types/companyProfile';
import { openDatabase } from '../storage/database';
import { getBatchById } from '../storage/batchRepository';
import { listDocumentsByBatch } from '../storage/documentRepository';
import { resolveGeradosDir } from '../pdf/outputPath';
import { createFixtureDir, removeFixtureDir, writeFixtureWorkbook } from '../reports/testSupport/xlsxFixtures';
import { runBatchGeneration, type RunBatchGenerationDeps } from './batchLifecycle';
import { deleteBatch, deleteDocument, type DeleteDeps } from './deleteService';
import { regenerateBatch, regenerateDocument, type RegenerateDeps } from './regenerateService';

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

let reportRoot: string;
let sourceDir: string;
let db: DatabaseSync;
let lookupCompanyProfile: (code: string) => CompanyProfile | null;

beforeEach(() => {
  reportRoot = createFixtureDir('fc-regen-root-');
  sourceDir = createFixtureDir('fc-regen-source-');
  db = openDatabase(join(reportRoot, 'app.db'));
  lookupCompanyProfile = (code) => (code === '0103' ? COMPANY_0103 : null);
});

afterEach(() => {
  db.close();
  removeFixtureDir(reportRoot);
  removeFixtureDir(sourceDir);
});

async function seedCompletedBatch(batchId: string): Promise<void> {
  const sourcePath = await writeFixtureWorkbook(sourceDir, `${batchId}.xlsx`, PREVISAO_HEADERS, [previsaoRow()]);
  const workspaceDir = join(reportRoot, 'Previsão', 'Processamento', batchId);
  mkdirSync(workspaceDir, { recursive: true });
  const workspaceFilePath = join(workspaceDir, 'previsao.xlsx');
  writeFileSync(workspaceFilePath, readFileSync(sourcePath));

  const genDeps: RunBatchGenerationDeps = {
    db,
    reportRoot,
    lookupCompanyProfile,
    appVersion: '0.1.0-test',
    renderPdf: vi.fn().mockResolvedValue(FAKE_PDF_BUFFER)
  };
  await runBatchGeneration(
    { mode: 'Previsao', batchId, sourcePath, sourceKind: 'external', workspaceFilePath },
    genDeps
  );
}

async function seedCompletedConsolidatedBatch(batchId: string): Promise<void> {
  lookupCompanyProfile = (code) => (code === '0103' ? COMPANY_0103 : code === '0104' ? COMPANY_0104 : null);
  const sourcePath = await writeFixtureWorkbook(sourceDir, `${batchId}.xlsx`, PREVISAO_HEADERS, [
    previsaoRow({ 'Dados do vendedor': '000097 - RODRIGO LEAL MIGNELLA', 'Nome da filial': '0103 - PERMETAL SAO PAULO' }),
    previsaoRow({ 'Dados do vendedor': '000097 - RODRIGO LEAL MIGNELLA', 'Nome da filial': '0104 - PERMETAL CRAVINHOS' })
  ]);
  const workspaceDir = join(reportRoot, 'Previsão', 'Processamento', batchId);
  mkdirSync(workspaceDir, { recursive: true });
  const workspaceFilePath = join(workspaceDir, 'previsao.xlsx');
  writeFileSync(workspaceFilePath, readFileSync(sourcePath));

  const genDeps: RunBatchGenerationDeps = {
    db,
    reportRoot,
    lookupCompanyProfile,
    appVersion: '0.1.0-test',
    renderPdf: vi.fn().mockResolvedValue(FAKE_PDF_BUFFER)
  };
  await runBatchGeneration(
    {
      mode: 'Previsao',
      batchId,
      sourcePath,
      sourceKind: 'external',
      workspaceFilePath,
      groupingChoices: { '000097': 'consolidated_by_seller' }
    },
    genDeps
  );
}

async function seedMixedModeBatch(batchId: string): Promise<void> {
  lookupCompanyProfile = (code) => (code === '0103' ? COMPANY_0103 : code === '0104' ? COMPANY_0104 : null);
  const sourcePath = await writeFixtureWorkbook(sourceDir, `${batchId}.xlsx`, PREVISAO_HEADERS, [
    previsaoRow({ 'Dados do vendedor': '000097 - RODRIGO LEAL MIGNELLA', 'Nome da filial': '0103 - PERMETAL SAO PAULO' }),
    previsaoRow({ 'Dados do vendedor': '000097 - RODRIGO LEAL MIGNELLA', 'Nome da filial': '0104 - PERMETAL CRAVINHOS' }),
    previsaoRow({ 'Dados do vendedor': '000001 - OUTRO VENDEDOR', 'Nome da filial': '0103 - PERMETAL SAO PAULO' })
  ]);
  const workspaceDir = join(reportRoot, 'Previsão', 'Processamento', batchId);
  mkdirSync(workspaceDir, { recursive: true });
  const workspaceFilePath = join(workspaceDir, 'previsao.xlsx');
  writeFileSync(workspaceFilePath, readFileSync(sourcePath));

  const genDeps: RunBatchGenerationDeps = {
    db,
    reportRoot,
    lookupCompanyProfile,
    appVersion: '0.1.0-test',
    renderPdf: vi.fn().mockResolvedValue(FAKE_PDF_BUFFER)
  };
  await runBatchGeneration(
    {
      mode: 'Previsao',
      batchId,
      sourcePath,
      sourceKind: 'external',
      workspaceFilePath,
      // seller 000001 has a single branch, so it is always separado regardless of this map.
      groupingChoices: { '000097': 'consolidated_by_seller' }
    },
    genDeps
  );
}

function regenDeps(renderPdf: RegenerateDeps['renderPdf']): RegenerateDeps {
  return { db, reportRoot, lookupCompanyProfile, renderPdf };
}

describe('regenerateBatch', () => {
  it('rerenderiza a partir da fonte arquivada e publica um novo PDF, preservando o antigo no Historico', async () => {
    await seedCompletedBatch('batch-regen-1');
    const before = listDocumentsByBatch(db, 'batch-regen-1');
    expect(before).toHaveLength(1);
    const oldPdfPath = before[0].pdfPath;

    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await regenerateBatch('batch-regen-1', regenDeps(renderPdf));

    expect(result).toEqual({ ok: true, generatedCount: 1 });
    expect(renderPdf).toHaveBeenCalledTimes(1);

    const after = listDocumentsByBatch(db, 'batch-regen-1');
    expect(after).toHaveLength(2); // old row (now pointing at Historico) + new row (current in Gerados)
    const newDoc = after.find((d) => d.pdfPath !== oldPdfPath);
    expect(newDoc).toBeDefined();
    expect(existsSync(newDoc!.pdfPath)).toBe(true);

    const oldDoc = after.find((d) => d.id === before[0].id)!;
    expect(existsSync(oldDoc.pdfPath)).toBe(true);
    expect(oldDoc.pdfPath).toContain(join('Previsão', 'Histórico'));

    expect(getBatchById(db, 'batch-regen-1')?.status).toBe('completed');
  });

  it('avisa sem falhar quando a fonte arquivada nao existe mais', async () => {
    await seedCompletedBatch('batch-regen-missing');
    const batch = getBatchById(db, 'batch-regen-missing')!;
    rmSync(batch.sourceArchivedPath!, { force: true });

    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await regenerateBatch('batch-regen-missing', regenDeps(renderPdf));

    expect(result.ok).toBe(false);
    expect(renderPdf).not.toHaveBeenCalled();
    // batch stays completed - a failed regeneration attempt never corrupts existing history
    expect(getBatchById(db, 'batch-regen-missing')?.status).toBe('completed');
  });

  it('retorna erro estruturado para lote inexistente', async () => {
    const result = await regenerateBatch('nao-existe', regenDeps(vi.fn()));
    expect(result).toEqual({ ok: false, error: 'Lote não encontrado.' });
  });
});

describe('regenerateBatch - concorrencia', () => {
  it('duas regeneracoes concorrentes do MESMO lote sao serializadas, sem duplicar/corromper Gerados', async () => {
    await seedCompletedBatch('batch-concurrent-regen');

    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const deps = regenDeps(renderPdf);

    const [first, second] = await Promise.all([
      regenerateBatch('batch-concurrent-regen', deps),
      regenerateBatch('batch-concurrent-regen', deps)
    ]);

    expect(first).toEqual({ ok: true, generatedCount: 1 });
    expect(second).toEqual({ ok: true, generatedCount: 1 });

    // original + 2 regeneracoes = 3 registros no total, nenhum perdido, nenhum duplicado a mais
    const allDocs = listDocumentsByBatch(db, 'batch-concurrent-regen');
    expect(allDocs).toHaveLength(3);

    // Gerados so tem exatamente 1 PDF publicado como "atual" - as duas serializacoes nao
    // escreveram por cima uma da outra nem deixaram um segundo arquivo concorrente para tras
    const geradosDir = resolveGeradosDir(reportRoot, 'Previsao');
    const geradosDocs = allDocs.filter((d) => d.pdfPath.startsWith(geradosDir));
    expect(geradosDocs).toHaveLength(1);
    expect(existsSync(geradosDocs[0].pdfPath)).toBe(true);

    // todos os arquivos evacuados para o Historico continuam intactos (nenhum foi sobrescrito)
    for (const doc of allDocs) {
      expect(existsSync(doc.pdfPath)).toBe(true);
    }
  });

  it('regenerar e excluir o MESMO lote ao mesmo tempo nunca deixa um PDF orfao sem registro no banco', async () => {
    await seedCompletedBatch('batch-regen-vs-delete');

    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const trashed: string[] = [];
    const deleteDeps: DeleteDeps = {
      db,
      trashItem: async (path) => {
        trashed.push(path);
        rmSync(path, { force: true });
      }
    };

    const [regenResult, deleteResult] = await Promise.all([
      regenerateBatch('batch-regen-vs-delete', regenDeps(renderPdf)),
      deleteBatch('batch-regen-vs-delete', deleteDeps)
    ]);

    // whichever call the per-mode lock let run first, the other must complete cleanly
    // afterwards too - never a thrown FK-constraint error, never a partial state.
    expect(regenResult.ok).toBe(true);
    expect(deleteResult.ok).toBe(true);

    // the lock fully serializes both operations, so the end state is deterministic and clean:
    // the batch (and everything regenerate had just published for it) is entirely gone.
    expect(getBatchById(db, 'batch-regen-vs-delete')).toBeNull();
    expect(listDocumentsByBatch(db, 'batch-regen-vs-delete')).toHaveLength(0);

    // nothing regenerate wrote to Gerados was left behind untracked by the database
    const geradosDir = resolveGeradosDir(reportRoot, 'Previsao');
    const leftoverInGerados = existsSync(geradosDir) ? readdirSync(geradosDir) : [];
    expect(leftoverInGerados).toHaveLength(0);
  });
});

describe('regenerateBatch - preserva o modo de agrupamento original (Fase 5)', () => {
  it('regenerar um lote consolidado nunca pede escolha de novo e mantem consolidado', async () => {
    await seedCompletedConsolidatedBatch('batch-regen-consolidated');
    const before = listDocumentsByBatch(db, 'batch-regen-consolidated');
    expect(before[0].groupingMode).toBe('consolidated_by_seller');

    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await regenerateBatch('batch-regen-consolidated', regenDeps(renderPdf));

    expect(result).toEqual({ ok: true, generatedCount: 1 });
    const after = listDocumentsByBatch(db, 'batch-regen-consolidated');
    const newDoc = after.find((d) => !before.some((b) => b.id === d.id))!;
    expect(newDoc.groupingMode).toBe('consolidated_by_seller');
    expect(newDoc.branches).toHaveLength(2);
    expect(newDoc.branches.map((b) => b.branchCode)).toEqual(['0103', '0104']);
  });

  it('regenerar um lote com escolha mista preserva o modo de CADA vendedor de forma independente', async () => {
    await seedMixedModeBatch('batch-regen-mixed');
    const before = listDocumentsByBatch(db, 'batch-regen-mixed');
    const consolidatedBefore = before.find((d) => d.sellerCode === '000097')!;
    const separateBefore = before.find((d) => d.sellerCode === '000001')!;
    expect(consolidatedBefore.groupingMode).toBe('consolidated_by_seller');
    expect(separateBefore.groupingMode).toBe('separate_by_branch');

    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await regenerateBatch('batch-regen-mixed', regenDeps(renderPdf));

    expect(result).toEqual({ ok: true, generatedCount: 2 });
    const after = listDocumentsByBatch(db, 'batch-regen-mixed');
    const newConsolidated = after.find((d) => d.sellerCode === '000097' && !before.some((b) => b.id === d.id))!;
    const newSeparate = after.find((d) => d.sellerCode === '000001' && !before.some((b) => b.id === d.id))!;
    expect(newConsolidated.groupingMode).toBe('consolidated_by_seller');
    expect(newConsolidated.branches).toHaveLength(2);
    expect(newSeparate.groupingMode).toBe('separate_by_branch');
    expect(newSeparate.branches).toHaveLength(1);
  });

  it('excluir o UNICO documento de um vendedor consolidado e depois regenerar preserva o modo consolidado (nao volta a separado)', async () => {
    await seedCompletedConsolidatedBatch('batch-delete-then-regen');
    const [onlyDocument] = listDocumentsByBatch(db, 'batch-delete-then-regen');
    expect(onlyDocument.groupingMode).toBe('consolidated_by_seller');

    const trashed: string[] = [];
    const deleteDeps: DeleteDeps = { db, trashItem: async (path) => { trashed.push(path); rmSync(path, { force: true }); } };
    const deleteResult = await deleteDocument(onlyDocument.id, deleteDeps);
    expect(deleteResult.ok).toBe(true);
    // The seller now has ZERO documents in the batch - the only place its original choice
    // could possibly still be known is the batch-level record, not any `documents` row.
    expect(listDocumentsByBatch(db, 'batch-delete-then-regen')).toHaveLength(0);

    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await regenerateBatch('batch-delete-then-regen', regenDeps(renderPdf));

    expect(result).toEqual({ ok: true, generatedCount: 1 });
    const regenerated = listDocumentsByBatch(db, 'batch-delete-then-regen');
    expect(regenerated).toHaveLength(1);
    expect(regenerated[0].groupingMode).toBe('consolidated_by_seller');
    expect(regenerated[0].branches).toHaveLength(2);
  });
});

describe('regenerateDocument', () => {
  it('resolve o lote do documento e regenera todo o lote', async () => {
    await seedCompletedBatch('batch-regen-doc');
    const [document] = listDocumentsByBatch(db, 'batch-regen-doc');

    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await regenerateDocument(document.id, regenDeps(renderPdf));

    expect(result).toEqual({ ok: true, generatedCount: 1 });
  });

  it('retorna erro estruturado para documento inexistente', async () => {
    const result = await regenerateDocument('nao-existe', regenDeps(vi.fn()));
    expect(result).toEqual({ ok: false, error: 'Documento não encontrado.' });
  });
});
