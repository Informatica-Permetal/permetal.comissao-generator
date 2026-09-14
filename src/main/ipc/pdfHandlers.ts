import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { IPC_CHANNELS } from '@shared/contracts/ipc';
import type { ReportMode } from '@shared/constants/folders';
import type { GenerateReportResult, PrintPdfResult } from '@shared/types/pdf';
import { getCompanyProfile } from '../companies/companyProfileRepository';
import { getReportRoot } from '../storage/settingsRepository';
import { insertBatch } from '../storage/batchRepository';
import { computeFileHashSync } from '../import/computeFileHash';
import { parsePrevisaoFile } from '../reports/previsao/parser';
import { parseRelacaoFile } from '../reports/relacao/parser';
import { generatePrevisaoPdfs, generateRelacaoPdfs } from '../pdf/generateReportPdfs';
import { renderHtmlToPdf } from '../pdf/renderPdf';
import { openContainingFolder, openPdf, printPdf } from '../pdf/pdfActions';
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
    async (_event, mode: ReportMode, filePath: string): Promise<GenerateReportResult> => {
      const reportRoot = getReportRoot(db);
      if (!reportRoot) {
        throw new Error('Pasta raiz de relatorios ainda nao configurada.');
      }

      const lookupCompanyProfile = (branchCode: string) => getCompanyProfile(db, branchCode);
      const generatedAt = new Date();

      let result: GenerateReportResult;
      let sourceRowCount: number;

      if (mode === 'Previsao') {
        const parseResult = await parsePrevisaoFile(filePath);
        sourceRowCount = parseResult.rows.length;
        result = await generatePrevisaoPdfs(parseResult, {
          reportRoot,
          generatedAt,
          lookupCompanyProfile,
          renderPdf: renderHtmlToPdf
        });
      } else {
        const parseResult = await parseRelacaoFile(filePath);
        sourceRowCount = parseResult.rows.length;
        result = await generateRelacaoPdfs(parseResult, {
          reportRoot,
          generatedAt,
          lookupCompanyProfile,
          renderPdf: renderHtmlToPdf
        });
      }

      if (result.generated.length > 0) {
        insertBatch(db, {
          id: randomUUID(),
          mode,
          sourceOriginalName: basename(filePath),
          sourceHash: computeFileHashSync(filePath),
          importedAt: generatedAt.toISOString(),
          sourceRowCount,
          outputCount: result.generated.length,
          status: 'completed',
          appVersion: app.getVersion()
        });
      }

      log('info', 'pdfs generated', {
        mode,
        sourceFile: filePath,
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
