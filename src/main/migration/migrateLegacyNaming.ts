import { basename, dirname, join } from 'node:path';
import { existsSync, readdirSync, rmdirSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { APP_NAME } from '@shared/constants/app';
import {
  LEGACY_APP_NAME,
  LEGACY_HISTORICO_FOLDER_NAME,
  LEGACY_MODE_FOLDER_NAME,
  MODE_FOLDER_NAME,
  SUBFOLDER_FOLDER_NAME
} from '../app/folderNames';
import type { AppDataPaths } from '../app/paths';
import { getReportRoot, updateReportRoot } from '../storage/settingsRepository';
import { migrateFolderSafely, type MigrationWarning } from './migrateFolderSafely';
import { remapLegacyReportPath, remapPathPrefix } from './remapLegacyPath';

/** The app-data folder name this app ever wrote to disk before the accented product name. */
export function resolveLegacyUserDataPath(paths: AppDataPaths): string {
  return join(dirname(paths.userDataPath), LEGACY_APP_NAME);
}

/**
 * One-time (but idempotent - safe to run on every startup) migration of the
 * app's own internal data folder from the legacy ASCII name to the current
 * accented product name: `%LOCALAPPDATA%\Formatador Comissao\*` ->
 * `%LOCALAPPDATA%\Formatador Comissão\*`. Must run BEFORE `openDatabase` so
 * the database file itself (and any -journal sibling) is already at its new
 * home by the time it is opened. Never overwrites; a name collision at the
 * destination is reported via `onWarning` and the legacy copy is left in
 * place untouched.
 */
export function migrateLegacyAppData(paths: AppDataPaths, onWarning: MigrationWarning): void {
  const legacyUserDataPath = resolveLegacyUserDataPath(paths);
  if (legacyUserDataPath === paths.userDataPath) return; // APP_NAME still equals the legacy name - nothing to do
  if (!existsSync(legacyUserDataPath)) return;

  const legacyDbBaseName = `${LEGACY_APP_NAME}.db`;
  const newDbBaseName = `${APP_NAME}.db`;

  for (const entryName of readdirSync(legacyUserDataPath)) {
    const oldEntryPath = join(legacyUserDataPath, entryName);
    const newEntryName = entryName.startsWith(legacyDbBaseName)
      ? newDbBaseName + entryName.slice(legacyDbBaseName.length)
      : entryName;
    const newEntryPath = join(paths.userDataPath, newEntryName);
    migrateFolderSafely(oldEntryPath, newEntryPath, onWarning);
  }
  removeIfEmptyDir(legacyUserDataPath);
}

function removeIfEmptyDir(path: string): void {
  try {
    if (existsSync(path) && readdirSync(path).length === 0) {
      rmdirSync(path);
    }
  } catch {
    // best-effort only - a non-empty leftover (unmovable conflicts) is left in place on purpose
  }
}

/**
 * Rewrites every `company_profiles.logo_path` that lived under the legacy
 * `userData` folder to point at its new location. Simple prefix swap - the
 * `logos` subfolder name itself never changes, only its `Formatador
 * Comissao` -> `Formatador Comissão` parent. Call after
 * `migrateLegacyAppData` has actually moved the files, once the database is
 * open.
 */
export function remapStoredLogoPaths(db: DatabaseSync, oldUserDataPath: string, newUserDataPath: string): void {
  const rows = db
    .prepare('SELECT branch_code, logo_path FROM company_profiles WHERE logo_path IS NOT NULL')
    .all() as unknown as { branch_code: string; logo_path: string }[];
  for (const row of rows) {
    const remapped = remapPathPrefix(oldUserDataPath, newUserDataPath, row.logo_path);
    if (remapped !== row.logo_path) {
      db.prepare('UPDATE company_profiles SET logo_path = ? WHERE branch_code = ?').run(remapped, row.branch_code);
    }
  }
}

export interface ReportRootMigrationResult {
  reportRoot: string | null;
  didMigrateRootFolder: boolean;
  didMigrateModeFolders: boolean;
}

/**
 * One-time (idempotent) migration of the user's configured report root: if
 * its own folder is literally still named the legacy default
 * ("Formatador Comissao"), renames it; then, inside whatever the report
 * root now is, renames the `Previsao`/`Relacao` mode folders and each
 * mode's `Historico` subfolder to their accented physical names; then
 * rewrites every absolute path persisted in SQLite that pointed into the
 * renamed tree (`batches.source_archived_path`, `documents.pdf_path`) so
 * History and regeneration keep working. Requires the database to already
 * be open. Safe to call on every startup - it is a no-op once nothing is
 * left in the legacy layout.
 */
export function migrateLegacyReportRootAndPaths(
  db: DatabaseSync,
  onWarning: MigrationWarning
): ReportRootMigrationResult {
  const storedRoot = getReportRoot(db);
  if (!storedRoot) return { reportRoot: null, didMigrateRootFolder: false, didMigrateModeFolders: false };

  let currentRoot = storedRoot;
  let didMigrateRootFolder = false;

  if (basename(currentRoot) === LEGACY_APP_NAME) {
    const candidateNewRoot = join(dirname(currentRoot), APP_NAME);
    if (existsSync(currentRoot)) {
      migrateFolderSafely(currentRoot, candidateNewRoot, onWarning);
      didMigrateRootFolder = true;
    }
    if (existsSync(candidateNewRoot)) {
      currentRoot = candidateNewRoot;
    }
  }

  let didMigrateModeFolders = false;
  const legacyModeEntries = Object.entries(LEGACY_MODE_FOLDER_NAME) as [keyof typeof LEGACY_MODE_FOLDER_NAME, string][];
  for (const [mode, legacyModeFolder] of legacyModeEntries) {
    const newModeFolder = MODE_FOLDER_NAME[mode];
    const oldModeDir = join(currentRoot, legacyModeFolder);
    const newModeDir = join(currentRoot, newModeFolder);
    if (existsSync(oldModeDir)) {
      migrateFolderSafely(oldModeDir, newModeDir, onWarning);
      didMigrateModeFolders = true;
    }

    const oldHistoricoDir = join(newModeDir, LEGACY_HISTORICO_FOLDER_NAME);
    const newHistoricoDir = join(newModeDir, SUBFOLDER_FOLDER_NAME.Historico);
    if (existsSync(oldHistoricoDir)) {
      migrateFolderSafely(oldHistoricoDir, newHistoricoDir, onWarning);
      didMigrateModeFolders = true;
    }
  }

  if (currentRoot !== storedRoot) {
    updateReportRoot(db, currentRoot);
  }

  remapStoredDocumentAndBatchPaths(db, storedRoot, currentRoot);

  return { reportRoot: currentRoot, didMigrateRootFolder, didMigrateModeFolders };
}

function remapStoredDocumentAndBatchPaths(db: DatabaseSync, oldReportRoot: string, newReportRoot: string): void {
  const batches = db
    .prepare('SELECT id, source_archived_path FROM batches WHERE source_archived_path IS NOT NULL')
    .all() as unknown as { id: string; source_archived_path: string }[];
  for (const batch of batches) {
    const remapped = remapLegacyReportPath(oldReportRoot, newReportRoot, batch.source_archived_path);
    if (remapped !== batch.source_archived_path) {
      db.prepare('UPDATE batches SET source_archived_path = ? WHERE id = ?').run(remapped, batch.id);
    }
  }

  const documents = db
    .prepare('SELECT id, pdf_path FROM documents WHERE pdf_path IS NOT NULL')
    .all() as unknown as { id: string; pdf_path: string }[];
  for (const document of documents) {
    const remapped = remapLegacyReportPath(oldReportRoot, newReportRoot, document.pdf_path);
    if (remapped !== document.pdf_path) {
      db.prepare('UPDATE documents SET pdf_path = ? WHERE id = ?').run(remapped, document.id);
    }
  }
}
