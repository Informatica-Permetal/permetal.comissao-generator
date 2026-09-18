import { writeFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import { APP_ID } from '@shared/constants/app';
import { MODE_FOLDER_NAME } from './app/folderNames';
import type { AppDataPaths } from './app/paths';
import { buildUninstallPlan, executeUninstallPlan, type SpecialFolders } from './app/uninstallPlan';
import { getReportRoot } from './storage/settingsRepository';
import { log } from './app/logger';

/**
 * Headless CLI hook the uninstaller invokes (via its own copy of this same
 * executable, before program files are removed) to safely resolve and,
 * only if the user explicitly opted in, delete app-managed data. Never
 * reached during normal interactive use - see `index.ts`'s early branch.
 */

export type UninstallCliMode = 'check' | 'delete';

export interface UninstallCliArgs {
  mode: UninstallCliMode;
  outPath: string;
}

const CHECK_FLAG = '--uninstall-check-paths';
const DELETE_FLAG = '--uninstall-delete-data';
const OUT_PREFIX = '--uninstall-out=';

/** `null` when argv does not request the uninstall-cleanup mode at all - the normal app startup should proceed. */
export function parseUninstallCliArgs(argv: readonly string[]): UninstallCliArgs | null {
  const hasCheck = argv.includes(CHECK_FLAG);
  const hasDelete = argv.includes(DELETE_FLAG);
  if (!hasCheck && !hasDelete) return null;

  const outArg = argv.find((a) => a.startsWith(OUT_PREFIX));
  const outPath = outArg?.slice(OUT_PREFIX.length);
  if (!outPath) return null;

  return { mode: hasDelete ? 'delete' : 'check', outPath };
}

export interface UninstallCliDeps {
  db: DatabaseSync;
  paths: AppDataPaths;
  special: SpecialFolders;
}

/**
 * Written as plain UTF-16LE text (NOT JSON) - the only consumer is the NSIS
 * uninstaller script, which reads Unicode text files line-by-line via
 * `FileReadUTF16LE` but has no JSON parser. Accented folder names (Previsão,
 * Relação, Área de Trabalho, ...) must round-trip correctly, which is why
 * UTF-16LE is used rather than UTF-8 (Unicode NSIS's plain `FileRead`
 * defaults to the system ANSI codepage for files without a UTF-16 BOM).
 */
function writeLinesFile(outPath: string, lines: readonly string[]): void {
  writeFileSync(outPath, lines.join('\r\n'), 'utf16le');
}

/**
 * Always re-derives the plan itself from scratch - never trusts a
 * previously-written "check" result file as proof of safety, even when
 * invoked in "delete" mode right after a "check" call.
 */
export function runUninstallCli(args: UninstallCliArgs, deps: UninstallCliDeps): void {
  const reportRoot = getReportRoot(deps.db);
  const plan = buildUninstallPlan({
    appId: APP_ID,
    appDataPath: deps.paths.userDataPath,
    reportRoot,
    managedTopLevelNames: Object.values(MODE_FOLDER_NAME),
    special: deps.special
  });

  if (args.mode === 'check') {
    // One absolute path per line - exactly what would be deleted, nothing about why a path was
    // excluded (that detail is only ever in the log, never shown to the end user).
    writeLinesFile(
      args.outPath,
      plan.items.map((item) => item.path)
    );
    log('info', 'uninstall cleanup: paths checked', { items: plan.items.length, blocked: plan.blocked.length });
    return;
  }

  // The plan's own AppData item is the folder this very database file lives in - it must be
  // closed before deletion, or removing it would fail on Windows while the file is still open.
  deps.db.close();

  const result = executeUninstallPlan(plan);
  const statusLine = result.errors.length === 0 ? 'OK' : 'ERROR';
  const detailLines = [
    ...result.deletedPaths,
    ...result.errors.map((e) => `ERRO: ${e.path} :: ${e.error}`)
  ];
  writeLinesFile(args.outPath, [statusLine, ...detailLines]);
  log('info', 'uninstall cleanup: data deleted', {
    deleted: result.deletedPaths.length,
    errors: result.errors.length
  });
}
