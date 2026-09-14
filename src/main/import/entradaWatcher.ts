import { watch, type FSWatcher } from 'chokidar';
import { basename, extname, join } from 'node:path';
import { REPORT_MODES, type ReportMode } from '@shared/constants/folders';

export interface EntradaWatcherHandle {
  close: () => Promise<void>;
}

function isIgnoredEntradaFile(path: string, isDirectory: boolean): boolean {
  if (isDirectory) return false;
  const name = basename(path);
  const extension = extname(name);
  // chokidar probes the watched root itself through this same filter with no
  // stats attached; an extensionless name is never one of our files, so let
  // it through rather than accidentally excluding the Entrada folder itself.
  if (extension === '') return false;
  if (name.startsWith('~$')) return true;
  return extension.toLowerCase() !== '.xlsx';
}

/**
 * One watcher per mode's Entrada folder, active for the app's lifetime.
 * Waits for the file to stop changing size (`awaitWriteFinish`) before
 * emitting, so a file mid-copy/mid-save is never opened too early.
 */
export function startEntradaWatchers(
  reportRoot: string,
  onFileDetected: (mode: ReportMode, filePath: string) => void
): EntradaWatcherHandle {
  const watchers: FSWatcher[] = REPORT_MODES.map((mode) => {
    const entradaDir = join(reportRoot, mode, 'Entrada');
    const watcher = watch(entradaDir, {
      ignoreInitial: false,
      depth: 0,
      awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 },
      ignored: (path, stats) => isIgnoredEntradaFile(path, stats?.isDirectory() ?? false)
    });
    watcher.on('add', (filePath) => onFileDetected(mode, filePath));
    return watcher;
  });

  return {
    close: async () => {
      await Promise.all(watchers.map((watcher) => watcher.close()));
    }
  };
}
