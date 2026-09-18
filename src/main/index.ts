import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { APP_ID, APP_NAME } from '@shared/constants/app';
import { resolveAppDataPaths } from './app/paths';
import { resolveAppIconPath, resolveBrandLogosDir } from './app/assets';
import { writeReportRootManifestIfMissing } from './app/dataOwnership';
import { MODE_FOLDER_NAME } from './app/folderNames';
import { findHardBlockReason, resolveCanonicalIfExists, type SpecialFolders } from './app/uninstallPlan';
import { initLogger, log } from './app/logger';
import { openDatabase } from './storage/database';
import { registerSettingsHandlers } from './ipc/settingsHandlers';
import { registerCompanyProfileHandlers } from './ipc/companyProfileHandlers';
import { registerPdfHandlers } from './ipc/pdfHandlers';
import { registerHistoryHandlers } from './ipc/historyHandlers';
import { registerImportHandlers, startImportWatchers, stopImportWatchers } from './ipc/importHandlers';
import { seedDefaultCompanyProfiles } from './companies/seedCompanyProfiles';
import { getReportRoot } from './storage/settingsRepository';
import { parseUninstallCliArgs, runUninstallCli } from './uninstallCli';
import {
  migrateLegacyAppData,
  migrateLegacyReportRootAndPaths,
  remapStoredLogoPaths,
  resolveLegacyUserDataPath
} from './migration/migrateLegacyNaming';

const paths = resolveAppDataPaths();
app.setPath('userData', paths.userDataPath);
app.setPath('logs', paths.logDir);
app.setName(APP_NAME);

/** `null` on every normal launch - only set when the uninstaller invokes this same executable in its headless data-cleanup mode (see `uninstallCli.ts`). */
const uninstallCliArgs = parseUninstallCliArgs(process.argv);

function resolveSpecialFolders(): SpecialFolders {
  return {
    home: app.getPath('home'),
    documents: app.getPath('documents'),
    desktop: app.getPath('desktop'),
    downloads: app.getPath('downloads')
  };
}

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: APP_NAME,
    autoHideMenuBar: true,
    icon: resolveAppIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  if (uninstallCliArgs) {
    // Headless: no window, no IPC, no watchers - resolve and (if requested) delete app-managed
    // data, write the result file the uninstaller reads, then exit immediately.
    const db = openDatabase(paths.databasePath);
    runUninstallCli(uninstallCliArgs, { db, paths, special: resolveSpecialFolders() });
    app.exit(0);
    return;
  }

  migrateLegacyAppData(paths, (message, meta) => console.warn(message, meta));

  initLogger(paths.logDir);
  log('info', 'app ready', { appDataPath: paths.userDataPath, databasePath: paths.databasePath });

  const db = openDatabase(paths.databasePath);
  remapStoredLogoPaths(db, resolveLegacyUserDataPath(paths), paths.userDataPath);

  const reportRootMigration = migrateLegacyReportRootAndPaths(db, (message, meta) => log('warn', message, meta));
  if (reportRootMigration.didMigrateRootFolder || reportRootMigration.didMigrateModeFolders) {
    log('info', 'legacy report root naming migrated', { ...reportRootMigration });
  }

  seedDefaultCompanyProfiles(db, resolveBrandLogosDir(), join(paths.userDataPath, 'logos'));

  registerSettingsHandlers({
    db,
    paths,
    getWindow: () => mainWindow,
    onFirstRunCompleted: (reportRoot) => startImportWatchers(reportRoot, () => mainWindow)
  });
  registerCompanyProfileHandlers({
    db,
    paths,
    getWindow: () => mainWindow
  });
  registerPdfHandlers({
    db,
    getWindow: () => mainWindow
  });
  registerImportHandlers({ db });
  registerHistoryHandlers({ db });

  const existingReportRoot = getReportRoot(db);
  if (existingReportRoot) {
    // Self-healing backfill for installs from before the report-root manifest existed - never
    // written for a hard-blocked broad location, even one a much older version let through.
    const canonicalRoot = resolveCanonicalIfExists(existingReportRoot);
    if (canonicalRoot && !findHardBlockReason(canonicalRoot, resolveSpecialFolders())) {
      writeReportRootManifestIfMissing(canonicalRoot, APP_ID, Object.values(MODE_FOLDER_NAME));
    }
    startImportWatchers(existingReportRoot, () => mainWindow);
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  void stopImportWatchers();
});
