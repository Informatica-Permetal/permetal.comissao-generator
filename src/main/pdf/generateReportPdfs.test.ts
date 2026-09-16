import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Decimal from 'decimal.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompanyProfile } from '@shared/types/companyProfile';
import type { PrevisaoParsedRow } from '../reports/previsao/parser';
import type { RelacaoParsedRow } from '../reports/relacao/parser';
import { generatePrevisaoPdfs, generateRelacaoPdfs } from './generateReportPdfs';

const FAKE_PDF_BUFFER = Buffer.from('%PDF-1.7 fake');

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
const COMPANY_0105: CompanyProfile = { ...COMPANY_0103, branchCode: '0105', displayName: 'METALGRADE NOVA' };

function companyLookup(byBranch: Record<string, CompanyProfile>) {
  return (branchCode: string) => byBranch[branchCode] ?? null;
}

function previsaoRow(overrides: Partial<PrevisaoParsedRow> = {}): PrevisaoParsedRow {
  return {
    sourceRowNumber: 2,
    dadosCliente: 'CLIENTE TESTE',
    dadosTitulo: '001-000012169--NF',
    dadosPedido: null,
    emissaoPedidoTitulo: new Date(Date.UTC(2026, 7, 6)),
    vencimento: new Date(Date.UTC(2026, 7, 6)),
    valorBaseParaBaixa: new Decimal('8800'),
    valorTotalComissao: new Decimal('0'),
    dtBaixa: null,
    valorIrrf: new Decimal('0'),
    comissaoTotalLiquido: new Decimal('30.80'),
    vendedorCodigo: '000090',
    vendedorNome: 'CARLOS EDUARDO ROSA',
    classificacao: 'Titulo original',
    filialCodigo: '0103',
    filialNome: 'PERMETAL SAO PAULO',
    ...overrides
  };
}

function relacaoRow(overrides: Partial<RelacaoParsedRow> = {}): RelacaoParsedRow {
  return {
    sourceRowNumber: 2,
    tipoDeRegistro: 'Comissao',
    nomeDoVendedor: 'ADEMIR FURLANETO',
    filialCodigo: '0103',
    vendedorCodigo: '000001',
    prefixo: '001',
    numeroDoTituloOriginal: '000033931',
    parcela: null,
    nomeDoCliente: 'CLIENTE TESTE',
    dataDeBaixaDoTitulo: new Date(Date.UTC(2026, 7, 3)),
    dataDoPgtoDaComissao: null,
    numeroDoPedido: '029617',
    valorBaseDaComissao: new Decimal('109360'),
    percentComissaoSobreVlBase: new Decimal('0.18'),
    valorDaComissao: new Decimal('191.38'),
    comissaoGeradaPelaBE: 'Baixa',
    ...overrides
  };
}

let reportRoot: string;
beforeEach(() => {
  reportRoot = mkdtempSync(join(tmpdir(), 'fc-generate-'));
});
afterEach(() => {
  rmSync(reportRoot, { recursive: true, force: true });
});

describe('generatePrevisaoPdfs', () => {
  it('bloqueia a geracao inteira quando alguma filial nao esta configurada', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await generatePrevisaoPdfs(
      { headerRowNumber: 1, warnings: [], rows: [previsaoRow()], groups: [
        { branchCode: '0103', branchName: 'PERMETAL SAO PAULO', sellerCode: '000090', sellerName: 'CARLOS EDUARDO ROSA', rows: [previsaoRow()], total: new Decimal('30.80') }
      ] },
      {
        reportRoot,
        generatedAt: new Date(Date.UTC(2026, 8, 10)),
        lookupCompanyProfile: () => null,
        renderPdf
      }
    );
    expect(result.missingBranchCodes).toEqual(['0103']);
    expect(result.generated).toHaveLength(0);
    expect(renderPdf).not.toHaveBeenCalled();
  });

  it('gera um PDF real em disco por grupo, em <raiz>/Previsao/Gerados', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await generatePrevisaoPdfs(
      {
        headerRowNumber: 1,
        warnings: [],
        rows: [previsaoRow()],
        groups: [
          {
            branchCode: '0103',
            branchName: 'PERMETAL SAO PAULO',
            sellerCode: '000090',
            sellerName: 'CARLOS EDUARDO ROSA',
            rows: [previsaoRow()],
            total: new Decimal('30.80')
          }
        ]
      },
      {
        reportRoot,
        generatedAt: new Date(Date.UTC(2026, 8, 10)),
        lookupCompanyProfile: (code) => (code === '0103' ? COMPANY_0103 : null),
        renderPdf
      }
    );

    expect(result.missingBranchCodes).toHaveLength(0);
    expect(result.generated).toHaveLength(1);
    const [generated] = result.generated;
    expect(generated.filePath).toBe(
      join(reportRoot, 'Previsão', 'Gerados', '2026-09-10_PREVISAO_0103_000090_CARLOS_EDUARDO_ROSA.pdf')
    );
    expect(existsSync(generated.filePath)).toBe(true);
    expect(readFileSync(generated.filePath)).toEqual(FAKE_PDF_BUFFER);
    expect(generated.total).toBe('R$ 30,80');

    const htmlPassedToRender = renderPdf.mock.calls[0][0] as string;
    expect(htmlPassedToRender).toContain('CARLOS EDUARDO ROSA');
    expect(htmlPassedToRender).toContain('Total da Previsão');
  });

  it('gera um arquivo separado por vendedor+filial quando ha varios grupos', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await generatePrevisaoPdfs(
      {
        headerRowNumber: 1,
        warnings: [],
        rows: [],
        groups: [
          {
            branchCode: '0103',
            branchName: 'A',
            sellerCode: '000001',
            sellerName: 'VENDEDOR UM',
            rows: [previsaoRow()],
            total: new Decimal('10')
          },
          {
            branchCode: '0103',
            branchName: 'A',
            sellerCode: '000002',
            sellerName: 'VENDEDOR DOIS',
            rows: [previsaoRow()],
            total: new Decimal('20')
          }
        ]
      },
      {
        reportRoot,
        generatedAt: new Date(Date.UTC(2026, 8, 10)),
        lookupCompanyProfile: () => COMPANY_0103,
        renderPdf
      }
    );
    expect(result.generated).toHaveLength(2);
    expect(new Set(result.generated.map((g) => g.filePath)).size).toBe(2);
  });

  it('vendedor multi-filial escolhido como consolidado gera um unico PDF com todas as filiais', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await generatePrevisaoPdfs(
      {
        headerRowNumber: 1,
        warnings: [],
        rows: [],
        groups: [
          {
            branchCode: '0103',
            branchName: 'PERMETAL SAO PAULO',
            sellerCode: '000097',
            sellerName: 'RODRIGO LEAL MIGNELLA',
            rows: [previsaoRow({ comissaoTotalLiquido: new Decimal('10.00') })],
            total: new Decimal('10.00')
          },
          {
            branchCode: '0104',
            branchName: 'PERMETAL CRAVINHOS',
            sellerCode: '000097',
            sellerName: 'RODRIGO LEAL MIGNELLA',
            rows: [previsaoRow({ comissaoTotalLiquido: new Decimal('20.00') })],
            total: new Decimal('20.00')
          },
          {
            branchCode: '0105',
            branchName: 'METALGRADE NOVA',
            sellerCode: '000097',
            sellerName: 'RODRIGO LEAL MIGNELLA',
            rows: [previsaoRow({ comissaoTotalLiquido: new Decimal('5.00') })],
            total: new Decimal('5.00')
          }
        ]
      },
      {
        reportRoot,
        generatedAt: new Date(Date.UTC(2026, 8, 15)),
        lookupCompanyProfile: companyLookup({ '0103': COMPANY_0103, '0104': COMPANY_0104, '0105': COMPANY_0105 }),
        modeBySeller: new Map([['000097', 'consolidated_by_seller']]),
        renderPdf
      }
    );

    expect(result.generated).toHaveLength(1);
    const [generated] = result.generated;
    expect(generated.groupingMode).toBe('consolidated_by_seller');
    expect(generated.filePath).toBe(
      join(reportRoot, 'Previsão', 'Gerados', '2026-09-15_PREVISAO_CONSOLIDADO_000097_RODRIGO_LEAL_MIGNELLA.pdf')
    );
    expect(existsSync(generated.filePath)).toBe(true);
    // Total consolidado = soma dos 3 subtotais, nunca recalculado a partir das linhas.
    expect(generated.total).toBe('R$ 35,00');
    expect(generated.branches).toEqual([
      { branchCode: '0103', branchName: 'PERMETAL SAO PAULO', rowCount: 1, subtotal: 'R$ 10,00' },
      { branchCode: '0104', branchName: 'PERMETAL CRAVINHOS', rowCount: 1, subtotal: 'R$ 20,00' },
      { branchCode: '0105', branchName: 'METALGRADE NOVA', rowCount: 1, subtotal: 'R$ 5,00' }
    ]);

    const html = renderPdf.mock.calls[0][0] as string;
    expect(html).toContain('Filial 0103');
    expect(html).toContain('Filial 0104');
    expect(html).toContain('Filial 0105');
    expect(html).toContain('R$ 10,00');
    expect(html).toContain('R$ 20,00');
    expect(html).toContain('R$ 5,00');
    expect(html).toContain('R$ 35,00');
    expect(html).toContain('Consolidado');
  });

  it('lote com escolha mista: um vendedor consolidado e outro separado geram documentos independentes', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await generatePrevisaoPdfs(
      {
        headerRowNumber: 1,
        warnings: [],
        rows: [],
        groups: [
          {
            branchCode: '0103',
            branchName: 'PERMETAL SAO PAULO',
            sellerCode: '000097',
            sellerName: 'RODRIGO LEAL MIGNELLA',
            rows: [previsaoRow()],
            total: new Decimal('10')
          },
          {
            branchCode: '0104',
            branchName: 'PERMETAL CRAVINHOS',
            sellerCode: '000097',
            sellerName: 'RODRIGO LEAL MIGNELLA',
            rows: [previsaoRow()],
            total: new Decimal('20')
          },
          {
            branchCode: '0103',
            branchName: 'PERMETAL SAO PAULO',
            sellerCode: '000001',
            sellerName: 'OUTRO VENDEDOR',
            rows: [previsaoRow()],
            total: new Decimal('99')
          }
        ]
      },
      {
        reportRoot,
        generatedAt: new Date(Date.UTC(2026, 8, 15)),
        lookupCompanyProfile: companyLookup({ '0103': COMPANY_0103, '0104': COMPANY_0104 }),
        modeBySeller: new Map([['000097', 'consolidated_by_seller']]),
        renderPdf
      }
    );

    expect(result.generated).toHaveLength(2);
    const consolidated = result.generated.find((g) => g.sellerCode === '000097');
    const separate = result.generated.find((g) => g.sellerCode === '000001');
    expect(consolidated?.groupingMode).toBe('consolidated_by_seller');
    expect(consolidated?.branches).toHaveLength(2);
    expect(separate?.groupingMode).toBe('separate_by_branch');
    expect(separate?.branches).toHaveLength(1);
  });
});

describe('generateRelacaoPdfs', () => {
  it('inclui o campo Valor da Comissao formatado no HTML gerado', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    await generateRelacaoPdfs(
      {
        headerRowNumber: 1,
        warnings: [],
        rows: [relacaoRow()],
        groups: [
          {
            branchCode: '0103',
            branchName: '',
            sellerCode: '000001',
            sellerName: 'ADEMIR FURLANETO',
            rows: [relacaoRow()],
            total: new Decimal('191.38')
          }
        ]
      },
      {
        reportRoot,
        generatedAt: new Date(Date.UTC(2026, 8, 10)),
        lookupCompanyProfile: () => COMPANY_0103,
        renderPdf
      }
    );
    expect(renderPdf).toHaveBeenCalledTimes(1);
    expect(renderPdf.mock.calls[0][0]).toContain('R$ 191,38');
    expect(renderPdf.mock.calls[0][0]).toContain('Total da Comissão');
  });

  it('vendedor multi-filial escolhido como consolidado gera um unico PDF, filial deixa de ser exigida em cada linha', async () => {
    const renderPdf = vi.fn().mockResolvedValue(FAKE_PDF_BUFFER);
    const result = await generateRelacaoPdfs(
      {
        headerRowNumber: 1,
        warnings: [],
        rows: [],
        groups: [
          {
            branchCode: '0103',
            branchName: 'PERMETAL SAO PAULO',
            sellerCode: '000097',
            sellerName: 'RODRIGO LEAL MIGNELLA',
            rows: [relacaoRow({ valorDaComissao: new Decimal('10.00') })],
            total: new Decimal('10.00')
          },
          {
            branchCode: '0104',
            branchName: 'PERMETAL CRAVINHOS',
            sellerCode: '000097',
            sellerName: 'RODRIGO LEAL MIGNELLA',
            rows: [relacaoRow({ valorDaComissao: new Decimal('20.00') })],
            total: new Decimal('20.00')
          }
        ]
      },
      {
        reportRoot,
        generatedAt: new Date(Date.UTC(2026, 8, 15)),
        lookupCompanyProfile: companyLookup({ '0103': COMPANY_0103, '0104': COMPANY_0104 }),
        modeBySeller: new Map([['000097', 'consolidated_by_seller']]),
        renderPdf
      }
    );

    expect(result.generated).toHaveLength(1);
    const [generated] = result.generated;
    expect(generated.groupingMode).toBe('consolidated_by_seller');
    expect(generated.filePath).toBe(
      join(reportRoot, 'Relação', 'Gerados', '2026-09-15_RELACAO_CONSOLIDADO_000097_RODRIGO_LEAL_MIGNELLA.pdf')
    );
    expect(generated.total).toBe('R$ 30,00');

    const html = renderPdf.mock.calls[0][0] as string;
    expect(html).toContain('Total Consolidado da Comissão');
    expect(html).toContain('R$ 30,00');
  });
});
