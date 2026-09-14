import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { ReportMode } from '@shared/constants/folders';
import { resolveGeradosDir, resolveUniqueOutputPath } from '../pdf/outputPath';
import { listDocumentsInGerados, updateDocumentPdfPath } from '../storage/documentRepository';
import { resolveHistoricoDir } from './archivePaths';
import { moveFileSafely } from './moveFileSafely';

export interface EvacuateResult {
  movedDocumentCount: number;
  movedBatchIds: string[];
}

/**
 * Moves every document currently published in `<reportRoot>/<mode>/Gerados/`
 * into `Historico/YYYY/MM/<batchId>/`, keyed by each document's own batch and
 * generation date - so multiple leftover batches (e.g. after a crash) are
 * each filed under their own history folder, never merged or overwritten.
 * Must run before a new batch's PDFs are written to Gerados.
 */
export function evacuateGeradosToHistorico(db: DatabaseSync, reportRoot: string, mode: ReportMode): EvacuateResult {
  const geradosDir = resolveGeradosDir(reportRoot, mode);
  const documents = listDocumentsInGerados(db, mode, geradosDir);

  let movedDocumentCount = 0;
  const movedBatchIds = new Set<string>();

  for (const document of documents) {
    if (!document.pdfPath || !existsSync(document.pdfPath)) continue;

    const historicoDir = resolveHistoricoDir(reportRoot, mode, new Date(document.generatedAt), document.batchId);
    // Never overwrites: a target name already occupied (e.g. this same batch evacuated
    // more than once on the same day, which produces the same deterministic file name)
    // gets a numeric suffix instead of clobbering the earlier historical PDF.
    const targetPath = resolveUniqueOutputPath(historicoDir, basename(document.pdfPath));

    moveFileSafely(document.pdfPath, targetPath);
    updateDocumentPdfPath(db, document.id, targetPath);
    movedDocumentCount++;
    movedBatchIds.add(document.batchId);
  }

  return { movedDocumentCount, movedBatchIds: [...movedBatchIds] };
}
