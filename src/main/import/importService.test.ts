import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { CompanyProfile } from '@shared/types/companyProfile';
import { openDatabase } from '../storage/database';
import { insertBatch } from '../storage/batchRepository';
import { createFixtureDir, removeFixtureDir, writeFixtureWorkbook } from '../reports/testSupport/xlsxFixtures';
import { importFile } from './importService';

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

const RELACAO_HEADERS = [
  'Tipo de Registro',
  'Nome do Vendedor',
  'Filial do Sistema',
  'Codigo do Vendedor',
  'Prefixo',
  'Numero do Titulo Original',
  'Parcela',
  'Nome do cliente',
  'Data de Baixa do Titulo',
  'Data do Pgto da Comissao',
  'Numero do Pedido',
  'Valor Base da Comissao',
  '% Comissao sobre Vl.Base',
  'Valor da Comissao',
  'Comissao gerada pela B/E'
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

function relacaoRow(overrides: Record<string, unknown> = {}): unknown[] {
  const base: Record<string, unknown> = {
    'Tipo de Registro': 'Comissao',
    'Nome do Vendedor': 'VENDEDOR SINTETICO',
    'Filial do Sistema': '0103',
    'Codigo do Vendedor': '000009',
    Prefixo: '001',
    'Numero do Titulo Original': '000099999',
    Parcela: '01',
    'Nome do cliente': 'CLIENTE SINTETICO LTDA',
    'Data de Baixa do Titulo': '01/03/2026',
    'Data do Pgto da Comissao': null,
    'Numero do Pedido': '029999',
    'Valor Base da Comissao': '1.000,00',
    '% Comissao sobre Vl.Base': '0,15',
    'Valor da Comissao': '150,00',
    'Comissao gerada pela B/E': 'Baixa'
  };
  return RELACAO_HEADERS.map((h) => (h in overrides ? overrides[h] : base[h]));
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

let sourceDir: string;
let reportRoot: string;
let db: DatabaseSync;

beforeEach(() => {
  sourceDir = createFixtureDir('fc-import-source-');
  reportRoot = createFixtureDir('fc-import-root-');
  db = openDatabase(join(reportRoot, 'app.db'));
});

afterEach(() => {
  db.close();
  removeFixtureDir(sourceDir);
  removeFixtureDir(reportRoot);
});

function lookupOnly0103(code: string): CompanyProfile | null {
  return code === '0103' ? COMPANY_0103 : null;
}

describe('importFile - caminho feliz', () => {
  it('Previsao: copia para Processamento, nunca toca o arquivo externo, monta a previa', async () => {
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'previsao.xlsx', PREVISAO_HEADERS, [previsaoRow()]);
    const originalBytes = readFileSync(sourcePath);

    const result = await importFile(
      { mode: 'Previsao', sourcePath, sourceKind: 'external' },
      { db, reportRoot, lookupCompanyProfile: lookupOnly0103 }
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.totalRows).toBe(1);
    expect(result.preview.sellerCount).toBe(1);
    expect(result.preview.branchCount).toBe(1);
    expect(result.preview.documents).toEqual([
      { branchCode: '0103', sellerCode: '000009', sellerName: 'VENDEDOR SINTETICO', rowCount: 1, total: 'R$ 140,00' }
    ]);
    expect(result.preview.missingBranchCodes).toEqual([]);
    expect(result.preview.previouslyProcessedAt).toBeNull();

    // workspace copy exists under Processamento, distinct from the external original
    expect(result.preview.workspaceFilePath).toContain(join('Previsão', 'Processamento'));
    expect(existsSync(result.preview.workspaceFilePath)).toBe(true);
    expect(result.preview.workspaceFilePath).not.toBe(sourcePath);

    // external original is byte-for-byte untouched
    expect(readFileSync(sourcePath)).toEqual(originalBytes);
  });

  it('Relacao: mesma previa correta', async () => {
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'relacao.xlsx', RELACAO_HEADERS, [relacaoRow()]);
    const result = await importFile(
      { mode: 'Relacao', sourcePath, sourceKind: 'external' },
      { db, reportRoot, lookupCompanyProfile: lookupOnly0103 }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.documents).toEqual([
      { branchCode: '0103', sellerCode: '000009', sellerName: 'VENDEDOR SINTETICO', rowCount: 1, total: 'R$ 150,00' }
    ]);
  });
});

describe('importFile - modo errado', () => {
  it('arquivo de Relacao importado no modo Previsao retorna erro estruturado wrongMode', async () => {
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'relacao.xlsx', RELACAO_HEADERS, [relacaoRow()]);
    const result = await importFile(
      { mode: 'Previsao', sourcePath, sourceKind: 'external' },
      { db, reportRoot, lookupCompanyProfile: lookupOnly0103 }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: 'wrongMode', expectedMode: 'Previsao', detectedMode: 'Relacao' });
  });

  it('arquivo de Previsao importado no modo Relacao retorna erro estruturado wrongMode', async () => {
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'previsao.xlsx', PREVISAO_HEADERS, [previsaoRow()]);
    const result = await importFile(
      { mode: 'Relacao', sourcePath, sourceKind: 'external' },
      { db, reportRoot, lookupCompanyProfile: lookupOnly0103 }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({ kind: 'wrongMode', expectedMode: 'Relacao', detectedMode: 'Previsao' });
  });
});

describe('importFile - cabecalho ambiguo (Vencimento duplicado)', () => {
  it('retorna erro estruturado ambiguousHeader em vez de escolher uma coluna silenciosamente', async () => {
    const headersWithDuplicateVencimento = [...PREVISAO_HEADERS, 'Vencimento'];
    const rowWithDuplicateVencimento = [...previsaoRow(), '02/03/2026'];
    const sourcePath = await writeFixtureWorkbook(
      sourceDir,
      'previsao-dois-vencimento.xlsx',
      headersWithDuplicateVencimento,
      [rowWithDuplicateVencimento]
    );

    const result = await importFile(
      { mode: 'Previsao', sourcePath, sourceKind: 'external' },
      { db, reportRoot, lookupCompanyProfile: lookupOnly0103 }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('ambiguousHeader');
    if (result.error.kind !== 'ambiguousHeader') return;
    expect(result.error.header).toBe('Vencimento');
    expect(result.error.occurrences).toBe(2);
  });
});

describe('importFile - coluna obrigatoria ausente', () => {
  it('retorna erro estruturado missingHeaders com a lista de colunas', async () => {
    const headersMissingOne = PREVISAO_HEADERS.filter((h) => h !== 'Comissao total (liquido)');
    const rowMissingOne = previsaoRow().filter((_, i) => PREVISAO_HEADERS[i] !== 'Comissao total (liquido)');
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'sem-coluna.xlsx', headersMissingOne, [rowMissingOne]);

    const result = await importFile(
      { mode: 'Previsao', sourcePath, sourceKind: 'external' },
      { db, reportRoot, lookupCompanyProfile: lookupOnly0103 }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('missingHeaders');
    if (result.error.kind !== 'missingHeaders') return;
    expect(result.error.missingHeaders).toContain('Comissao total (liquido)');
  });
});

describe('importFile - arquivo temporario do Excel', () => {
  it('ignora arquivos que comecam com ~$', async () => {
    const tempPath = join(sourceDir, '~$previsao.xlsx');
    writeFileSync(tempPath, 'nao importa, nunca deve ser lido');

    const result = await importFile(
      { mode: 'Previsao', sourcePath: tempPath, sourceKind: 'entrada' },
      { db, reportRoot, lookupCompanyProfile: lookupOnly0103 }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('temporaryFile');
  });
});

describe('importFile - filial nao configurada', () => {
  it('a previa lista a filial ausente sem bloquear a leitura dos dados', async () => {
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'previsao.xlsx', PREVISAO_HEADERS, [
      previsaoRow({ 'Nome da filial': '0199 - FILIAL SEM CADASTRO' })
    ]);
    const result = await importFile(
      { mode: 'Previsao', sourcePath, sourceKind: 'external' },
      { db, reportRoot, lookupCompanyProfile: () => null }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.missingBranchCodes).toEqual(['0199']);
    expect(result.preview.documents).toHaveLength(1); // dados continuam disponiveis na previa
  });
});

describe('importFile - arquivo repetido (hash ja processado)', () => {
  it('sinaliza previouslyProcessedAt quando o mesmo conteudo ja foi processado antes', async () => {
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'previsao.xlsx', PREVISAO_HEADERS, [previsaoRow()]);

    const first = await importFile(
      { mode: 'Previsao', sourcePath, sourceKind: 'external' },
      { db, reportRoot, lookupCompanyProfile: lookupOnly0103 }
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    insertBatch(db, {
      id: 'batch-1',
      mode: 'Previsao',
      sourceOriginalName: 'previsao.xlsx',
      sourceHash: first.preview.sourceHash,
      importedAt: '2026-01-05T10:00:00.000Z',
      sourceRowCount: 1,
      outputCount: 1,
      status: 'completed',
      appVersion: '0.1.0'
    });

    const second = await importFile(
      { mode: 'Previsao', sourcePath, sourceKind: 'external' },
      { db, reportRoot, lookupCompanyProfile: lookupOnly0103 }
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.preview.previouslyProcessedAt).toBe('2026-01-05T10:00:00.000Z');
  });
});

describe('importFile - varios vendedores e varias filiais', () => {
  it('agrupa corretamente e conta vendedores/filiais distintos', async () => {
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'previsao.xlsx', PREVISAO_HEADERS, [
      previsaoRow({ 'Dados do vendedor': '000001 - VENDEDOR UM', 'Nome da filial': '0103 - FILIAL A' }),
      previsaoRow({ 'Dados do vendedor': '000002 - VENDEDOR DOIS', 'Nome da filial': '0103 - FILIAL A' }),
      previsaoRow({ 'Dados do vendedor': '000001 - VENDEDOR UM', 'Nome da filial': '0104 - FILIAL B' })
    ]);
    const result = await importFile(
      { mode: 'Previsao', sourcePath, sourceKind: 'external' },
      { db, reportRoot, lookupCompanyProfile: (code) => (code === '0103' || code === '0104' ? COMPANY_0103 : null) }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.sellerCount).toBe(2);
    expect(result.preview.branchCount).toBe(2);
    expect(result.preview.documents).toHaveLength(3); // 000001+0103, 000002+0103, 000001+0104
  });
});

describe('importFile - processamento simultaneo do mesmo path', () => {
  it('a segunda chamada concorrente para o mesmo path e recusada', async () => {
    const sourcePath = await writeFixtureWorkbook(sourceDir, 'previsao.xlsx', PREVISAO_HEADERS, [previsaoRow()]);
    const deps = { db, reportRoot, lookupCompanyProfile: lookupOnly0103 };

    const [first, second] = await Promise.all([
      importFile({ mode: 'Previsao', sourcePath, sourceKind: 'external' }, deps),
      importFile({ mode: 'Previsao', sourcePath, sourceKind: 'external' }, deps)
    ]);

    const results = [first, second];
    const okCount = results.filter((r) => r.ok).length;
    const alreadyProcessingCount = results.filter((r) => !r.ok && r.error.kind === 'alreadyProcessing').length;
    expect(okCount).toBe(1);
    expect(alreadyProcessingCount).toBe(1);
  });
});
