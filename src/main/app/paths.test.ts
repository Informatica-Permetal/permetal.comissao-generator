import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveAppDataPaths, resolveSuggestedReportRoot } from './paths';

describe('resolveAppDataPaths', () => {
  const originalLocalAppData = process.env.LOCALAPPDATA;

  beforeEach(() => {
    process.env.LOCALAPPDATA = 'C:\\Users\\Maria Da Silva\\AppData\\Local';
  });

  afterEach(() => {
    process.env.LOCALAPPDATA = originalLocalAppData;
  });

  it('places all internal data under %LOCALAPPDATA%\\Formatador Comissão when no profile is given (PRODUCTION default)', () => {
    const paths = resolveAppDataPaths();
    expect(paths.userDataPath).toBe(join('C:\\Users\\Maria Da Silva\\AppData\\Local', 'Formatador Comissão'));
    expect(paths.logDir).toBe(join(paths.userDataPath, 'logs'));
    expect(paths.databasePath).toBe(join(paths.userDataPath, 'Formatador Comissão.db'));
  });

  it('resolves the exact same paths for an explicit PRODUCTION profile as for no profile at all', () => {
    expect(resolveAppDataPaths('PRODUCTION')).toEqual(resolveAppDataPaths());
  });

  it('keeps DEV, HOMOLOGATION and PRODUCTION userData paths mutually distinct', () => {
    const production = resolveAppDataPaths('PRODUCTION');
    const dev = resolveAppDataPaths('DEV');
    const homologation = resolveAppDataPaths('HOMOLOGATION');

    expect(dev.userDataPath).not.toBe(production.userDataPath);
    expect(homologation.userDataPath).not.toBe(production.userDataPath);
    expect(dev.userDataPath).not.toBe(homologation.userDataPath);
  });

  it('keeps DEV, HOMOLOGATION and PRODUCTION database paths mutually distinct', () => {
    const production = resolveAppDataPaths('PRODUCTION');
    const dev = resolveAppDataPaths('DEV');
    const homologation = resolveAppDataPaths('HOMOLOGATION');

    expect(dev.databasePath).not.toBe(production.databasePath);
    expect(homologation.databasePath).not.toBe(production.databasePath);
    expect(dev.databasePath).not.toBe(homologation.databasePath);
  });

  it('keeps DEV and HOMOLOGATION session/cache paths isolated from PRODUCTION and from each other, nested under their own userData', () => {
    const production = resolveAppDataPaths('PRODUCTION');
    const dev = resolveAppDataPaths('DEV');
    const homologation = resolveAppDataPaths('HOMOLOGATION');

    expect(dev.sessionDataPath).toBe(dev.userDataPath);
    expect(homologation.sessionDataPath).toBe(homologation.userDataPath);
    expect(dev.sessionDataPath).not.toBe(production.sessionDataPath);
    expect(homologation.sessionDataPath).not.toBe(production.sessionDataPath);
    expect(dev.sessionDataPath).not.toBe(homologation.sessionDataPath);
  });

  it('keeps every DEV/HOMOLOGATION path nested inside %LOCALAPPDATA%, never outside it', () => {
    const dev = resolveAppDataPaths('DEV');
    const homologation = resolveAppDataPaths('HOMOLOGATION');
    const localAppData = 'C:\\Users\\Maria Da Silva\\AppData\\Local';

    expect(dev.userDataPath.startsWith(localAppData)).toBe(true);
    expect(homologation.userDataPath.startsWith(localAppData)).toBe(true);
  });
});

describe('resolveSuggestedReportRoot', () => {
  it('suggests <Documents>/Formatador Comissão when no profile is given (PRODUCTION default)', () => {
    const documents = 'C:\\Users\\Maria Da Silva\\Documents';
    expect(resolveSuggestedReportRoot(documents)).toBe(join(documents, 'Formatador Comissão'));
  });

  it('keeps DEV, HOMOLOGATION and PRODUCTION suggested report roots mutually distinct', () => {
    const documents = 'C:\\Users\\Maria Da Silva\\Documents';
    const production = resolveSuggestedReportRoot(documents, 'PRODUCTION');
    const dev = resolveSuggestedReportRoot(documents, 'DEV');
    const homologation = resolveSuggestedReportRoot(documents, 'HOMOLOGATION');

    expect(dev).not.toBe(production);
    expect(homologation).not.toBe(production);
    expect(dev).not.toBe(homologation);
  });
});
