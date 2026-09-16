import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyProfile } from '@shared/types/companyProfile';
import { openDatabase } from '../storage/database';
import { getBatchById } from '../storage/batchRepository';
import { listDocumentsByBatch } from '../storage/documentRepository';
import { createFixtureDir, removeFixtureDir, writeFixtureWorkbook } from '../reports/testSupport/xlsxFixtures';
import { resolveGeradosDir } from '../pdf/outputPath';
import { resolveEntradaDir } from '../app/folderNames';
import { resolveProcessamentoDir } from './archivePaths';
import { runBatchGeneration, type RunBatchGenerationDeps } from './batchLifecycle';

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

function lookupOnly0103(code: string): CompanyProfile | null {
  return code === '0103' ? COMPANY_0103 : null;
}

let reportRoot: string;
let sourceDir: string;
let db: DatabaseSync;

beforeEach(() => {
  reportRoot = createFixtureDir('fc-lifecycle-root-');
  sourceDir = createFixtureDir('fc-lifecycle-source-');
  db = openDatabase(join(reportRoot, 'app.db'));
});

afterEach(() => {
  db.close();
  removeFixtureDir(reportRoot);
  removeFixtureDir(sourceDir);
});

function makeDeps(renderPdf: RunBatchGenerationDeps['renderPdf']): RunBatchGenerationDeps {
  return { db, reportRoot, lookupCompanyProfile: lookupOnly0103, appVersion: '0.1.0-test', renderPdf };
}

/** Places a workspace copy exactly where importFile() would have left it, without re-running Fase 3 import. */
function seedWorkspaceCopy(mode: 'Previsao', batchId: string, filePath: string): string {
  const workspaceDir = resolveProcessamentoDir(reportRoot, mode, batchId);
  mkdirSync(workspaceDir, { recursive: true });
  const workspacePath = join(workspaceDir, 'previsao.xlsx');
  writeFileSync(workspacePath, readFileSync(filePath));
  return workspacePath;
}

describe('runBatchGeneration - caminho feliz', () => {
  it('gera PDF, arquiva a fonte em Processados e persiste batch+documento como completed', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'previsao.xlsx', PREVISAO_HEADERS, [previsaoRow()]);
    const originalBytes = readFileSync(sourcePath);
    const workspaceFilePath = seedWorkspaceCopy('Previsao', 'batch-1', sourcePath);

    const result = await runBatchGeneration(
      { mode: 'Previsao', batchId: 'batch-1', sourcePath, sourceKind: 'external', workspaceFilePath },
      makeDeps(renderPdf)
    );

    expect(result.missingBranchCodes).toHaveLength(0);
    expect(result.generated).toHaveLength(1);
    expect(existsSync(result.generated[0].filePath)).toBe(true);

    const batch = getBatchById(db, 'batch-1');
    expect(batch?.status).toBe('completed');
    expect(batch?.sourceArchivedPath).not.toBeNull();
    expect(batch?.sourceArchivedPath && existsSync(batch.sourceArchivedPath)).toBe(true);
    expect(batch?.outputCount).toBe(1);

    const documents = listDocumentsByBatch(db, 'batch-1');
    expect(documents).toHaveLength(1);
    expect(documents[0].branchName).toBe('PERMETAL SAO PAULO');
    expect(documents[0].pdfPath).toBe(result.generated[0].filePath);

    // external original untouched
    expect(existsSync(sourcePath)).toBe(true);
    expect(readFileSync(sourcePath)).toEqual(originalBytes);

    // Processamento workspace cleaned up after success
    expect(existsSync(resolveProcessamentoDir(reportRoot, 'Previsao', 'batch-1'))).toBe(false);
  });

  it('remove o original da Entrada somente apos o arquivamento ter sucesso, e nunca toca fontes externas', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const entradaDir = resolveEntradaDir(reportRoot, 'Previsao');
    mkdirSync(entradaDir, { recursive: true });
    const sourcePath = await writeFixtureWorkbook(entradaDir, 'previsao.xlsx', PREVISAO_HEADERS, [previsaoRow()]);
    const workspaceFilePath = seedWorkspaceCopy('Previsao', 'batch-entrada', sourcePath);

    await runBatchGeneration(
      { mode: 'Previsao', batchId: 'batch-entrada', sourcePath, sourceKind: 'entrada', workspaceFilePath },
      makeDeps(renderPdf)
    );

    expect(existsSync(sourcePath)).toBe(false);
  });

  it('segunda geracao move os PDFs da geracao anterior de Gerados para Historico, sem sobrescrever', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);

    const sourcePath1 = await writeFixtureWorkbook(sourceDir, 'previsao1.xlsx', PREVISAO_HEADERS, [previsaoRow()]);
    const workspace1 = seedWorkspaceCopy('Previsao', 'batch-a', sourcePath1);
    const first = await runBatchGeneration(
      { mode: 'Previsao', batchId: 'batch-a', sourcePath: sourcePath1, sourceKind: 'external', workspaceFilePath: workspace1 },
      makeDeps(renderPdf)
    );
    const firstPdfPath = first.generated[0].filePath;
    expect(existsSync(firstPdfPath)).toBe(true);

    const sourcePath2 = await writeFixtureWorkbook(
      sourceDir,
      'previsao2.xlsx',
      PREVISAO_HEADERS,
      [previsaoRow({ 'Dados do vendedor': '000010 - OUTRO VENDEDOR' })]
    );
    const workspace2 = seedWorkspaceCopy('Previsao', 'batch-b', sourcePath2);
    const second = await runBatchGeneration(
      { mode: 'Previsao', batchId: 'batch-b', sourcePath: sourcePath2, sourceKind: 'external', workspaceFilePath: workspace2 },
      makeDeps(renderPdf)
    );

    // previous batch's PDF no longer sits in Gerados - it moved to Historico
    expect(existsSync(firstPdfPath)).toBe(false);
    const geradosDir = resolveGeradosDir(reportRoot, 'Previsao');
    const geradosFiles = readdirSync(geradosDir);
    expect(geradosFiles).toHaveLength(1);
    expect(geradosFiles[0]).toBe(basename(second.generated[0].filePath));

    const firstDocs = listDocumentsByBatch(db, 'batch-a');
    expect(firstDocs).toHaveLength(1);
    expect(firstDocs[0].pdfPath).toContain(join('Previsão', 'Histórico'));
    expect(existsSync(firstDocs[0].pdfPath)).toBe(true);

    // both batches remain recorded - nothing was deleted, only relocated
    expect(getBatchById(db, 'batch-a')?.status).toBe('completed');
    expect(getBatchById(db, 'batch-b')?.status).toBe('completed');
  });
});

describe('runBatchGeneration - filial nao configurada', () => {
  it('nao publica nada, nao evacua Gerados e nao persiste batch quando ha filial bloqueada', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'previsao.xlsx', PREVISAO_HEADERS, [
      previsaoRow({ 'Nome da filial': '0199 - FILIAL SEM CADASTRO' })
    ]);
    const workspaceFilePath = seedWorkspaceCopy('Previsao', 'batch-blocked', sourcePath);

    const result = await runBatchGeneration(
      { mode: 'Previsao', batchId: 'batch-blocked', sourcePath, sourceKind: 'external', workspaceFilePath },
      makeDeps(renderPdf)
    );

    expect(result.missingBranchCodes).toEqual(['0199']);
    expect(result.generated).toHaveLength(0);
    expect(renderPdf).not.toHaveBeenCalled();
    expect(getBatchById(db, 'batch-blocked')).toBeNull();
    expect(existsSync(sourcePath)).toBe(true);
  });

  it('nao mexe no PDF/registro de um lote ja publicado quando uma importacao bloqueada roda depois', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);

    // Um lote valido e publicado primeiro, ocupando Gerados.
    const publishedSourcePath = await writeFixtureWorkbook(sourceDir, 'previsao-publicado.xlsx', PREVISAO_HEADERS, [
      previsaoRow()
    ]);
    const publishedWorkspace = seedWorkspaceCopy('Previsao', 'batch-published', publishedSourcePath);
    const published = await runBatchGeneration(
      { mode: 'Previsao', batchId: 'batch-published', sourcePath: publishedSourcePath, sourceKind: 'external', workspaceFilePath: publishedWorkspace },
      makeDeps(renderPdf)
    );
    const publishedPdfPath = published.generated[0].filePath;
    expect(existsSync(publishedPdfPath)).toBe(true);

    // Uma segunda importacao do MESMO modo, com filial nao configurada, deve ser bloqueada
    // sem tocar no que ja esta publicado.
    const blockedSourcePath = await writeFixtureWorkbook(sourceDir, 'previsao-bloqueado.xlsx', PREVISAO_HEADERS, [
      previsaoRow({ 'Nome da filial': '0199 - FILIAL SEM CADASTRO' })
    ]);
    const blockedWorkspace = seedWorkspaceCopy('Previsao', 'batch-blocked-2', blockedSourcePath);
    const blockedRenderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await runBatchGeneration(
      { mode: 'Previsao', batchId: 'batch-blocked-2', sourcePath: blockedSourcePath, sourceKind: 'external', workspaceFilePath: blockedWorkspace },
      makeDeps(blockedRenderPdf)
    );

    expect(result.missingBranchCodes).toEqual(['0199']);
    expect(blockedRenderPdf).not.toHaveBeenCalled();
    expect(getBatchById(db, 'batch-blocked-2')).toBeNull();

    // O lote publicado antes continua exatamente como estava: mesmo PDF em Gerados,
    // mesmo registro no banco - a tentativa bloqueada nao evacuou nada para Historico.
    expect(existsSync(publishedPdfPath)).toBe(true);
    const publishedDocs = listDocumentsByBatch(db, 'batch-published');
    expect(publishedDocs).toHaveLength(1);
    expect(publishedDocs[0].pdfPath).toBe(publishedPdfPath);
    expect(getBatchById(db, 'batch-published')?.status).toBe('completed');
  });
});

describe('runBatchGeneration - falha durante a geracao', () => {
  it('marca o batch como failed e preserva a copia de trabalho quando o renderizador falha', async () => {
    const renderPdf = vi.fn().mockRejectedValue(new Error('falha simulada no renderizador'));
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'previsao.xlsx', PREVISAO_HEADERS, [previsaoRow()]);
    const workspaceFilePath = seedWorkspaceCopy('Previsao', 'batch-fail', sourcePath);

    await expect(
      runBatchGeneration(
        { mode: 'Previsao', batchId: 'batch-fail', sourcePath, sourceKind: 'external', workspaceFilePath },
        makeDeps(renderPdf)
      )
    ).rejects.toThrow('falha simulada no renderizador');

    expect(getBatchById(db, 'batch-fail')?.status).toBe('failed');
    // source workspace copy is never lost on failure - nothing was archived/removed
    expect(existsSync(workspaceFilePath)).toBe(true);
    expect(existsSync(sourcePath)).toBe(true);
  });

  it('preserva o original da Entrada quando a geracao falha - so e removido apos sucesso', async () => {
    const renderPdf = vi.fn().mockRejectedValue(new Error('falha simulada no renderizador'));
    const entradaDir = resolveEntradaDir(reportRoot, 'Previsao');
    mkdirSync(entradaDir, { recursive: true });
    const sourcePath = await writeFixtureWorkbook(entradaDir, 'previsao.xlsx', PREVISAO_HEADERS, [previsaoRow()]);
    const workspaceFilePath = seedWorkspaceCopy('Previsao', 'batch-fail-entrada', sourcePath);

    await expect(
      runBatchGeneration(
        { mode: 'Previsao', batchId: 'batch-fail-entrada', sourcePath, sourceKind: 'entrada', workspaceFilePath },
        makeDeps(renderPdf)
      )
    ).rejects.toThrow('falha simulada no renderizador');

    expect(getBatchById(db, 'batch-fail-entrada')?.status).toBe('failed');
    // the Entrada original must survive: removeEntradaOriginalIfApplicable only runs after
    // publishGeneratedDocuments AND archiveSourceFile have both already succeeded
    expect(existsSync(sourcePath)).toBe(true);
  });

  it('nao deixa PDFs orfaos em Gerados quando um documento falha na verificacao em um lote com varios', async () => {
    const validPdf = Buffer.from('%PDF-1.7 valido');
    const emptyPdf = Buffer.alloc(0);
    // Primeiro documento (vendedor 000009) sai valido; o segundo (vendedor 000010) sai vazio -
    // reproduz uma falha de renderizacao no meio de um lote com mais de um PDF.
    const renderPdf = vi.fn().mockResolvedValueOnce(validPdf).mockResolvedValueOnce(emptyPdf);

    const sourcePath = await writeFixtureWorkbook(sourceDir, 'previsao-varios.xlsx', PREVISAO_HEADERS, [
      previsaoRow({ 'Dados do vendedor': '000009 - VENDEDOR UM' }),
      previsaoRow({ 'Dados do vendedor': '000010 - VENDEDOR DOIS' })
    ]);
    const workspaceFilePath = seedWorkspaceCopy('Previsao', 'batch-orfao', sourcePath);

    await expect(
      runBatchGeneration(
        { mode: 'Previsao', batchId: 'batch-orfao', sourcePath, sourceKind: 'external', workspaceFilePath },
        makeDeps(renderPdf)
      )
    ).rejects.toThrow(/PDF invalido ou vazio/);

    expect(getBatchById(db, 'batch-orfao')?.status).toBe('failed');
    expect(listDocumentsByBatch(db, 'batch-orfao')).toHaveLength(0);

    // Nenhum PDF desse lote (nem o valido, nem o vazio) sobra em Gerados sem registro no banco.
    const geradosDir = resolveGeradosDir(reportRoot, 'Previsao');
    const leftoverFiles = existsSync(geradosDir) ? readdirSync(geradosDir) : [];
    expect(leftoverFiles).toHaveLength(0);
  });
});
