import { existsSync, rmdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { DeleteResult } from '@shared/types/history';
import { deleteBatchRecord, getBatchById } from '../storage/batchRepository';
import { deleteDocumentRecord, getDocumentById, listDocumentsByBatch } from '../storage/documentRepository';
import { withModeLock } from './modeLock';
import { log } from '../app/logger';

export interface DeleteDeps {
  db: DatabaseSync;
  /** Sends a path to the Windows Recycle Bin. Injected so this can be unit-tested without Electron's `shell`. */
  trashItem: (path: string) => Promise<void>;
}

/** Best-effort: removes `dir` and up to two empty parent directories above it. Never touches a non-empty directory. */
function cleanupEmptyDirsUpward(dir: string): void {
  let current = dir;
  for (let i = 0; i < 3; i++) {
    try {
      rmdirSync(current);
    } catch {
      return;
    }
    current = dirname(current);
  }
}

/**
 * Trashes a single document's PDF (wherever it currently lives - Gerados or
 * Historico) and removes its history record. Never touches the batch's
 * archived source XLSX, since other documents of the same batch may still
 * need it for regeneration.
 */
export async function deleteDocument(documentId: string, deps: DeleteDeps): Promise<DeleteResult> {
  const initialDocument = getDocumentById(deps.db, documentId);
  if (!initialDocument) {
    return { ok: false, error: 'Documento não encontrado.' };
  }
  // Serialized per mode: must never interleave with a generation/regeneration for this
  // document's mode (which could be evacuating or re-publishing the very file being trashed).
  return withModeLock(initialDocument.mode, () => deleteDocumentLocked(documentId, deps));
}

async function deleteDocumentLocked(documentId: string, deps: DeleteDeps): Promise<DeleteResult> {
  const document = getDocumentById(deps.db, documentId);
  if (!document) {
    return { ok: false, error: 'Documento não encontrado.' };
  }

  if (document.pdfAvailable) {
    try {
      await deps.trashItem(document.pdfPath);
      cleanupEmptyDirsUpward(dirname(document.pdfPath));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('error', 'failed to trash document pdf', { documentId, pdfPath: document.pdfPath, error: message });
      return { ok: false, error: message };
    }
  }

  deleteDocumentRecord(deps.db, documentId);
  log('info', 'document deleted', { documentId, batchId: document.batchId });
  return { ok: true };
}

/**
 * Trashes every managed PDF of a batch plus its archived source XLSX,
 * removes the batch and its document rows, and cleans up folders left
 * empty by the removal. Never touches the external original the batch was
 * imported from (only the internal Processados copy is trashed).
 */
export async function deleteBatch(batchId: string, deps: DeleteDeps): Promise<DeleteResult> {
  const initialBatch = getBatchById(deps.db, batchId);
  if (!initialBatch) {
    return { ok: false, error: 'Lote não encontrado.' };
  }
  // Serialized per mode: must never interleave with a generation/regeneration for this same
  // mode (which could be mid-regeneration of the very batch this call is about to remove).
  return withModeLock(initialBatch.mode, () => deleteBatchLocked(batchId, deps));
}

async function deleteBatchLocked(batchId: string, deps: DeleteDeps): Promise<DeleteResult> {
  const batch = getBatchById(deps.db, batchId);
  if (!batch) {
    return { ok: false, error: 'Lote não encontrado.' };
  }

  const documents = listDocumentsByBatch(deps.db, batchId);
  for (const document of documents) {
    if (!document.pdfAvailable) continue;
    try {
      await deps.trashItem(document.pdfPath);
      cleanupEmptyDirsUpward(dirname(document.pdfPath));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('warn', 'failed to trash a document pdf during batch delete', {
        batchId,
        pdfPath: document.pdfPath,
        error: message
      });
    }
  }

  if (batch.sourceArchivedPath && existsSync(batch.sourceArchivedPath)) {
    try {
      await deps.trashItem(batch.sourceArchivedPath);
      cleanupEmptyDirsUpward(dirname(batch.sourceArchivedPath));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log('warn', 'failed to trash archived source during batch delete', {
        batchId,
        sourceArchivedPath: batch.sourceArchivedPath,
        error: message
      });
    }
  }

  deleteBatchRecord(deps.db, batchId);
  log('info', 'batch deleted', { batchId, documentCount: documents.length });
  return { ok: true };
}
