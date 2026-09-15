import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmdirSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type MigrationWarning = (message: string, meta: Record<string, unknown>) => void;

/**
 * Moves a legacy file or directory tree into its new location, never
 * overwriting anything already at the destination and never deleting data
 * that could not be moved. Safe to call on every startup:
 *
 * - if `oldPath` does not exist, this is a no-op (already migrated, or a
 *   fresh install that never had the legacy name);
 * - if `newPath` does not exist yet, the whole item is renamed in one step
 *   (an atomic same-volume move for a directory, moving everything inside);
 * - if `newPath` already exists (a previous run partially migrated, or the
 *   two coexisted for some other reason), every item is merged in
 *   file-by-file, skipping (and reporting via `onWarning`) any name that
 *   already exists at the destination rather than overwriting it;
 * - after a merge, any legacy subdirectory left fully empty is removed;
 *   anything that still has unmoved (conflicting) content is left in place
 *   untouched, so nothing is ever silently lost.
 */
export function migrateFolderSafely(oldPath: string, newPath: string, onWarning: MigrationWarning): void {
  if (!existsSync(oldPath)) return;
  if (oldPath === newPath) return;

  if (!existsSync(newPath)) {
    mkdirSync(dirname(newPath), { recursive: true });
    try {
      renameSync(oldPath, newPath);
      return;
    } catch (error) {
      onWarning('migracao: rename direto falhou, tentando mesclar item a item', {
        oldPath,
        newPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  mergeIntoDestination(oldPath, newPath, onWarning);
  removeIfEmpty(oldPath);
}

function mergeIntoDestination(oldPath: string, newPath: string, onWarning: MigrationWarning): void {
  const oldStat = statSync(oldPath);

  if (!oldStat.isDirectory()) {
    if (existsSync(newPath)) {
      onWarning('migracao: colisao - destino ja existe, mantendo o arquivo atual e preservando a copia legada', {
        oldPath,
        newPath
      });
      return;
    }
    moveFile(oldPath, newPath, onWarning);
    return;
  }

  mkdirSync(newPath, { recursive: true });
  for (const entry of readdirSync(oldPath, { withFileTypes: true })) {
    const oldEntryPath = join(oldPath, entry.name);
    const newEntryPath = join(newPath, entry.name);

    if (entry.isDirectory()) {
      mergeIntoDestination(oldEntryPath, newEntryPath, onWarning);
      removeIfEmpty(oldEntryPath);
    } else if (existsSync(newEntryPath)) {
      onWarning('migracao: colisao - destino ja existe, mantendo o arquivo atual e preservando a copia legada', {
        oldPath: oldEntryPath,
        newPath: newEntryPath
      });
    } else {
      moveFile(oldEntryPath, newEntryPath, onWarning);
    }
  }
}

function moveFile(oldPath: string, newPath: string, onWarning: MigrationWarning): void {
  try {
    renameSync(oldPath, newPath);
  } catch {
    try {
      copyFileSync(oldPath, newPath);
      unlinkSync(oldPath);
    } catch (error) {
      onWarning('migracao: falha ao mover arquivo, deixando a copia legada intacta', {
        oldPath,
        newPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/** Only ever removes a directory that is genuinely empty - never force-deletes leftover content. */
function removeIfEmpty(path: string): void {
  try {
    if (statSync(path).isDirectory() && readdirSync(path).length === 0) {
      rmdirSync(path);
    }
  } catch {
    // best-effort cleanup only
  }
}
