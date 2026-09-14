import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReportMode } from '@shared/constants/folders';
import { startEntradaWatchers, type EntradaWatcherHandle } from './entradaWatcher';

let reportRoot: string;
let handle: EntradaWatcherHandle | null = null;
let detections: { mode: ReportMode; filePath: string }[] = [];

function waitForDetections(count: number, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      if (detections.length >= count) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error(`Timed out waiting for ${count} detection(s)`));
      setTimeout(poll, 50);
    };
    poll();
  });
}

beforeEach(() => {
  reportRoot = mkdtempSync(join(tmpdir(), 'fc-watcher-'));
  mkdirSync(join(reportRoot, 'Previsao', 'Entrada'), { recursive: true });
  mkdirSync(join(reportRoot, 'Relacao', 'Entrada'), { recursive: true });
  detections = [];
});

afterEach(async () => {
  if (handle) await handle.close();
  handle = null;
  rmSync(reportRoot, { recursive: true, force: true });
});

describe('startEntradaWatchers', () => {
  it('detecta um .xlsx solto na pasta Entrada do modo correto', async () => {
    handle = startEntradaWatchers(reportRoot, (mode, filePath) => detections.push({ mode, filePath }));
    await new Promise((r) => setTimeout(r, 300)); // deixa o watcher terminar o scan inicial

    const target = join(reportRoot, 'Previsao', 'Entrada', 'previsao.xlsx');
    writeFileSync(target, 'conteudo sintetico, nao e um xlsx real');

    await waitForDetections(1);
    expect(detections).toHaveLength(1);
    expect(detections[0].mode).toBe('Previsao');
    expect(detections[0].filePath).toBe(target);
  }, 8000);

  it('roteia cada pasta Entrada para o seu proprio modo', async () => {
    handle = startEntradaWatchers(reportRoot, (mode, filePath) => detections.push({ mode, filePath }));
    await new Promise((r) => setTimeout(r, 300));

    writeFileSync(join(reportRoot, 'Previsao', 'Entrada', 'a.xlsx'), 'x');
    writeFileSync(join(reportRoot, 'Relacao', 'Entrada', 'b.xlsx'), 'x');

    await waitForDetections(2);
    const modes = detections.map((d) => d.mode).sort();
    expect(modes).toEqual(['Previsao', 'Relacao']);
  }, 8000);

  it('ignora arquivos temporarios do Excel (~$) e arquivos que nao sao .xlsx', async () => {
    handle = startEntradaWatchers(reportRoot, (mode, filePath) => detections.push({ mode, filePath }));
    await new Promise((r) => setTimeout(r, 300));

    writeFileSync(join(reportRoot, 'Previsao', 'Entrada', '~$previsao.xlsx'), 'lock file do excel');
    writeFileSync(join(reportRoot, 'Previsao', 'Entrada', 'notas.txt'), 'nao e planilha');
    const realFile = join(reportRoot, 'Previsao', 'Entrada', 'real.xlsx');
    writeFileSync(realFile, 'x');

    await waitForDetections(1);
    // da tempo para eventuais deteccoes indevidas aparecerem antes de checar
    await new Promise((r) => setTimeout(r, 500));
    expect(detections).toHaveLength(1);
    expect(detections[0].filePath).toBe(realFile);
  }, 8000);
});
