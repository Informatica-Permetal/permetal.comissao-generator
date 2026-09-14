import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../storage/database';
import { getCompanyProfile, upsertCompanyProfile } from './companyProfileRepository';
import { seedDefaultCompanyProfiles } from './seedCompanyProfiles';

const REPO_ROOT = join(__dirname, '..', '..', '..');

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
  it('semeia as 4 filiais observadas com a marca/logo correta', () => {
    seedDefaultCompanyProfiles(db, REPO_ROOT, logosDir);

    const permetalSp = getCompanyProfile(db, '0103');
    const permetalCravinhos = getCompanyProfile(db, '0104');
    const metalgrade = getCompanyProfile(db, '0105');
    const mg = getCompanyProfile(db, '0106');

    expect(permetalSp?.displayName).toBe('PERMETAL SAO PAULO');
    expect(permetalCravinhos?.displayName).toBe('PERMETAL CRAVINHOS');
    expect(metalgrade?.displayName).toBe('METALGRADE NOVA');
    expect(mg?.displayName).toBe('MG');

    // 0103 e 0104 sao a mesma marca (Permetal) - devem compartilhar o mesmo arquivo de logo.
    expect(permetalSp?.logoPath).toBe(permetalCravinhos?.logoPath);
    expect(permetalSp?.logoPath).not.toBe(metalgrade?.logoPath);
    expect(existsSync(permetalSp?.logoPath as string)).toBe(true);
    expect(existsSync(metalgrade?.logoPath as string)).toBe(true);
    expect(existsSync(mg?.logoPath as string)).toBe(true);
  });

  it('nunca sobrescreve edicoes do usuario em uma filial ja cadastrada', () => {
    upsertCompanyProfile(db, {
      branchCode: '0103',
      displayName: 'Nome editado pelo usuario',
      cnpj: '11.111.111/0001-11'
    });

    seedDefaultCompanyProfiles(db, REPO_ROOT, logosDir);

    const profile = getCompanyProfile(db, '0103');
    expect(profile?.displayName).toBe('Nome editado pelo usuario');
    expect(profile?.cnpj).toBe('11.111.111/0001-11');
  });

  it('e idempotente - rodar duas vezes nao duplica nem falha', () => {
    seedDefaultCompanyProfiles(db, REPO_ROOT, logosDir);
    expect(() => seedDefaultCompanyProfiles(db, REPO_ROOT, logosDir)).not.toThrow();
  });
});
