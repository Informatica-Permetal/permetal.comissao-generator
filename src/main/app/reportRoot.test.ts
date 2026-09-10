import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildFolderTree, createFolderTree, testFolderPermissions } from './reportRoot';

describe('buildFolderTree', () => {
  it('lists all 10 Previsao/Relacao subfolders', () => {
    const tree = buildFolderTree('C:\\Raiz');
    expect(tree).toHaveLength(10);
    expect(tree).toContain(join('C:\\Raiz', 'Previsao', 'Entrada'));
    expect(tree).toContain(join('C:\\Raiz', 'Relacao', 'Historico'));
  });
});

describe('testFolderPermissions and createFolderTree', () => {
  let baseDir: string;
  let rootWithSpaces: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), 'fc-report-root-'));
    rootWithSpaces = join(baseDir, 'Formatador Comissao - Pasta de Testes');
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
  });

  it('reports ok for a writable path containing spaces', () => {
    const result = testFolderPermissions(rootWithSpaces);
    expect(result).toEqual({ ok: true });
    expect(existsSync(rootWithSpaces)).toBe(true);
  });

  it('creates the full Previsao/Relacao tree under a path with spaces', () => {
    createFolderTree(rootWithSpaces);
    for (const folder of buildFolderTree(rootWithSpaces)) {
      expect(existsSync(folder)).toBe(true);
    }
  });

  it('is idempotent: running twice does not remove existing files', () => {
    createFolderTree(rootWithSpaces);
    const markerFile = join(rootWithSpaces, 'Previsao', 'Entrada', 'nao-remover.txt');
    writeFileSync(markerFile, 'dado do usuario');

    createFolderTree(rootWithSpaces);

    expect(existsSync(markerFile)).toBe(true);
    expect(readdirSync(join(rootWithSpaces, 'Previsao', 'Entrada'))).toContain('nao-remover.txt');
  });
});
