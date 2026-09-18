import { ipcMain, shell } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { IPC_CHANNELS } from '@shared/contracts/ipc';
import type { DeleteResult, HistoryBatch, HistoryDocument, HistoryFilters, RegenerateResult } from '@shared/types/history';
import { getCompanyProfile } from '../companies/companyProfileRepository';
import { getCompanyGroup } from '../companies/companyGroupRepository';
import { getReportRoot } from '../storage/settingsRepository';
import { getBatchById } from '../storage/batchRepository';
import { listDocuments } from '../storage/documentRepository';
import { deleteBatch, deleteDocument } from '../batches/deleteService';
import { regenerateBatch, regenerateDocument } from '../batches/regenerateService';
import { renderHtmlToPdf } from '../pdf/renderPdf';
import { embedImageAsDataUri } from '../pdf/embedImage';
import { resolvePerforatedMetalMotifPath } from '../app/assets';

interface HistoryHandlerDeps {
  db: DatabaseSync;
}

export function registerHistoryHandlers(deps: HistoryHandlerDeps): void {
  const { db } = deps;

  ipcMain.handle(IPC_CHANNELS.historyList, (_event, filters: HistoryFilters): HistoryDocument[] =>
    listDocuments(db, filters)
  );

  ipcMain.handle(IPC_CHANNELS.historyGetBatch, (_event, batchId: string): HistoryBatch | null =>
    getBatchById(db, batchId)
  );

  ipcMain.handle(
    IPC_CHANNELS.historyDeleteDocument,
    (_event, documentId: string): Promise<DeleteResult> => deleteDocument(documentId, { db, trashItem: shell.trashItem })
  );

  ipcMain.handle(
    IPC_CHANNELS.historyDeleteBatch,
    (_event, batchId: string): Promise<DeleteResult> => deleteBatch(batchId, { db, trashItem: shell.trashItem })
  );

  ipcMain.handle(IPC_CHANNELS.historyRegenerateDocument, (_event, documentId: string): Promise<RegenerateResult> => {
    const reportRoot = getReportRoot(db);
    if (!reportRoot) return Promise.resolve({ ok: false, error: 'Pasta raiz de relatórios ainda não configurada.' });
    return regenerateDocument(documentId, {
      db,
      reportRoot,
      lookupCompanyProfile: (branchCode) => getCompanyProfile(db, branchCode),
      lookupCompanyGroup: (groupKey) => (groupKey ? getCompanyGroup(db, groupKey) : null),
      renderPdf: renderHtmlToPdf,
      motifDataUri: embedImageAsDataUri(resolvePerforatedMetalMotifPath())
    });
  });

  ipcMain.handle(IPC_CHANNELS.historyRegenerateBatch, (_event, batchId: string): Promise<RegenerateResult> => {
    const reportRoot = getReportRoot(db);
    if (!reportRoot) return Promise.resolve({ ok: false, error: 'Pasta raiz de relatórios ainda não configurada.' });
    return regenerateBatch(batchId, {
      db,
      reportRoot,
      lookupCompanyProfile: (branchCode) => getCompanyProfile(db, branchCode),
      lookupCompanyGroup: (groupKey) => (groupKey ? getCompanyGroup(db, groupKey) : null),
      renderPdf: renderHtmlToPdf,
      motifDataUri: embedImageAsDataUri(resolvePerforatedMetalMotifPath())
    });
  });
}
