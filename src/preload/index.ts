import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { IPC_CHANNELS } from '@shared/contracts/ipc';
import type { FormatadorComissaoApi } from '@shared/contracts/api';
import type { EntradaFileDetectedPayload } from '@shared/types/import';

const api: FormatadorComissaoApi = {
  settings: {
    getState: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGetState),
    chooseFolder: (currentPath) => ipcRenderer.invoke(IPC_CHANNELS.settingsChooseFolder, currentPath),
    testFolder: (path) => ipcRenderer.invoke(IPC_CHANNELS.settingsTestFolder, path),
    completeFirstRun: (reportRoot) =>
      ipcRenderer.invoke(IPC_CHANNELS.settingsCompleteFirstRun, reportRoot)
  },
  companies: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.companiesList),
    listGroups: () => ipcRenderer.invoke(IPC_CHANNELS.companiesListGroups),
    upsert: (input) => ipcRenderer.invoke(IPC_CHANNELS.companiesUpsert, input),
    chooseLogo: (branchCode) => ipcRenderer.invoke(IPC_CHANNELS.companiesChooseLogo, branchCode),
    setActive: (branchCode, active) => ipcRenderer.invoke(IPC_CHANNELS.companiesSetActive, branchCode, active),
    delete: (branchCode) => ipcRenderer.invoke(IPC_CHANNELS.companiesDelete, branchCode)
  },
  reports: {
    chooseSourceFile: () => ipcRenderer.invoke(IPC_CHANNELS.reportsChooseSourceFile),
    openEntradaFolder: (mode) => ipcRenderer.invoke(IPC_CHANNELS.reportsOpenEntradaFolder, mode),
    previewImport: (mode, sourcePath, sourceKind) =>
      ipcRenderer.invoke(IPC_CHANNELS.reportsPreviewImport, mode, sourcePath, sourceKind),
    generatePdfs: (preview, groupingChoices) =>
      ipcRenderer.invoke(IPC_CHANNELS.reportsGeneratePdfs, preview, groupingChoices),
    onEntradaFileDetected: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: EntradaFileDetectedPayload): void =>
        callback(payload);
      ipcRenderer.on(IPC_CHANNELS.reportsEntradaFileDetected, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.reportsEntradaFileDetected, listener);
    }
  },
  pdf: {
    open: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.pdfOpen, filePath),
    openFolder: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.pdfOpenFolder, filePath),
    print: (filePath) => ipcRenderer.invoke(IPC_CHANNELS.pdfPrint, filePath)
  },
  history: {
    list: (filters) => ipcRenderer.invoke(IPC_CHANNELS.historyList, filters),
    getBatch: (batchId) => ipcRenderer.invoke(IPC_CHANNELS.historyGetBatch, batchId),
    deleteDocument: (documentId) => ipcRenderer.invoke(IPC_CHANNELS.historyDeleteDocument, documentId),
    deleteBatch: (batchId) => ipcRenderer.invoke(IPC_CHANNELS.historyDeleteBatch, batchId),
    regenerateDocument: (documentId) => ipcRenderer.invoke(IPC_CHANNELS.historyRegenerateDocument, documentId),
    regenerateBatch: (batchId) => ipcRenderer.invoke(IPC_CHANNELS.historyRegenerateBatch, batchId)
  },
  files: {
    getPathForFile: (file) => webUtils.getPathForFile(file)
  }
};

contextBridge.exposeInMainWorld('api', api);
