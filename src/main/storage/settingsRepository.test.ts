import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openTestDatabase } from './testDatabase';
import { getReportRoot, isFirstRunComplete, persistFirstRunCompletion } from './settingsRepository';

describe('settings persistence across a simulated restart', () => {
  let baseDir: string;
  let dbPath: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'fc-settings-'));
    dbPath = join(baseDir, 'formatador-comissao.db');
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('is not first-run-complete on a brand new database', () => {
    const db = openTestDatabase(dbPath);
    expect(isFirstRunComplete(db)).toBe(false);
    expect(getReportRoot(db)).toBeNull();
    db.close();
  });

  it('keeps the report root and first-run status after the app is closed and reopened', () => {
    const reportRoot = join(baseDir, 'Documentos com Espaco', 'Formatador Comissao');

    const firstSession = openTestDatabase(dbPath);
    persistFirstRunCompletion(firstSession, reportRoot);
    firstSession.close();

    // simulate the app being restarted: open a brand new DatabaseSync over the same file
    const secondSession = openTestDatabase(dbPath);
    expect(isFirstRunComplete(secondSession)).toBe(true);
    expect(getReportRoot(secondSession)).toBe(reportRoot);
    secondSession.close();
  });
});

describe('report root isolation across execution profiles', () => {
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'fc-settings-profiles-'));
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('never leaks a persisted report root between two separate profile databases', () => {
    const devDbPath = join(baseDir, 'Formatador Comissão Dev', 'Formatador Comissão Dev.db');
    const homologDbPath = join(baseDir, 'Formatador Comissão Homologação', 'Formatador Comissão Homologação.db');

    const devReportRoot = join(baseDir, 'Documentos', 'Formatador Comissão Dev');
    const homologReportRoot = join(baseDir, 'Documentos', 'Formatador Comissão Homologação');
    const productionStyleReportRoot = join(baseDir, 'Documentos', 'Formatador Comissão');

    const devDb = openTestDatabase(devDbPath);
    persistFirstRunCompletion(devDb, devReportRoot);

    const homologDb = openTestDatabase(homologDbPath);
    persistFirstRunCompletion(homologDb, homologReportRoot);

    expect(getReportRoot(devDb)).toBe(devReportRoot);
    expect(getReportRoot(homologDb)).toBe(homologReportRoot);
    expect(getReportRoot(devDb)).not.toBe(getReportRoot(homologDb));

    // Neither non-production profile's persisted report root ever equals PRODUCTION's own naming.
    expect(getReportRoot(devDb)).not.toBe(productionStyleReportRoot);
    expect(getReportRoot(homologDb)).not.toBe(productionStyleReportRoot);

    devDb.close();
    homologDb.close();
  });

  it("a fresh profile database never reflects another profile's already-completed first run", () => {
    const homologDbPath = join(baseDir, 'Formatador Comissão Homologação', 'Formatador Comissão Homologação.db');
    const homologDb = openTestDatabase(homologDbPath);
    persistFirstRunCompletion(homologDb, join(baseDir, 'Documentos', 'Formatador Comissão Homologação'));
    homologDb.close();

    // A different profile's database file was never touched by the write above - it must start from scratch.
    const devDbPath = join(baseDir, 'Formatador Comissão Dev', 'Formatador Comissão Dev.db');
    const devDb = openTestDatabase(devDbPath);
    expect(isFirstRunComplete(devDb)).toBe(false);
    expect(getReportRoot(devDb)).toBeNull();
    devDb.close();
  });
});
