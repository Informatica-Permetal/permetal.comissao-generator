import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import type { CompanyGroup, CompanyProfile } from '@shared/types/companyProfile';
import type { DocumentGroup } from '../reports/common/grouping';
import type { RelacaoParsedRow } from '../reports/relacao/parser';
import { buildRelacaoViewModel } from './relacaoViewModel';

const NO_GROUP = (): CompanyGroup | null => null;

const COMPANY: CompanyProfile = {
  branchCode: '0104',
  displayName: 'PERMETAL CRAVINHOS',
  legalName: null,
  tradeName: null,
  cnpj: null,
  address: null,
  logoPath: null,
  groupKey: null,
  active: true,
  updatedAt: '2026-01-01T00:00:00.000Z'
};

function row(overrides: Partial<RelacaoParsedRow> = {}): RelacaoParsedRow {
  return {
    sourceRowNumber: 2,
    tipoDeRegistro: 'Comissao',
    nomeDoVendedor: 'ADEMIR FURLANETO',
    filialCodigo: '0104',
    vendedorCodigo: '000001',
    prefixo: '001',
    numeroDoTituloOriginal: '000033931',
    parcela: null,
    nomeDoCliente: 'CLIENTE TESTE LTDA',
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

function group(rows: RelacaoParsedRow[]): DocumentGroup<RelacaoParsedRow> {
  const total = rows.reduce((sum, r) => sum.plus(r.valorDaComissao ?? new Decimal(0)), new Decimal(0));
  return {
    branchCode: '0104',
    branchName: '',
    sellerCode: '000001',
    sellerName: 'ADEMIR FURLANETO',
    rows,
    total
  };
}

describe('buildRelacaoViewModel', () => {
  it('monta o titulo a partir de Prefixo + Numero + Parcela preservando zeros', () => {
    const vm = buildRelacaoViewModel(
      group([row({ prefixo: '001', numeroDoTituloOriginal: '000033931', parcela: '02' })]),
      COMPANY,
      NO_GROUP,
      new Date()
    );
    expect(vm.rows[0].titulo).toBe('001-000033931-02');
  });

  it('omite a parcela quando ela esta em branco', () => {
    const vm = buildRelacaoViewModel(group([row({ parcela: null })]), COMPANY, NO_GROUP, new Date());
    expect(vm.rows[0].titulo).toBe('001-000033931');
  });

  it('percentual e exibido exatamente como veio da fonte, nunca recalculado', () => {
    const vm = buildRelacaoViewModel(
      group([row({ valorBaseDaComissao: new Decimal('109360'), percentComissaoSobreVlBase: new Decimal('0.18'), valorDaComissao: new Decimal('191.38') })]),
      COMPANY,
      NO_GROUP,
      new Date()
    );
    expect(vm.rows[0].percentComissao).toBe('0,18%');
    expect(vm.rows[0].valorDaComissao).toBe('R$ 191,38');
  });

  it('branchName usa o nome cadastrado no perfil da empresa, pois a Relacao nao traz nome de filial', () => {
    const vm = buildRelacaoViewModel(group([row()]), COMPANY, NO_GROUP, new Date());
    expect(vm.identity.branchName).toBe('PERMETAL CRAVINHOS');
  });

  it('total exibido e a soma decimal-safe de Valor da Comissao', () => {
    const vm = buildRelacaoViewModel(
      group([row({ valorDaComissao: new Decimal('191.38') }), row({ valorDaComissao: new Decimal('168.47') })]),
      COMPANY,
      NO_GROUP,
      new Date()
    );
    expect(vm.total).toBe('R$ 359,85');
    expect(vm.rowCount).toBe(2);
  });
});

describe('buildRelacaoViewModel - periodo de analise', () => {
  it('calcula o periodo a partir do menor e maior Data de Baixa do Titulo valida', () => {
    const vm = buildRelacaoViewModel(
      group([
        row({ dataDeBaixaDoTitulo: new Date(Date.UTC(2026, 7, 20)) }),
        row({ dataDeBaixaDoTitulo: new Date(Date.UTC(2026, 5, 1)) })
      ]),
      COMPANY,
      NO_GROUP,
      new Date()
    );
    expect(vm.identity.periodoAnalise).toBe('01/06/2026 a 20/08/2026');
  });

  it('mostra "Não informado" quando nenhuma linha tem Data de Baixa valida', () => {
    const vm = buildRelacaoViewModel(group([row({ dataDeBaixaDoTitulo: null })]), COMPANY, NO_GROUP, new Date());
    expect(vm.identity.periodoAnalise).toBe('Não informado');
  });

  it('o periodo de analise NUNCA filtra linhas - todas continuam no documento e no total', () => {
    const semData = row({ dataDeBaixaDoTitulo: null, valorDaComissao: new Decimal('10') });
    const comData = row({ dataDeBaixaDoTitulo: new Date(Date.UTC(2026, 7, 20)), valorDaComissao: new Decimal('20') });
    const vm = buildRelacaoViewModel(group([semData, comData]), COMPANY, NO_GROUP, new Date());

    expect(vm.rowCount).toBe(2);
    expect(vm.rows).toHaveLength(2);
    expect(vm.total).toBe('R$ 30,00');
  });
});
