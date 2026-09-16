import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../storage/database';
import { getCompanyGroup } from './companyGroupRepository';
import { getCompanyProfile, upsertCompanyProfile } from './companyProfileRepository';
import { seedDefaultCompanyProfiles } from './seedCompanyProfiles';

const BRAND_LOGOS_DIR = join(__dirname, '..', '..', '..', 'resources', 'brand-logos');
const ALL_BRANCH_CODES = ['0101', '0103', '0104', '0105', '0106', '0503', '0504'];

let dir: string;
let db: DatabaseSync;
let logosDir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'fc-seed-'));
  db = openDatabase(join(dir, 'test.db'));
  logosDir = join(dir, 'logos');
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('seedDefaultCompanyProfiles', () => {
  it('semeia as 7 filiais dos grupos Permetal e Tres-S com a marca/logo correta', () => {
    seedDefaultCompanyProfiles(db, BRAND_LOGOS_DIR, logosDir);

    for (const branchCode of ALL_BRANCH_CODES) {
      expect(getCompanyProfile(db, branchCode)).not.toBeNull();
    }

    const permetal = getCompanyProfile(db, '0101');
    const permetalSp = getCompanyProfile(db, '0103');
    const permetalCravinhos = getCompanyProfile(db, '0104');
    const metalgrade = getCompanyProfile(db, '0105');
    const mg = getCompanyProfile(db, '0106');
    const tresSFilial = getCompanyProfile(db, '0503');
    const tresSMatriz = getCompanyProfile(db, '0504');

    expect(permetal?.displayName).toBe('PERMETAL');
    expect(permetalSp?.displayName).toBe('PERMETAL SÃO PAULO');
    expect(permetalCravinhos?.displayName).toBe('PERMETAL CRAVINHOS');
    expect(metalgrade?.displayName).toBe('METALGRADE NOVA');
    expect(mg?.displayName).toBe('MGZINC GALVANIZAÇÃO');
    expect(tresSFilial?.displayName).toBe('TRÊS-S FILIAL');
    expect(tresSMatriz?.displayName).toBe('TRÊS-S MATRIZ DISCO');

    // Todas as filiais Permetal compartilham o mesmo grupo e razao social.
    for (const profile of [permetal, permetalSp, permetalCravinhos, metalgrade, mg]) {
      expect(profile?.groupKey).toBe('PERMETAL');
      expect(profile?.legalName).toBe('Permetal S A Metais Perfurados');
    }
    for (const profile of [tresSFilial, tresSMatriz]) {
      expect(profile?.groupKey).toBe('TRES_S');
      expect(profile?.legalName).toBe('Tres S Ferramentas de Precisao LTDA');
    }

    // CNPJs reais informados pelo usuario, nunca inventados.
    expect(permetal?.cnpj).toBe('61.139.192/0001-06');
    expect(permetalSp?.cnpj).toBe('61.139.192/0003-78');
    expect(permetalCravinhos?.cnpj).toBe('61.139.192/0004-59');
    expect(metalgrade?.cnpj).toBe('61.139.192/0005-30');
    expect(mg?.cnpj).toBe('61.139.192/0006-10');
    expect(tresSFilial?.cnpj).toBe('62.439.294/0003-71');
    expect(tresSMatriz?.cnpj).toBe('62.439.294/0004-52');

    // 0101, 0103 e 0104 sao a mesma marca (Permetal) - devem compartilhar o mesmo arquivo de logo.
    expect(permetal?.logoPath).toBe(permetalSp?.logoPath);
    expect(permetal?.logoPath).toBe(permetalCravinhos?.logoPath);
    expect(permetal?.logoPath).not.toBe(metalgrade?.logoPath);
    expect(tresSFilial?.logoPath).toBe(tresSMatriz?.logoPath);
    expect(existsSync(permetal?.logoPath as string)).toBe(true);
    expect(existsSync(metalgrade?.logoPath as string)).toBe(true);
    expect(existsSync(mg?.logoPath as string)).toBe(true);
    expect(existsSync(tresSFilial?.logoPath as string)).toBe(true);
  });

  it('semeia os grupos corporativos Permetal e Tres-S com os dados da matriz', () => {
    seedDefaultCompanyProfiles(db, BRAND_LOGOS_DIR, logosDir);

    const permetalGroup = getCompanyGroup(db, 'PERMETAL');
    expect(permetalGroup?.headquartersBranchCode).toBe('0104');
    expect(permetalGroup?.headquartersCnpj).toBe('61.139.192/0004-59');
    expect(permetalGroup?.headquartersAddress?.cidade).toBe('Cravinhos');

    const tresSGroup = getCompanyGroup(db, 'TRES_S');
    expect(tresSGroup?.headquartersBranchCode).toBe('0504');
    expect(tresSGroup?.headquartersCnpj).toBe('62.439.294/0004-52');
  });

  it('nunca sobrescreve edicoes do usuario em uma filial ja cadastrada', () => {
    upsertCompanyProfile(db, {
      branchCode: '0103',
      displayName: 'Nome editado pelo usuario',
      cnpj: '11.111.111/0001-11'
    });

    seedDefaultCompanyProfiles(db, BRAND_LOGOS_DIR, logosDir);

    const profile = getCompanyProfile(db, '0103');
    expect(profile?.displayName).toBe('Nome editado pelo usuario');
    expect(profile?.cnpj).toBe('11.111.111/0001-11');
  });

  it('preenche apenas os campos vazios de uma filial ja existente, sem apagar customizacoes', () => {
    // Uma instalacao existente do app ja tinha 0106 cadastrada (fase anterior),
    // mas somente com o nome de exibicao - sem CNPJ, endereco ou grupo ainda.
    upsertCompanyProfile(db, { branchCode: '0106', displayName: 'MG' });

    seedDefaultCompanyProfiles(db, BRAND_LOGOS_DIR, logosDir);

    const profile = getCompanyProfile(db, '0106');
    // O nome de exibicao customizado (mesmo que so seja o antigo default) permanece.
    expect(profile?.displayName).toBe('MG');
    // Os campos vazios agora sao preenchidos com os dados reais do cadastro.
    expect(profile?.cnpj).toBe('61.139.192/0006-10');
    expect(profile?.legalName).toBe('Permetal S A Metais Perfurados');
    expect(profile?.groupKey).toBe('PERMETAL');
    expect(profile?.address?.cidade).toBe('Cravinhos');
  });

  it('e idempotente - rodar duas vezes nao duplica nem falha', () => {
    seedDefaultCompanyProfiles(db, BRAND_LOGOS_DIR, logosDir);
    expect(() => seedDefaultCompanyProfiles(db, BRAND_LOGOS_DIR, logosDir)).not.toThrow();

    seedDefaultCompanyProfiles(db, BRAND_LOGOS_DIR, logosDir);
    const permetal = getCompanyProfile(db, '0104');
    expect(permetal?.cnpj).toBe('61.139.192/0004-59');
  });
});
