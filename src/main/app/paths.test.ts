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

  it('places all internal data under %LOCALAPPDATA%\\Formatador Comissao', () => {
    const paths = resolveAppDataPaths();
    expect(paths.userDataPath).toBe(join('C:\\Users\\Maria Da Silva\\AppData\\Local', 'Formatador Comissao'));
    expect(paths.logDir).toBe(join(paths.userDataPath, 'logs'));
    expect(paths.databasePath).toBe(join(paths.userDataPath, 'Formatador Comissao.db'));
  });
});

describe('resolveSuggestedReportRoot', () => {
  it('suggests <Documents>/Formatador Comissao', () => {
    const documents = 'C:\\Users\\Maria Da Silva\\Documents';
    expect(resolveSuggestedReportRoot(documents)).toBe(join(documents, 'Formatador Comissao'));
  });
});
