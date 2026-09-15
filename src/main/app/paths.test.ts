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

  it('places all internal data under %LOCALAPPDATA%\\Formatador Comissão', () => {
    const paths = resolveAppDataPaths();
    expect(paths.userDataPath).toBe(join('C:\\Users\\Maria Da Silva\\AppData\\Local', 'Formatador Comissão'));
    expect(paths.logDir).toBe(join(paths.userDataPath, 'logs'));
    expect(paths.databasePath).toBe(join(paths.userDataPath, 'Formatador Comissão.db'));
  });
});

describe('resolveSuggestedReportRoot', () => {
  it('suggests <Documents>/Formatador Comissão', () => {
    const documents = 'C:\\Users\\Maria Da Silva\\Documents';
    expect(resolveSuggestedReportRoot(documents)).toBe(join(documents, 'Formatador Comissão'));
  });
});
