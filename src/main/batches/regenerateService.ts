import { existsSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import type { CompanyGroup, CompanyProfile } from '@shared/types/companyProfile';
import type { RegenerateResult } from '@shared/types/history';
import { findUnconfiguredBranchCodes } from '../companies/branchConfiguration';
import { parsePrevisaoFile } from '../reports/previsao/parser';
import { parseRelacaoFile } from '../reports/relacao/parser';
import { getBatchById } from '../storage/batchRepository';
import { getDocumentById } from '../storage/documentRepository';
import { getBatchSellerGroupingModes } from '../storage/batchSellerGroupingRepository';
import type { RenderPdfOptions } from '../pdf/renderPdf';
import { log } from '../app/logger';
import { publishGeneratedDocuments } from './batchLifecycle';
import { withModeLock } from './modeLock';

export interface RegenerateDeps {
  db: DatabaseSync;
  reportRoot: string;
  lookupCompanyProfile: (branchCode: string) => CompanyProfile | null;
  lookupCompanyGroup?: (groupKey: string | null) => CompanyGroup | null;
  renderPdf: (html: string, options: RenderPdfOptions) => Promise<Buffer>;
}

/**
 * Re-renders every document of an already-completed batch from its archived
 * source (Fase 2 parser, Fase 4 template and current company profiles -
 * none of that is reimplemented here). The freshly rendered PDFs become the
 * mode's current Gerados batch; whatever previously occupied Gerados
 * (including this same batch's own earlier rendering) is evacuated to
 * Historico first, so nothing is ever overwritten in place. The batch's own
 * `completed` status and history are left untouched - a failed regeneration
 * attempt never corrupts an already-good batch.
 */
export async function regenerateBatch(batchId: string, deps: RegenerateDeps): Promise<RegenerateResult> {
  // The mode is needed to pick the lock before any mutation starts; a fresh read happens
  // again inside the lock, so a batch deleted between this check and lock acquisition is
  // still handled correctly (as "not found"), never as a crash or a lost/duplicated write.
  const initialBatch = getBatchById(deps.db, batchId);
  if (!initialBatch) {
    return { ok: false, error: 'Lote não encontrado.' };
  }
  // Serialized per mode: must never interleave with a generation, another regeneration, or a
  // deletion of this same batch for the same mode - all of them evacuate/write Gerados or
  // remove the very batch/document rows this function is about to read and insert into.
  return withModeLock(initialBatch.mode, () => regenerateBatchLocked(batchId, deps));
}

async function regenerateBatchLocked(batchId: string, deps: RegenerateDeps): Promise<RegenerateResult> {
  const { db, reportRoot, lookupCompanyProfile, lookupCompanyGroup, renderPdf } = deps;

  const batch = getBatchById(db, batchId);
  if (!batch) {
    return { ok: false, error: 'Lote não encontrado.' };
  }
  if (!batch.sourceArchivedPath || !existsSync(batch.sourceArchivedPath)) {
    return { ok: false, error: 'Arquivo de origem arquivado não foi encontrado. Não é possível regenerar.' };
  }

  try {
    const parseResult =
      batch.mode === 'Previsao'
        ? await parsePrevisaoFile(batch.sourceArchivedPath)
        : await parseRelacaoFile(batch.sourceArchivedPath);

    const missingBranchCodes = findUnconfiguredBranchCodes(parseResult.groups, lookupCompanyProfile);
    if (missingBranchCodes.length > 0) {
      return {
        ok: false,
        missingBranchCodes,
        error: 'Existem filiais sem cadastro configurado. Configure antes de regenerar.'
      };
    }

    const generatedAt = new Date();
    // Read from the batch-level record, not from whatever `documents` rows happen to still
    // exist - so deleting a seller's only document never erases the memory of its mode.
    const modeBySeller = getBatchSellerGroupingModes(db, batch.id);
    const result = await publishGeneratedDocuments(batch.mode, batch.id, parseResult, generatedAt, {
      db,
      reportRoot,
      lookupCompanyProfile,
      lookupCompanyGroup,
      renderPdf,
      modeBySeller
    });

    log('info', 'batch regenerated', { batchId, mode: batch.mode, outputCount: result.generated.length });
    return { ok: true, generatedCount: result.generated.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('error', 'batch regeneration failed', { batchId, mode: batch.mode, error: message });
    return { ok: false, error: message };
  }
}

/** Regenerates the whole batch a single document belongs to - Fase 4's generator only ever renders a full batch at once. */
export async function regenerateDocument(documentId: string, deps: RegenerateDeps): Promise<RegenerateResult> {
  const document = getDocumentById(deps.db, documentId);
  if (!document) {
    return { ok: false, error: 'Documento não encontrado.' };
  }
  return regenerateBatch(document.batchId, deps);
}
