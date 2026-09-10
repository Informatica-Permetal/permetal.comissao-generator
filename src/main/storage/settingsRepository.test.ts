import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase } from './database';
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
    const db = openDatabase(dbPath);
    expect(isFirstRunComplete(db)).toBe(false);
    expect(getReportRoot(db)).toBeNull();
    db.close();
  });

  it('keeps the report root and first-run status after the app is closed and reopened', () => {
    const reportRoot = join(baseDir, 'Documentos com Espaco', 'Formatador Comissao');

    const firstSession = openDatabase(dbPath);
    persistFirstRunCompletion(firstSession, reportRoot);
    firstSession.close();

    // simulate the app being restarted: open a brand new DatabaseSync over the same file
    const secondSession = openDatabase(dbPath);
    expect(isFirstRunComplete(secondSession)).toBe(true);
    expect(getReportRoot(secondSession)).toBe(reportRoot);
    secondSession.close();
  });
});
