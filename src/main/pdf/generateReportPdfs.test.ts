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
});
