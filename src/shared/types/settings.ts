export interface AppState {
  isFirstRunComplete: boolean;
  reportRoot: string | null;
  suggestedReportRoot: string;
  appDataPath: string;
  logPath: string;
  databasePath: string;
  appVersion: string;
}

export interface FolderPermissionResult {
  ok: boolean;
  reason?: string;
}

export interface CompleteFirstRunResult {
  ok: boolean;
  reportRoot?: string;
  error?: string;
}
