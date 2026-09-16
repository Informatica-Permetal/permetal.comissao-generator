import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import type { CompanyGroup, CompanyProfile } from '@shared/types/companyProfile';
import type { ConsolidatedSellerGroup } from '../reports/common/grouping';
import type { PrevisaoParsedRow } from '../reports/previsao/parser';
import type { RelacaoParsedRow } from '../reports/relacao/parser';
import { buildPrevisaoConsolidatedViewModel, buildRelacaoConsolidatedViewModel } from './consolidatedViewModel';

const NO_GROUP = (): CompanyGroup | null => null;

const GROUP_PERMETAL: CompanyGroup = {
  groupKey: 'PERMETAL',
  displayName: 'Permetal S.A. Metais Perfurados',
  legalName: 'Permetal S A Metais Perfurados',
  headquartersBranchCode: '0104',
  headquartersCnpj: '61.139.192/0004-59',
  headquartersAddress: { endereco: 'Rodovia Anhanguera Km 298+193 Mts', cidade: 'Cravinhos', uf: 'SP' },
  updatedAt: '2026-01-01T00:00:00.000Z'
};

function company(branchCode: string, overrides: Partial<CompanyProfile> = {}): CompanyProfile {
  return {
    branchCode,
    displayName: `FILIAL ${branchCode}`,
    legalName: null,
    tradeName: null,
    cnpj: `00.000.000/000${branchCode}-00`,
    address: null,
    logoPath: null,
    groupKey: null,
    active: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
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
    comissaoTotalLiquido: new Decimal('10'),
    vendedorCodigo: '000097',
    vendedorNome: 'RODRIGO LEAL MIGNELLA',
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
    nomeDoVendedor: 'RODRIGO LEAL MIGNELLA',
    filialCodigo: '0103',
    vendedorCodigo: '000097',
    prefixo: '001',
    numeroDoTituloOriginal: '000033931',
    parcela: null,
    nomeDoCliente: 'CLIENTE TESTE',
    dataDeBaixaDoTitulo: new Date(Date.UTC(2026, 7, 3)),
    dataDoPgtoDaComissao: null,
    numeroDoPedido: '029617',
    valorBaseDaComissao: new Decimal('109360'),
    percentComissaoSobreVlBase: new Decimal('0.18'),
    valorDaComissao: new Decimal('10'),
    comissaoGeradaPelaBE: 'Baixa',
    ...overrides
  };
}

describe('buildPrevisaoConsolidatedViewModel', () => {
  it('resolve o grupo corporativo de CADA filial independentemente, nunca usando uma como identidade global', () => {
    const consolidated: ConsolidatedSellerGroup<PrevisaoParsedRow> = {
      sellerCode: '000097',
      sellerName: 'RODRIGO LEAL MIGNELLA',
      rowCount: 2,
      total: new Decimal('30'),
      branches: [
        { branchCode: '0103', branchName: 'PERMETAL SAO PAULO', sellerCode: '000097', sellerName: 'RODRIGO LEAL MIGNELLA', rows: [previsaoRow({ filialCodigo: '0103', comissaoTotalLiquido: new Decimal('10') })], total: new Decimal('10') },
        { branchCode: '0106', branchName: 'MGZINC GALVANIZACAO', sellerCode: '000097', sellerName: 'RODRIGO LEAL MIGNELLA', rows: [previsaoRow({ filialCodigo: '0106', comissaoTotalLiquido: new Decimal('20') })], total: new Decimal('20') }
      ]
    };

    const lookupCompanyProfile = (branchCode: string) =>
      branchCode === '0103' ? company('0103', { groupKey: 'PERMETAL' }) : company('0106', { groupKey: null });
    const lookupCompanyGroup = (groupKey: string | null) => (groupKey === 'PERMETAL' ? GROUP_PERMETAL : null);

    const vm = buildPrevisaoConsolidatedViewModel(consolidated, lookupCompanyProfile, lookupCompanyGroup, new Date());

    expect(vm.branches[0].company.group?.displayName).toBe('Permetal S.A. Metais Perfurados');
    expect(vm.branches[1].company.group).toBeNull(); // 0106 nao tem grupo neste cenario - nunca herda o do 0103
  });

  it('periodo geral considera TODAS as filiais do vendedor, nao so a primeira', () => {
    const consolidated: ConsolidatedSellerGroup<PrevisaoParsedRow> = {
      sellerCode: '000097',
      sellerName: 'RODRIGO LEAL MIGNELLA',
      rowCount: 2,
      total: new Decimal('30'),
      branches: [
        { branchCode: '0103', branchName: 'A', sellerCode: '000097', sellerName: 'RODRIGO LEAL MIGNELLA', rows: [previsaoRow({ vencimento: new Date(Date.UTC(2026, 5, 1)) })], total: new Decimal('10') },
        { branchCode: '0104', branchName: 'B', sellerCode: '000097', sellerName: 'RODRIGO LEAL MIGNELLA', rows: [previsaoRow({ vencimento: new Date(Date.UTC(2026, 9, 15)) })], total: new Decimal('20') }
      ]
    };

    const vm = buildPrevisaoConsolidatedViewModel(consolidated, () => company('x'), NO_GROUP, new Date());
    expect(vm.identity.periodoAnalise).toBe('01/06/2026 a 15/10/2026');
  });

  it('nunca recalcula os subtotais - cada filial preserva exatamente o total ja calculado, e o total geral e a soma deles', () => {
    const consolidated: ConsolidatedSellerGroup<PrevisaoParsedRow> = {
      sellerCode: '000097',
      sellerName: 'RODRIGO LEAL MIGNELLA',
      rowCount: 3,
      total: new Decimal('35'),
      branches: [
        { branchCode: '0103', branchName: 'A', sellerCode: '000097', sellerName: 'RODRIGO LEAL MIGNELLA', rows: [previsaoRow()], total: new Decimal('10') },
        { branchCode: '0104', branchName: 'B', sellerCode: '000097', sellerName: 'RODRIGO LEAL MIGNELLA', rows: [previsaoRow()], total: new Decimal('20') },
        { branchCode: '0105', branchName: 'C', sellerCode: '000097', sellerName: 'RODRIGO LEAL MIGNELLA', rows: [previsaoRow()], total: new Decimal('5') }
      ]
    };

    const vm = buildPrevisaoConsolidatedViewModel(consolidated, () => company('x'), NO_GROUP, new Date());
    expect(vm.branches.map((b) => b.subtotal)).toEqual(['R$ 10,00', 'R$ 20,00', 'R$ 5,00']);
    expect(vm.total).toBe('R$ 35,00');
  });
});

describe('buildRelacaoConsolidatedViewModel', () => {
  it('periodo geral usa Data de Baixa do Titulo de TODAS as filiais', () => {
    const consolidated: ConsolidatedSellerGroup<RelacaoParsedRow> = {
      sellerCode: '000097',
      sellerName: 'RODRIGO LEAL MIGNELLA',
      rowCount: 2,
      total: new Decimal('30'),
      branches: [
        { branchCode: '0103', branchName: 'A', sellerCode: '000097', sellerName: 'RODRIGO LEAL MIGNELLA', rows: [relacaoRow({ dataDeBaixaDoTitulo: new Date(Date.UTC(2026, 2, 10)) })], total: new Decimal('10') },
        { branchCode: '0104', branchName: 'B', sellerCode: '000097', sellerName: 'RODRIGO LEAL MIGNELLA', rows: [relacaoRow({ dataDeBaixaDoTitulo: new Date(Date.UTC(2026, 7, 25)) })], total: new Decimal('20') }
      ]
    };

    const vm = buildRelacaoConsolidatedViewModel(consolidated, () => company('x'), NO_GROUP, new Date());
    expect(vm.identity.periodoAnalise).toBe('10/03/2026 a 25/08/2026');
  });

  it('mostra "Não informado" quando nenhuma filial tem data valida', () => {
    const consolidated: ConsolidatedSellerGroup<RelacaoParsedRow> = {
      sellerCode: '000097',
      sellerName: 'RODRIGO LEAL MIGNELLA',
      rowCount: 1,
      total: new Decimal('10'),
      branches: [
        { branchCode: '0103', branchName: 'A', sellerCode: '000097', sellerName: 'RODRIGO LEAL MIGNELLA', rows: [relacaoRow({ dataDeBaixaDoTitulo: null })], total: new Decimal('10') }
      ]
    };
    const vm = buildRelacaoConsolidatedViewModel(consolidated, () => company('x'), NO_GROUP, new Date());
    expect(vm.identity.periodoAnalise).toBe('Não informado');
  });
});
