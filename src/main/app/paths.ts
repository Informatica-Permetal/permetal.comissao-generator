import { homedir } from 'node:os';
import { join } from 'node:path';
import { APP_NAME } from '@shared/constants/app';

export interface AppDataPaths {
  userDataPath: string;
  logDir: string;
  databasePath: string;
}

export function resolveAppDataPaths(): AppDataPaths {
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
  const userDataPath = join(localAppData, APP_NAME);
  return {
    userDataPath,
    logDir: join(userDataPath, 'logs'),
    databasePath: join(userDataPath, `${APP_NAME}.db`)
  };
}

export function resolveSuggestedReportRoot(documentsPath: string): string {
  return join(documentsPath, APP_NAME);
}
