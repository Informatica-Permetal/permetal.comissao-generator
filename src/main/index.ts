import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { APP_NAME } from '@shared/constants/app';
import { resolveAppDataPaths } from './app/paths';
import { resolveAppIconPath, resolveBrandLogosDir } from './app/assets';
import { initLogger, log } from './app/logger';
import { openDatabase } from './storage/database';
import { registerSettingsHandlers } from './ipc/settingsHandlers';
import { registerCompanyProfileHandlers } from './ipc/companyProfileHandlers';
import { registerPdfHandlers } from './ipc/pdfHandlers';
import { registerHistoryHandlers } from './ipc/historyHandlers';
import { registerImportHandlers, startImportWatchers, stopImportWatchers } from './ipc/importHandlers';
import { seedDefaultCompanyProfiles } from './companies/seedCompanyProfiles';
import { getReportRoot } from './storage/settingsRepository';

const paths = resolveAppDataPaths();
app.setPath('userData', paths.userDataPath);
app.setPath('logs', paths.logDir);
app.setName(APP_NAME);

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
  initLogger(paths.logDir);
  log('info', 'app ready', { appDataPath: paths.userDataPath, databasePath: paths.databasePath });

  const db = openDatabase(paths.databasePath);
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
