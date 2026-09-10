import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '@shared/contracts/ipc';
import type { FormatadorComissaoApi } from '@shared/contracts/api';

const api: FormatadorComissaoApi = {
  settings: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGetState),
    chooseFolder: (currentPath) => ipcRenderer.invoke(IPC_CHANNELS.settingsChooseFolder, currentPath),
    testFolder: (path) => ipcRenderer.invoke(IPC_CHANNELS.settingsTestFolder, path),
    completeFirstRun: (reportRoot) =>
      ipcRenderer.invoke(IPC_CHANNELS.settingsCompleteFirstRun, reportRoot)
  }
};

contextBridge.exposeInMainWorld('api', api);
