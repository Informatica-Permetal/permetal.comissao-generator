import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeReportRootManifestIfMissing } from './app/dataOwnership';
import { openTestDatabase } from './storage/testDatabase';
import { persistFirstRunCompletion } from './storage/settingsRepository';
import { parseUninstallCliArgs, runUninstallCli } from './uninstallCli';

describe('parseUninstallCliArgs', () => {
  it('retorna null quando nenhuma flag de desinstalacao esta presente - fluxo normal do app', () => {
    expect(parseUninstallCliArgs(['/path/to/exe'])).toBeNull();
    expect(parseUninstallCliArgs([])).toBeNull();
  });

  it('reconhece o modo de checagem de caminhos', () => {
    expect(parseUninstallCliArgs(['--uninstall-check-paths', '--uninstall-out=C:\\temp\\out.txt'])).toEqual({
      mode: 'check',
      outPath: 'C:\\temp\\out.txt'
    });
  });

  it('reconhece o modo de exclusao', () => {
    expect(parseUninstallCliArgs(['--uninstall-delete-data', '--uninstall-out=C:\\temp\\out.txt'])).toEqual({
      mode: 'delete',
      outPath: 'C:\\temp\\out.txt'
    });
  });

  it('retorna null se a flag de modo estiver presente mas faltar o caminho de saida', () => {
    expect(parseUninstallCliArgs(['--uninstall-check-paths'])).toBeNull();
  });
});

describe('runUninstallCli', () => {
  const APP_ID = 'com.formatadorcomissao.app';
  let baseDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'fc-uninstall-cli-'));
  });
  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  function fakeSpecial() {
    return {
      home: join(baseDir, 'special-home'),
      documents: join(baseDir, 'special-documents'),
      desktop: join(baseDir, 'special-desktop'),
      downloads: join(baseDir, 'special-downloads')
    };
  }

  it('modo "check": escreve os caminhos reais sem apagar nada', () => {
    const dbPath = join(baseDir, 'AppData', 'Formatador Comissão.db');
    const db = openTestDatabase(dbPath);
    const reportRoot = join(baseDir, 'Formatador Comissão');
    mkdirSync(join(reportRoot, 'Previsão'), { recursive: true });
    writeReportRootManifestIfMissing(reportRoot, APP_ID, ['Previsão', 'Relação']);
    persistFirstRunCompletion(db, reportRoot);

    const outPath = join(baseDir, 'check-result.txt');
    runUninstallCli(
      { mode: 'check', outPath },
      {
        db,
        paths: { userDataPath: join(baseDir, 'AppData'), logDir: '', databasePath: dbPath, sessionDataPath: join(baseDir, 'AppData') },
        special: fakeSpecial()
      }
    );
    db.close();

    const lines = readFileSync(outPath, 'utf16le').split('\r\n');
    expect(lines.some((line) => line.includes('Previsão'))).toBe(true);
    expect(existsSync(join(reportRoot, 'Previsão'))).toBe(true); // "check" never deletes
  });

  it('modo "delete": realmente remove os dados do report root e do appData', () => {
    const appDataPath = join(baseDir, 'AppData');
    const dbPath = join(appDataPath, 'Formatador Comissão.db');
    const db = openTestDatabase(dbPath);
    const reportRoot = join(baseDir, 'Formatador Comissão');
    mkdirSync(join(reportRoot, 'Previsão'), { recursive: true });
    writeReportRootManifestIfMissing(reportRoot, APP_ID, ['Previsão', 'Relação']);
    persistFirstRunCompletion(db, reportRoot);

    const outPath = join(baseDir, 'delete-result.txt');
    runUninstallCli(
      { mode: 'delete', outPath },
      { db, paths: { userDataPath: appDataPath, logDir: '', databasePath: dbPath, sessionDataPath: appDataPath }, special: fakeSpecial() }
    );
    // runUninstallCli itself closes the db before deleting (the file lives inside appDataPath).

    expect(existsSync(join(reportRoot, 'Previsão'))).toBe(false);
    expect(existsSync(appDataPath)).toBe(false);

    const lines = readFileSync(outPath, 'utf16le').split('\r\n');
    expect(lines[0]).toBe('OK');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('modo "delete" sem report root configurado: apaga so o appData, sem erro', () => {
    const appDataPath = join(baseDir, 'AppData');
    const dbPath = join(appDataPath, 'Formatador Comissão.db');
    const db = openTestDatabase(dbPath);

    const outPath = join(baseDir, 'delete-result.txt');
    runUninstallCli(
      { mode: 'delete', outPath },
      { db, paths: { userDataPath: appDataPath, logDir: '', databasePath: dbPath, sessionDataPath: appDataPath }, special: fakeSpecial() }
    );

    expect(existsSync(appDataPath)).toBe(false);
    expect(readFileSync(outPath, 'utf16le').split('\r\n')[0]).toBe('OK');
  });
});
