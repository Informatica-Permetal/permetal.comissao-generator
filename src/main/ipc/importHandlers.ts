import { ipcMain, shell, type BrowserWindow } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { IPC_CHANNELS } from '@shared/contracts/ipc';
import type { ImportResult, SourceKind } from '@shared/types/import';
import type { ReportMode } from '@shared/constants/folders';
import { getCompanyProfile } from '../companies/companyProfileRepository';
import { getReportRoot } from '../storage/settingsRepository';
import { importFile } from '../import/importService';
import { startEntradaWatchers, type EntradaWatcherHandle } from '../import/entradaWatcher';
import { resolveEntradaDir } from '../app/folderNames';
import { log } from '../app/logger';

export interface ImportHandlerDeps {
  db: DatabaseSync;
}

export function registerImportHandlers(deps: ImportHandlerDeps): void {
  const { db } = deps;

  ipcMain.handle(IPC_CHANNELS.reportsOpenEntradaFolder, async (_event, mode: ReportMode) => {
    const reportRoot = getReportRoot(db);
    if (!reportRoot) return;
    await shell.openPath(resolveEntradaDir(reportRoot, mode));
  });

  ipcMain.handle(
    IPC_CHANNELS.reportsPreviewImport,
    async (_event, mode: ReportMode, sourcePath: string, sourceKind: SourceKind): Promise<ImportResult> => {
      const reportRoot = getReportRoot(db);
      if (!reportRoot) {
        return {
          ok: false,
          error: { kind: 'unreadable', message: 'Pasta raiz de relatórios ainda não configurada.' }
        };
      }
      return importFile(
        { mode, sourcePath, sourceKind },
        { db, reportRoot, lookupCompanyProfile: (code) => getCompanyProfile(db, code) }
      );
    }
  );
}

let watcherHandle: EntradaWatcherHandle | null = null;

/** Starts the two Entrada watchers once the report root is known. Idempotent. */
export function startImportWatchers(reportRoot: string, getWindow: () => BrowserWindow | null): void {
  if (watcherHandle) return;

  watcherHandle = startEntradaWatchers(reportRoot, (mode, filePath) => {
    log('info', 'entrada file detected', { mode, filePath });
    const window = getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.reportsEntradaFileDetected, { mode, filePath });
    }
  });
}

export async function stopImportWatchers(): Promise<void> {
  if (watcherHandle) {
    await watcherHandle.close();
    watcherHandle = null;
  }
}
