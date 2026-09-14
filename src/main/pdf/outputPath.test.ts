import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPdfFileName, resolveGeradosDir, resolveUniqueOutputPath, sanitizeFilenamePart } from './outputPath';

describe('sanitizeFilenamePart', () => {
  it('remove caracteres ilegais no Windows e troca espacos por underscore', () => {
    expect(sanitizeFilenamePart('ADEMIR / FURLANETO: "Teste"?')).toBe('ADEMIR_FURLANETO_Teste');
  });
});

describe('buildPdfFileName', () => {
  it('monta um nome legivel e deterministico', () => {
    const name = buildPdfFileName('Relacao', new Date(Date.UTC(2026, 8, 10)), '0104', '000001', 'Ademir Furlaneto');
    expect(name).toBe('2026-09-10_RELACAO_0104_000001_ADEMIR_FURLANETO.pdf');
  });
});

describe('resolveGeradosDir', () => {
  it('aponta para <raiz>/<modo>/Gerados', () => {
    expect(resolveGeradosDir('C:\\Raiz', 'Previsao')).toBe(join('C:\\Raiz', 'Previsao', 'Gerados'));
  });
});

describe('resolveUniqueOutputPath', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fc-output-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('usa o nome original quando nao ha colisao', () => {
    const path = resolveUniqueOutputPath(dir, 'arquivo.pdf');
    expect(path).toBe(join(dir, 'arquivo.pdf'));
  });

  it('nunca sobrescreve - adiciona sufixo numerico em caso de colisao', () => {
    writeFileSync(join(dir, 'arquivo.pdf'), 'existente');
    const path1 = resolveUniqueOutputPath(dir, 'arquivo.pdf');
    expect(path1).toBe(join(dir, 'arquivo_2.pdf'));

    writeFileSync(path1, 'tambem existente');
    const path2 = resolveUniqueOutputPath(dir, 'arquivo.pdf');
    expect(path2).toBe(join(dir, 'arquivo_3.pdf'));

    expect(existsSync(join(dir, 'arquivo.pdf'))).toBe(true);
  });
});
