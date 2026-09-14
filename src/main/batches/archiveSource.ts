import { copyFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { ReportMode } from '@shared/constants/folders';
import { resolveProcessadosDir } from './archivePaths';

/**
 * Copies the already-validated workspace file into the permanent
 * `Processados/YYYY/MM/<batchId>/` archive. Copies rather than moves so the
 * Processamento workspace still holds a fallback copy until the whole batch
 * is confirmed successful and the workspace is cleaned up.
 */
export function archiveSourceFile(
  reportRoot: string,
  mode: ReportMode,
  generatedAt: Date,
  batchId: string,
  workspaceFilePath: string
): string {
  const dir = resolveProcessadosDir(reportRoot, mode, generatedAt, batchId);
  mkdirSync(dir, { recursive: true });
  const targetPath = join(dir, basename(workspaceFilePath));
  copyFileSync(workspaceFilePath, targetPath);
  return targetPath;
}
