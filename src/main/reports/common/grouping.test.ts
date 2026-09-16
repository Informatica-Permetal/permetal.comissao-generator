import Decimal from 'decimal.js';
import { describe, expect, it } from 'vitest';
import {
  findMultiBranchSellers,
  groupRows,
  isConsolidatedUnit,
  isSeparateUnit,
  resolvePublishUnits,
  type DocumentIdentity
} from './grouping';

interface FakeRow {
  branchCode: string;
  sellerCode: string;
  amount: string;
}

function identityOf(row: FakeRow): DocumentIdentity {
  return { branchCode: row.branchCode, branchName: `Filial ${row.branchCode}`, sellerCode: row.sellerCode, sellerName: `Vendedor ${row.sellerCode}` };
}

function amountOf(row: FakeRow): Decimal {
  return new Decimal(row.amount);
}

describe('groupRows', () => {
  it('nunca deduplica linhas iguais - cada uma contribui para o total', () => {
    const rows: FakeRow[] = [
      { branchCode: '0103', sellerCode: 'V1', amount: '10' },
      { branchCode: '0103', sellerCode: 'V1', amount: '10' }
    ];
    const groups = groupRows(rows, identityOf, amountOf);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[0].total.toString()).toBe('20');
  });
});

describe('findMultiBranchSellers', () => {
  it('retorna vazio quando nenhum vendedor tem mais de uma filial', () => {
    const groups = groupRows(
      [
        { branchCode: '0103', sellerCode: 'V1', amount: '10' },
        { branchCode: '0104', sellerCode: 'V2', amount: '20' }
      ],
      identityOf,
      amountOf
    );
    expect(findMultiBranchSellers(groups)).toEqual([]);
  });

  it('detecta um vendedor com registros em duas filiais', () => {
    const groups = groupRows(
      [
        { branchCode: '0103', sellerCode: 'V1', amount: '10' },
        { branchCode: '0104', sellerCode: 'V1', amount: '20' }
      ],
      identityOf,
      amountOf
    );
    const multi = findMultiBranchSellers(groups);
    expect(multi).toHaveLength(1);
    expect(multi[0]).toEqual({ sellerCode: 'V1', sellerName: 'Vendedor V1', branchCodes: ['0103', '0104'] });
  });

  it('detecta varios vendedores multi-filial ao mesmo tempo, cada um com sua propria lista', () => {
    const groups = groupRows(
      [
        { branchCode: '0103', sellerCode: 'V1', amount: '10' },
        { branchCode: '0104', sellerCode: 'V1', amount: '20' },
        { branchCode: '0104', sellerCode: 'V2', amount: '30' },
        { branchCode: '0105', sellerCode: 'V2', amount: '40' },
        { branchCode: '0106', sellerCode: 'V2', amount: '50' },
        { branchCode: '0103', sellerCode: 'V3', amount: '5' }
      ],
      identityOf,
      amountOf
    );
    const multi = findMultiBranchSellers(groups);
    expect(multi.map((s) => s.sellerCode).sort()).toEqual(['V1', 'V2']);
    expect(multi.find((s) => s.sellerCode === 'V2')?.branchCodes).toEqual(['0104', '0105', '0106']);
  });
});

describe('resolvePublishUnits', () => {
  it('vendedor de filial unica sempre publica separado, mesmo se presente no mapa como consolidado', () => {
    const groups = groupRows([{ branchCode: '0103', sellerCode: 'V1', amount: '10' }], identityOf, amountOf);
    const units = resolvePublishUnits(groups, new Map([['V1', 'consolidated_by_seller']]));
    expect(units).toHaveLength(1);
    expect(units[0].groupingMode).toBe('separate_by_branch');
  });

  it('vendedor multi-filial sem escolha explicita publica separado (padrao preservado)', () => {
    const groups = groupRows(
      [
        { branchCode: '0103', sellerCode: 'V1', amount: '10' },
        { branchCode: '0104', sellerCode: 'V1', amount: '20' }
      ],
      identityOf,
      amountOf
    );
    const units = resolvePublishUnits(groups, new Map());
    expect(units).toHaveLength(2);
    expect(units.every((u) => u.groupingMode === 'separate_by_branch')).toBe(true);
  });

  it('vendedor multi-filial com escolha consolidado produz uma unica unidade somando os totais sem recalcular', () => {
    const groups = groupRows(
      [
        { branchCode: '0103', sellerCode: 'V1', amount: '10.50' },
        { branchCode: '0104', sellerCode: 'V1', amount: '20.25' },
        { branchCode: '0105', sellerCode: 'V1', amount: '5.00' }
      ],
      identityOf,
      amountOf
    );
    const units = resolvePublishUnits(groups, new Map([['V1', 'consolidated_by_seller']]));
    expect(units).toHaveLength(1);
    const [unit] = units;
    expect(unit.groupingMode).toBe('consolidated_by_seller');
    if (!isConsolidatedUnit(unit)) throw new Error('esperava unidade consolidada');
    expect(unit.group.branches).toHaveLength(3);
    expect(unit.group.branches.map((b) => b.branchCode)).toEqual(['0103', '0104', '0105']);
    expect(unit.group.total.toString()).toBe('35.75');
    expect(unit.group.rowCount).toBe(3);
    // Cada filial mantem seu proprio subtotal - nunca recalculado.
    expect(unit.group.branches[0].total.toFixed(2)).toBe('10.50');
    expect(unit.group.branches[1].total.toFixed(2)).toBe('20.25');
    expect(unit.group.branches[2].total.toFixed(2)).toBe('5.00');
  });

  it('escolha mista: um vendedor consolidado e outro separado no mesmo lote', () => {
    const groups = groupRows(
      [
        { branchCode: '0103', sellerCode: 'V1', amount: '10' },
        { branchCode: '0104', sellerCode: 'V1', amount: '20' },
        { branchCode: '0103', sellerCode: 'V2', amount: '30' },
        { branchCode: '0104', sellerCode: 'V2', amount: '40' }
      ],
      identityOf,
      amountOf
    );
    const units = resolvePublishUnits(groups, new Map([['V1', 'consolidated_by_seller']]));
    const v1Units = units.filter((u) => u.group.sellerCode === 'V1');
    const v2Units = units.filter((u) => u.group.sellerCode === 'V2');
    expect(v1Units).toHaveLength(1);
    expect(v1Units[0].groupingMode).toBe('consolidated_by_seller');
    expect(v2Units).toHaveLength(2);
    expect(v2Units.every((u) => u.groupingMode === 'separate_by_branch')).toBe(true);
  });

  it('varios vendedores multi-filial consolidados ao mesmo tempo - cada um vira sua propria unidade', () => {
    const groups = groupRows(
      [
        { branchCode: '0103', sellerCode: 'V1', amount: '10' },
        { branchCode: '0104', sellerCode: 'V1', amount: '20' },
        { branchCode: '0104', sellerCode: 'V2', amount: '30' },
        { branchCode: '0105', sellerCode: 'V2', amount: '40' }
      ],
      identityOf,
      amountOf
    );
    const units = resolvePublishUnits(
      groups,
      new Map([
        ['V1', 'consolidated_by_seller'],
        ['V2', 'consolidated_by_seller']
      ])
    );
    expect(units).toHaveLength(2);
    expect(units.every(isConsolidatedUnit)).toBe(true);
  });

  it('nunca deduplica linhas iguais mesmo apos consolidar por vendedor', () => {
    const groups = groupRows(
      [
        { branchCode: '0103', sellerCode: 'V1', amount: '10' },
        { branchCode: '0103', sellerCode: 'V1', amount: '10' },
        { branchCode: '0104', sellerCode: 'V1', amount: '10' }
      ],
      identityOf,
      amountOf
    );
    const units = resolvePublishUnits(groups, new Map([['V1', 'consolidated_by_seller']]));
    const [unit] = units;
    if (!isConsolidatedUnit(unit)) throw new Error('esperava unidade consolidada');
    expect(unit.group.rowCount).toBe(3);
    expect(unit.group.total.toString()).toBe('30');
  });

  it('isSeparateUnit e isConsolidatedUnit distinguem corretamente as unidades', () => {
    const groups = groupRows(
      [
        { branchCode: '0103', sellerCode: 'V1', amount: '10' },
        { branchCode: '0104', sellerCode: 'V1', amount: '20' }
      ],
      identityOf,
      amountOf
    );
    const [separateUnit] = resolvePublishUnits(groups, new Map());
    const [consolidatedUnit] = resolvePublishUnits(groups, new Map([['V1', 'consolidated_by_seller']]));
    expect(isSeparateUnit(separateUnit)).toBe(true);
    expect(isConsolidatedUnit(separateUnit)).toBe(false);
    expect(isSeparateUnit(consolidatedUnit)).toBe(false);
    expect(isConsolidatedUnit(consolidatedUnit)).toBe(true);
  });
});
