import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openTestDatabase } from '../storage/testDatabase';
import { upsertCompanyGroup } from './companyGroupRepository';
import {
  deleteCompanyProfileRecord,
  fillEmptyCompanyProfileFields,
  getCompanyProfile,
  listCompanyProfiles,
  setCompanyProfileActive,
  setCompanyProfileLogo,
  upsertCompanyProfile
} from './companyProfileRepository';

let dir: string;
let db: DatabaseSync;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-companies-'));
  db = openTestDatabase(join(dir, 'test.db'));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('companyProfileRepository', () => {
  it('retorna null para uma filial nao cadastrada', () => {
    expect(getCompanyProfile(db, '9999')).toBeNull();
  });

  it('cria e le de volta um perfil somente com os campos fornecidos', () => {
    upsertCompanyProfile(db, { branchCode: '0103', displayName: 'PERMETAL SAO PAULO' });
    const profile = getCompanyProfile(db, '0103');
    expect(profile).not.toBeNull();
    expect(profile?.displayName).toBe('PERMETAL SAO PAULO');
    expect(profile?.legalName).toBeNull();
    expect(profile?.cnpj).toBeNull();
    expect(profile?.address).toBeNull();
    expect(profile?.active).toBe(true);
  });

  it('atualiza um perfil existente sem perder o logo ja configurado', () => {
    upsertCompanyProfile(db, { branchCode: '0103', displayName: 'PERMETAL SAO PAULO' });
    setCompanyProfileLogo(db, '0103', '/caminho/para/logo.png');

    upsertCompanyProfile(db, {
      branchCode: '0103',
      displayName: 'PERMETAL SAO PAULO',
      cnpj: '12.345.678/0001-90',
      address: { cidade: 'Sao Paulo', uf: 'SP' }
    });

    const profile = getCompanyProfile(db, '0103');
    expect(profile?.cnpj).toBe('12.345.678/0001-90');
    expect(profile?.address).toEqual({ cidade: 'Sao Paulo', uf: 'SP' });
    expect(profile?.logoPath).toBe('/caminho/para/logo.png');
  });

  it('lista perfis ordenados por codigo de filial', () => {
    upsertCompanyProfile(db, { branchCode: '0106', displayName: 'MG' });
    upsertCompanyProfile(db, { branchCode: '0103', displayName: 'PERMETAL SAO PAULO' });
    const codes = listCompanyProfiles(db).map((p) => p.branchCode);
    expect(codes).toEqual(['0103', '0106']);
  });

  it('persiste o group_key de um perfil', () => {
    upsertCompanyGroup(db, { groupKey: 'PERMETAL', displayName: 'Permetal S.A.' });
    upsertCompanyProfile(db, { branchCode: '0104', displayName: 'PERMETAL CRAVINHOS', groupKey: 'PERMETAL' });
    expect(getCompanyProfile(db, '0104')?.groupKey).toBe('PERMETAL');
  });

  it('ativa e desativa um perfil sem alterar os demais campos', () => {
    upsertCompanyProfile(db, { branchCode: '0103', displayName: 'PERMETAL SAO PAULO', cnpj: '12.345.678/0001-90' });

    setCompanyProfileActive(db, '0103', false);
    let profile = getCompanyProfile(db, '0103');
    expect(profile?.active).toBe(false);
    expect(profile?.cnpj).toBe('12.345.678/0001-90');

    setCompanyProfileActive(db, '0103', true);
    profile = getCompanyProfile(db, '0103');
    expect(profile?.active).toBe(true);
  });

  it('remove um perfil pelo codigo de filial', () => {
    upsertCompanyProfile(db, { branchCode: '0103', displayName: 'PERMETAL SAO PAULO' });
    deleteCompanyProfileRecord(db, '0103');
    expect(getCompanyProfile(db, '0103')).toBeNull();
  });

  describe('fillEmptyCompanyProfileFields', () => {
    it('cria o perfil quando a filial ainda nao existe', () => {
      fillEmptyCompanyProfileFields(db, { branchCode: '0101', displayName: 'PERMETAL', cnpj: '61.139.192/0001-06' });
      const profile = getCompanyProfile(db, '0101');
      expect(profile?.displayName).toBe('PERMETAL');
      expect(profile?.cnpj).toBe('61.139.192/0001-06');
    });

    it('nunca sobrescreve um campo ja preenchido pelo usuario', () => {
      upsertCompanyProfile(db, {
        branchCode: '0103',
        displayName: 'Nome editado pelo usuario',
        cnpj: '11.111.111/0001-11'
      });

      fillEmptyCompanyProfileFields(db, {
        branchCode: '0103',
        displayName: 'PERMETAL SÃO PAULO',
        cnpj: '61.139.192/0003-78',
        legalName: 'Permetal S A Metais Perfurados'
      });

      const profile = getCompanyProfile(db, '0103');
      expect(profile?.displayName).toBe('Nome editado pelo usuario');
      expect(profile?.cnpj).toBe('11.111.111/0001-11');
      // legalName estava vazio - deve ser preenchido normalmente.
      expect(profile?.legalName).toBe('Permetal S A Metais Perfurados');
    });

    it('preenche apenas os campos vazios dentro do endereco, campo a campo', () => {
      upsertCompanyProfile(db, {
        branchCode: '0105',
        displayName: 'METALGRADE NOVA',
        address: { cidade: 'Cidade editada pelo usuario' }
      });

      fillEmptyCompanyProfileFields(db, {
        branchCode: '0105',
        displayName: 'METALGRADE NOVA',
        address: { endereco: 'Rodovia Anhanguera', bairro: 'Parque Industrial', cidade: 'Cravinhos', uf: 'SP', cep: '14140-000' }
      });

      const profile = getCompanyProfile(db, '0105');
      expect(profile?.address).toEqual({
        endereco: 'Rodovia Anhanguera',
        bairro: 'Parque Industrial',
        cidade: 'Cidade editada pelo usuario',
        uf: 'SP',
        cep: '14140-000'
      });
    });

    it('nao altera o status ativo/inativo existente', () => {
      upsertCompanyProfile(db, { branchCode: '0103', displayName: 'PERMETAL SAO PAULO', active: false });
      fillEmptyCompanyProfileFields(db, { branchCode: '0103', displayName: 'PERMETAL SAO PAULO', active: true });
      expect(getCompanyProfile(db, '0103')?.active).toBe(false);
    });

    it('e idempotente - rodar duas vezes produz o mesmo resultado', () => {
      const seed = { branchCode: '0101', displayName: 'PERMETAL', cnpj: '61.139.192/0001-06' };
      fillEmptyCompanyProfileFields(db, seed);
      fillEmptyCompanyProfileFields(db, seed);
      expect(getCompanyProfile(db, '0101')?.cnpj).toBe('61.139.192/0001-06');
    });
  });
});
