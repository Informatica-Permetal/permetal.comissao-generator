import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../storage/database';
import {
  getCompanyProfile,
  listCompanyProfiles,
  setCompanyProfileLogo,
  upsertCompanyProfile
} from './companyProfileRepository';

let dir: string;
let db: DatabaseSync;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-companies-'));
  db = openDatabase(join(dir, 'test.db'));
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
});
