import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODE_SUBFOLDERS, REPORT_MODES } from '@shared/constants/folders';
import type { FolderPermissionResult } from '@shared/types/settings';

export function buildFolderTree(root: string): string[] {
  return REPORT_MODES.flatMap((mode) =>
    MODE_SUBFOLDERS.map((subfolder) => join(root, mode, subfolder))
  );
}

export function testFolderPermissions(root: string): FolderPermissionResult {
  try {
    mkdirSync(root, { recursive: true });
    const probeDir = join(root, `.fc-permission-check-${Date.now()}`);
    mkdirSync(probeDir, { recursive: true });
    writeFileSync(join(probeDir, 'probe.tmp'), 'formatador-comissao-permission-check');
    rmSync(probeDir, { recursive: true, force: true });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: describePermissionError(error) };
  }
}

export function createFolderTree(root: string): void {
  for (const folder of buildFolderTree(root)) {
    mkdirSync(folder, { recursive: true });
  }
}

function describePermissionError(error: unknown): string {
  const code = (error as NodeJS.ErrnoException).code;
  switch (code) {
    case 'EACCES':
    case 'EPERM':
      return 'Sem permissao para criar, gravar ou excluir arquivos nesta pasta.';
    case 'ENOSPC':
      return 'Espaco em disco insuficiente nesta pasta.';
    case 'EROFS':
      return 'Esta pasta esta em um volume somente leitura.';
    default:
      return error instanceof Error ? error.message : 'Falha desconhecida ao testar a pasta.';
  }
}
