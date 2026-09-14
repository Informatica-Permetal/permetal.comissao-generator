import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { IPC_CHANNELS } from '@shared/contracts/ipc';
import type { GenerateReportResult, PrintPdfResult } from '@shared/types/pdf';
import type { BatchPreview } from '@shared/types/import';
import { getCompanyProfile } from '../companies/companyProfileRepository';
import { getReportRoot } from '../storage/settingsRepository';
import { renderHtmlToPdf } from '../pdf/renderPdf';
import { openContainingFolder, openPdf, printPdf } from '../pdf/pdfActions';
import { runBatchGeneration } from '../batches/batchLifecycle';
import { log } from '../app/logger';

interface PdfHandlerDeps {
  db: DatabaseSync;
  getWindow: () => BrowserWindow | null;
}

export function registerPdfHandlers(deps: PdfHandlerDeps): void {
  const { db, getWindow } = deps;

  ipcMain.handle(IPC_CHANNELS.reportsChooseSourceFile, async () => {
    const window = getWindow();
    const options: Electron.OpenDialogOptions = {
      title: 'Selecionar arquivo .xlsx',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      properties: ['openFile']
    };
    const result = window ? await dialog.showOpenDialog(window, options) : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    IPC_CHANNELS.reportsGeneratePdfs,
    async (_event, preview: BatchPreview): Promise<GenerateReportResult> => {
      const reportRoot = getReportRoot(db);
      if (!reportRoot) {
        throw new Error('Pasta raiz de relatorios ainda nao configurada.');
      }

      const lookupCompanyProfile = (branchCode: string) => getCompanyProfile(db, branchCode);

      const result = await runBatchGeneration(
        {
          mode: preview.mode,
          batchId: preview.batchId,
          sourcePath: preview.sourcePath,
          sourceKind: preview.sourceKind,
          workspaceFilePath: preview.workspaceFilePath
        },
        {
          db,
          reportRoot,
          lookupCompanyProfile,
          appVersion: app.getVersion(),
          renderPdf: renderHtmlToPdf
        }
      );

      log('info', 'pdfs generated', {
        mode: preview.mode,
        batchId: preview.batchId,
        sourceFile: preview.sourceOriginalName,
        generatedCount: result.generated.length,
        missingBranchCodes: result.missingBranchCodes
      });
      return result;
    }
  );

  ipcMain.handle(IPC_CHANNELS.pdfOpen, (_event, filePath: string) => openPdf(filePath));

  ipcMain.handle(IPC_CHANNELS.pdfOpenFolder, (_event, filePath: string) => {
    openContainingFolder(filePath);
  });

  ipcMain.handle(IPC_CHANNELS.pdfPrint, async (_event, filePath: string): Promise<PrintPdfResult> => {
    try {
      await printPdf(filePath);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao imprimir.';
      log('error', 'print failed', { filePath, error: message });
      return { ok: false, error: message };
    }
  });
}
