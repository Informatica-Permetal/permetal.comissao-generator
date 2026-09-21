import { homedir } from 'node:os';
import { join } from 'node:path';
import { APP_NAME } from '@shared/constants/app';
import { resolveProfileAppName, type ExecutionProfile } from './executionProfile';

export interface AppDataPaths {
  userDataPath: string;
  logDir: string;
  databasePath: string;
  /** Where Chromium's own Cache/GPUCache/Session Storage/etc. live - explicitly set to the same profile-scoped folder as `userDataPath` (Electron's own default when unset), so isolation never depends on that default staying true across Electron versions. */
  sessionDataPath: string;
}

/**
 * Defaults to PRODUCTION so every existing caller (and `paths.test.ts`) that never
 * heard of execution profiles keeps resolving the exact same path as before this
 * profile system existed - PRODUCTION's own paths are never renamed, moved, or migrated
 * by this change.
 */
export function resolveAppDataPaths(profile: ExecutionProfile = 'PRODUCTION'): AppDataPaths {
  const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
  const profileAppName = resolveProfileAppName(APP_NAME, profile);
  const userDataPath = join(localAppData, profileAppName);
  return {
    userDataPath,
    logDir: join(userDataPath, 'logs'),
    databasePath: join(userDataPath, `${profileAppName}.db`),
    sessionDataPath: userDataPath
  };
}

export function resolveSuggestedReportRoot(documentsPath: string, profile: ExecutionProfile = 'PRODUCTION'): string {
  return join(documentsPath, resolveProfileAppName(APP_NAME, profile));
}
