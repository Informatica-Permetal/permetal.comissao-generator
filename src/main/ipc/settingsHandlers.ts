import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { IPC_CHANNELS } from '@shared/contracts/ipc';
import { APP_ID } from '@shared/constants/app';
import type { AppState, CompleteFirstRunResult, FolderPermissionResult } from '@shared/types/settings';
import type { ExecutionProfile } from '../app/executionProfile';
import { resolveSuggestedReportRoot, type AppDataPaths } from '../app/paths';
import { createFolderTree, testFolderPermissions } from '../app/reportRoot';
import { writeReportRootManifestIfMissing } from '../app/dataOwnership';
import { MODE_FOLDER_NAME } from '../app/folderNames';
import { log } from '../app/logger';
import { getReportRoot, isFirstRunComplete, persistFirstRunCompletion } from '../storage/settingsRepository';

interface SettingsHandlerDeps {
  db: DatabaseSync;
  paths: AppDataPaths;
  executionProfile: ExecutionProfile;
  getWindow: () => BrowserWindow | null;
  onFirstRunCompleted?: (reportRoot: string) => void;
}

export function registerSettingsHandlers(deps: SettingsHandlerDeps): void {
  const { db, paths, executionProfile, getWindow, onFirstRunCompleted } = deps;

  ipcMain.handle(IPC_CHANNELS.settingsGetState, (): AppState => ({
    isFirstRunComplete: isFirstRunComplete(db),
    reportRoot: getReportRoot(db),
    suggestedReportRoot: resolveSuggestedReportRoot(app.getPath('documents'), executionProfile),
    appDataPath: paths.userDataPath,
    logPath: paths.logDir,
    databasePath: paths.databasePath,
    appVersion: app.getVersion()
  }));

  ipcMain.handle(IPC_CHANNELS.settingsChooseFolder, async (_event, currentPath?: string) => {
    const window = getWindow();
    const options: Electron.OpenDialogOptions = {
      title: 'Escolher pasta raiz de relatórios',
      defaultPath: currentPath && currentPath.length > 0 ? currentPath : undefined,
      properties: ['openDirectory', 'createDirectory']
    };
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    IPC_CHANNELS.settingsTestFolder,
    (_event, path: string): FolderPermissionResult => testFolderPermissions(path)
  );

  ipcMain.handle(
    IPC_CHANNELS.settingsCompleteFirstRun,
    (_event, reportRoot: string): CompleteFirstRunResult => {
      const permission = testFolderPermissions(reportRoot);
      if (!permission.ok) {
        return { ok: false, error: permission.reason ?? 'Falha ao validar a pasta selecionada.' };
      }
      try {
        createFolderTree(reportRoot);
        writeReportRootManifestIfMissing(reportRoot, APP_ID, Object.values(MODE_FOLDER_NAME));
        persistFirstRunCompletion(db, reportRoot);
        log('info', 'first run completed', { reportRoot });
        onFirstRunCompleted?.(reportRoot);
        return { ok: true, reportRoot };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao criar as pastas.';
        log('error', 'first run failed', { reportRoot, error: message });
        return { ok: false, error: message };
      }
    }
  );
}
