import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import type { CompanyGroup, CompanyProfile } from '@shared/types/companyProfile';
import type { DocumentGroup } from '../reports/common/grouping';
import type { PrevisaoParsedRow } from '../reports/previsao/parser';
import { buildPrevisaoViewModel } from './previsaoViewModel';

const NO_GROUP = (): CompanyGroup | null => null;

const COMPANY: CompanyProfile = {
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

function row(overrides: Partial<PrevisaoParsedRow> = {}): PrevisaoParsedRow {
  return {
    sourceRowNumber: 2,
    dadosCliente: '064756/01 - CLIENTE TESTE LTDA',
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

function group(rows: PrevisaoParsedRow[]): DocumentGroup<PrevisaoParsedRow> {
  const total = rows.reduce((sum, r) => sum.plus(r.comissaoTotalLiquido ?? new Decimal(0)), new Decimal(0));
  return {
    branchCode: '0103',
    branchName: 'PERMETAL SAO PAULO',
    sellerCode: '000090',
    sellerName: 'CARLOS EDUARDO ROSA',
    rows,
    total
  };
}

describe('buildPrevisaoViewModel', () => {
  it('agrupa por classificacao preservando a ordem de primeira aparicao', () => {
    const vm = buildPrevisaoViewModel(
      group([
        row({ classificacao: 'Titulo original' }),
        row({ classificacao: 'Pedido de venda', dadosTitulo: null, dadosPedido: '026029' }),
        row({ classificacao: 'Titulo original' })
      ]),
      COMPANY,
      NO_GROUP,
      new Date()
    );
    expect(vm.sections.map((s) => s.classificacao)).toEqual(['Titulo original', 'Pedido de venda']);
    expect(vm.sections[0].rows).toHaveLength(2);
    expect(vm.sections[1].rows).toHaveLength(1);
    expect(vm.rowCount).toBe(3);
  });

  it('classificacao desconhecida cria sua propria secao sem perder a linha', () => {
    const vm = buildPrevisaoViewModel(group([row({ classificacao: 'Nova Classificacao' })]), COMPANY, NO_GROUP, new Date());
    expect(vm.sections).toHaveLength(1);
    expect(vm.sections[0].classificacao).toBe('Nova Classificacao');
    expect(vm.sections[0].rows).toHaveLength(1);
  });

  it('Documento mostra titulo e pedido quando os dois existem, e "-" quando nenhum existe', () => {
    const vm = buildPrevisaoViewModel(
      group([
        row({ dadosTitulo: 'TIT-1', dadosPedido: 'PED-1' }),
        row({ dadosTitulo: null, dadosPedido: null })
      ]),
      COMPANY,
      NO_GROUP,
      new Date()
    );
    expect(vm.sections[0].rows[0].documento).toBe('TIT-1 / PED-1');
    expect(vm.sections[0].rows[1].documento).toBe('-');
  });

  it('total exibido e a soma decimal-safe de Comissao total (liquido), formatada em BRL', () => {
    const vm = buildPrevisaoViewModel(
      group([row({ comissaoTotalLiquido: new Decimal('30.80') }), row({ comissaoTotalLiquido: new Decimal('7.93129527965909') })]),
      COMPANY,
      NO_GROUP,
      new Date()
    );
    expect(vm.total).toBe('R$ 38,73');
  });

  it('usa o nome da filial vindo da propria linha, nunca inventa outro', () => {
    const vm = buildPrevisaoViewModel(group([row()]), COMPANY, NO_GROUP, new Date());
    expect(vm.identity.branchName).toBe('PERMETAL SAO PAULO');
  });
});

describe('buildPrevisaoViewModel - periodo de analise', () => {
  it('calcula o periodo a partir do menor e maior Vencimento valido', () => {
    const vm = buildPrevisaoViewModel(
      group([
        row({ vencimento: new Date(Date.UTC(2026, 7, 20)) }),
        row({ vencimento: new Date(Date.UTC(2026, 5, 1)) }),
        row({ vencimento: new Date(Date.UTC(2026, 8, 10)) })
      ]),
      COMPANY,
      NO_GROUP,
      new Date()
    );
    expect(vm.identity.periodoAnalise).toBe('01/06/2026 a 10/09/2026');
  });

  it('mostra "Não informado" quando nenhuma linha tem Vencimento valido', () => {
    const vm = buildPrevisaoViewModel(group([row({ vencimento: null })]), COMPANY, NO_GROUP, new Date());
    expect(vm.identity.periodoAnalise).toBe('Não informado');
  });

  it('o periodo de analise NUNCA filtra linhas - todas continuam no documento e no total, independente da data', () => {
    const veryOldRow = row({ vencimento: new Date(Date.UTC(2020, 0, 1)), comissaoTotalLiquido: new Decimal('50') });
    const veryNewRow = row({ vencimento: new Date(Date.UTC(2030, 11, 31)), comissaoTotalLiquido: new Decimal('75') });
    const noDateRow = row({ vencimento: null, comissaoTotalLiquido: new Decimal('25') });
    const vm = buildPrevisaoViewModel(group([veryOldRow, veryNewRow, noDateRow]), COMPANY, NO_GROUP, new Date());

    expect(vm.rowCount).toBe(3);
    expect(vm.sections[0].rows).toHaveLength(3);
    expect(vm.total).toBe('R$ 150,00'); // 50 + 75 + 25, nenhuma linha descartada
    expect(vm.identity.periodoAnalise).toBe('01/01/2020 a 31/12/2030');
  });
});
