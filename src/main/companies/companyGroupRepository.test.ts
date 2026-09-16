import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../storage/database';
import { fillEmptyCompanyGroupFields, getCompanyGroup, listCompanyGroups, upsertCompanyGroup } from './companyGroupRepository';

let dir: string;
let db: DatabaseSync;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-groups-'));
  db = openDatabase(join(dir, 'test.db'));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('companyGroupRepository', () => {
  it('retorna null para um grupo nao cadastrado', () => {
    expect(getCompanyGroup(db, 'INEXISTENTE')).toBeNull();
  });

  it('cria e le de volta um grupo', () => {
    upsertCompanyGroup(db, {
      groupKey: 'PERMETAL',
      displayName: 'Permetal S.A. Metais Perfurados',
      legalName: 'Permetal S A Metais Perfurados',
      headquartersBranchCode: '0104',
      headquartersCnpj: '61.139.192/0004-59',
      headquartersAddress: { endereco: 'Rodovia Anhanguera', bairro: 'Parque Industrial', cidade: 'Cravinhos', uf: 'SP', cep: '14140-000' }
    });

    const group = getCompanyGroup(db, 'PERMETAL');
    expect(group?.displayName).toBe('Permetal S.A. Metais Perfurados');
    expect(group?.headquartersBranchCode).toBe('0104');
    expect(group?.headquartersAddress).toEqual({
      endereco: 'Rodovia Anhanguera',
      bairro: 'Parque Industrial',
      cidade: 'Cravinhos',
      uf: 'SP',
      cep: '14140-000'
    });
  });

  it('lista grupos ordenados por group_key', () => {
    upsertCompanyGroup(db, { groupKey: 'TRES_S', displayName: 'Três-S' });
    upsertCompanyGroup(db, { groupKey: 'PERMETAL', displayName: 'Permetal' });
    expect(listCompanyGroups(db).map((g) => g.groupKey)).toEqual(['PERMETAL', 'TRES_S']);
  });

  describe('fillEmptyCompanyGroupFields', () => {
    it('cria o grupo quando ele ainda nao existe', () => {
      fillEmptyCompanyGroupFields(db, { groupKey: 'PERMETAL', displayName: 'Permetal S.A.' });
      expect(getCompanyGroup(db, 'PERMETAL')?.displayName).toBe('Permetal S.A.');
    });

    it('nunca sobrescreve um campo ja preenchido', () => {
      upsertCompanyGroup(db, { groupKey: 'PERMETAL', displayName: 'Nome editado pelo usuario' });
      fillEmptyCompanyGroupFields(db, { groupKey: 'PERMETAL', displayName: 'Permetal S.A. Metais Perfurados' });
      expect(getCompanyGroup(db, 'PERMETAL')?.displayName).toBe('Nome editado pelo usuario');
    });

    it('preenche apenas os campos vazios de um grupo ja existente', () => {
      upsertCompanyGroup(db, { groupKey: 'PERMETAL', displayName: 'Permetal S.A.' });
      fillEmptyCompanyGroupFields(db, {
        groupKey: 'PERMETAL',
        displayName: 'Outro nome',
        legalName: 'Permetal S A Metais Perfurados',
        headquartersBranchCode: '0104'
      });

      const group = getCompanyGroup(db, 'PERMETAL');
      expect(group?.displayName).toBe('Permetal S.A.');
      expect(group?.legalName).toBe('Permetal S A Metais Perfurados');
      expect(group?.headquartersBranchCode).toBe('0104');
    });
  });
});
