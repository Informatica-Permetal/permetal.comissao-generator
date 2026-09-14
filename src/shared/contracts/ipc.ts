export const IPC_CHANNELS = {
  settingsGetState: 'settings:get-state',
  settingsChooseFolder: 'settings:choose-folder',
  settingsTestFolder: 'settings:test-folder',
  settingsCompleteFirstRun: 'settings:complete-first-run',

  companiesList: 'companies:list',
  companiesUpsert: 'companies:upsert',
  companiesChooseLogo: 'companies:choose-logo',

  reportsChooseSourceFile: 'reports:choose-source-file',
  reportsOpenEntradaFolder: 'reports:open-entrada-folder',
  reportsPreviewImport: 'reports:preview-import',
  reportsGeneratePdfs: 'reports:generate-pdfs',
  reportsEntradaFileDetected: 'reports:entrada-file-detected',

  pdfOpen: 'pdf:open',
  pdfOpenFolder: 'pdf:open-folder',
  pdfPrint: 'pdf:print'
} as const;
