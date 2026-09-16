export const IPC_CHANNELS = {
  settingsGetState: 'settings:get-state',
  settingsChooseFolder: 'settings:choose-folder',
  settingsTestFolder: 'settings:test-folder',
  settingsCompleteFirstRun: 'settings:complete-first-run',

  companiesList: 'companies:list',
  companiesListGroups: 'companies:list-groups',
  companiesUpsert: 'companies:upsert',
  companiesChooseLogo: 'companies:choose-logo',
  companiesSetActive: 'companies:set-active',
  companiesDelete: 'companies:delete',

  reportsChooseSourceFile: 'reports:choose-source-file',
  reportsOpenEntradaFolder: 'reports:open-entrada-folder',
  reportsPreviewImport: 'reports:preview-import',
  reportsGeneratePdfs: 'reports:generate-pdfs',
  reportsEntradaFileDetected: 'reports:entrada-file-detected',

  pdfOpen: 'pdf:open',
  pdfOpenFolder: 'pdf:open-folder',
  pdfPrint: 'pdf:print',

  historyList: 'history:list',
  historyGetBatch: 'history:get-batch',
  historyDeleteDocument: 'history:delete-document',
  historyDeleteBatch: 'history:delete-batch',
  historyRegenerateDocument: 'history:regenerate-document',
  historyRegenerateBatch: 'history:regenerate-batch'
} as const;
