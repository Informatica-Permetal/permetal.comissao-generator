import { copyFileSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import { dialog, ipcMain, type BrowserWindow } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { IPC_CHANNELS } from '@shared/contracts/ipc';
import type { CompanyProfile, CompanyProfileInput, CompanyProfileWithLogoPreview } from '@shared/types/companyProfile';
import {
  getCompanyProfile,
  listCompanyProfiles,
  setCompanyProfileLogo,
  upsertCompanyProfile
} from '../companies/companyProfileRepository';
import { embedImageAsDataUri } from '../pdf/embedImage';
import type { AppDataPaths } from '../app/paths';

interface CompanyProfileHandlerDeps {
  db: DatabaseSync;
  paths: AppDataPaths;
  getWindow: () => BrowserWindow | null;
}

function withLogoPreview(profile: CompanyProfile): CompanyProfileWithLogoPreview {
  return {
    ...profile,
    logoDataUri: profile.logoPath ? embedImageAsDataUri(profile.logoPath) : null
  };
}

export function registerCompanyProfileHandlers(deps: CompanyProfileHandlerDeps): void {
  const { db, paths, getWindow } = deps;

  ipcMain.handle(IPC_CHANNELS.companiesList, (): CompanyProfileWithLogoPreview[] =>
    listCompanyProfiles(db).map(withLogoPreview)
  );

  ipcMain.handle(
    IPC_CHANNELS.companiesUpsert,
    (_event, input: CompanyProfileInput): CompanyProfileWithLogoPreview =>
      withLogoPreview(upsertCompanyProfile(db, input))
  );

  ipcMain.handle(IPC_CHANNELS.companiesChooseLogo, async (_event, branchCode: string) => {
    const window = getWindow();
    const options: Electron.OpenDialogOptions = {
      title: 'Escolher logo da empresa',
      filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg'] }],
      properties: ['openFile']
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;

    const sourcePath = result.filePaths[0];
    const logosDir = join(paths.userDataPath, 'logos');
    mkdirSync(logosDir, { recursive: true });
    const targetPath = join(logosDir, `${branchCode}-${Date.now()}${extname(sourcePath)}`);
    copyFileSync(sourcePath, targetPath);
    setCompanyProfileLogo(db, branchCode, targetPath);

    const profile = getCompanyProfile(db, branchCode);
    return profile ? withLogoPreview(profile) : null;
  });
}
