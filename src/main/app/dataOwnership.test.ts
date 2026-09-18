import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readReportRootManifest, REPORT_ROOT_MANIFEST_FILENAME, writeReportRootManifestIfMissing } from './dataOwnership';

const APP_ID = 'com.formatadorcomissao.app';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'fc-data-ownership-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('writeReportRootManifestIfMissing / readReportRootManifest', () => {
  it('escreve um manifesto valido que pode ser lido de volta', () => {
    writeReportRootManifestIfMissing(root, APP_ID, ['Previsão', 'Relação']);

    const manifest = readReportRootManifest(root);
    expect(manifest).not.toBeNull();
    expect(manifest?.appId).toBe(APP_ID);
    expect(manifest?.schemaVersion).toBe(1);
    expect(manifest?.managedTopLevelNames).toEqual(['Previsão', 'Relação']);
    expect(existsSync(join(root, REPORT_ROOT_MANIFEST_FILENAME))).toBe(true);
  });

  it('e idempotente: nao sobrescreve um manifesto ja existente', () => {
    writeReportRootManifestIfMissing(root, APP_ID, ['Previsão', 'Relação']);
    const first = readReportRootManifest(root);

    writeReportRootManifestIfMissing(root, APP_ID, ['Previsão', 'Relação', 'ExtraPastaFutura']);
    const second = readReportRootManifest(root);

    expect(second?.createdAt).toBe(first?.createdAt);
    expect(second?.managedTopLevelNames).toEqual(['Previsão', 'Relação']);
  });

  it('retorna null quando nao ha manifesto', () => {
    expect(readReportRootManifest(root)).toBeNull();
  });

  it('retorna null para um JSON corrompido', () => {
    writeFileSync(join(root, REPORT_ROOT_MANIFEST_FILENAME), 'nao e json');
    expect(readReportRootManifest(root)).toBeNull();
  });

  it('retorna null para um JSON bem formado mas com formato invalido (schema errado)', () => {
    writeFileSync(join(root, REPORT_ROOT_MANIFEST_FILENAME), JSON.stringify({ foo: 'bar' }));
    expect(readReportRootManifest(root)).toBeNull();
  });

  it('retorna null quando a pasta nem existe', () => {
    const missing = join(root, 'nao-existe');
    expect(readReportRootManifest(missing)).toBeNull();
  });

  it('funciona mesmo se a pasta raiz ja tiver outros arquivos do usuario', () => {
    mkdirSync(join(root, 'Outra Pasta'));
    writeFileSync(join(root, 'documento.txt'), 'conteudo');

    writeReportRootManifestIfMissing(root, APP_ID, ['Previsão', 'Relação']);

    expect(readFileSync(join(root, 'documento.txt'), 'utf8')).toBe('conteudo');
    expect(readReportRootManifest(root)?.appId).toBe(APP_ID);
  });
});
