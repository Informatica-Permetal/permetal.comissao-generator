import type { AppState, CompleteFirstRunResult, FolderPermissionResult } from '../types/settings';

/**
 * The full surface the preload exposes on window.api. Kept intentionally narrow:
 * one typed method per allowed operation, no generic fs/shell/ipcRenderer passthrough.
 */
export interface FormatadorComissaoApi {
  settings: {
    getState(): Promise<AppState>;
    chooseFolder(currentPath?: string): Promise<string | null>;
    testFolder(path: string): Promise<FolderPermissionResult>;
    completeFirstRun(reportRoot: string): Promise<CompleteFirstRunResult>;
  };
}
