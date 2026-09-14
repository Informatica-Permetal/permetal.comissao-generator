import { existsSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { CompanyProfile } from '@shared/types/companyProfile';
import type { ReportMode } from '@shared/constants/folders';
import type { SourceKind } from '@shared/types/import';
import type { GenerateReportResult } from '@shared/types/pdf';
import { findUnconfiguredBranchCodes } from '../companies/branchConfiguration';
import { computeFileHashSync } from '../import/computeFileHash';
import { parsePrevisaoFile, type PrevisaoParseResult } from '../reports/previsao/parser';
import { parseRelacaoFile, type RelacaoParseResult } from '../reports/relacao/parser';
import {
  generatePrevisaoPdfs,
  generateRelacaoPdfs,
  type GenerateReportPdfsDeps
} from '../pdf/generateReportPdfs';
import type { RenderPdfOptions } from '../pdf/renderPdf';
import {
  insertBatch,
  updateBatchArchivedPath,
  updateBatchOutputCount,
  updateBatchStatus
} from '../storage/batchRepository';
import { insertDocument } from '../storage/documentRepository';
import { archiveSourceFile } from './archiveSource';
import { evacuateGeradosToHistorico } from './evacuateGerados';
import { resolveProcessamentoDir } from './archivePaths';
import { withModeLock } from './modeLock';
import { log } from '../app/logger';

export interface RunBatchGenerationParams {
  mode: ReportMode;
  batchId: string;
  sourcePath: string;
  sourceKind: SourceKind;
  workspaceFilePath: string;
}

export interface RunBatchGenerationDeps {
  db: DatabaseSync;
  reportRoot: string;
  lookupCompanyProfile: (branchCode: string) => CompanyProfile | null;
  appVersion: string;
  /** Injected so this can be unit-tested without a real Electron BrowserWindow. */
  renderPdf: (html: string, options: RenderPdfOptions) => Promise<Buffer>;
}

export const TEMPLATE_VERSION = '1';

export interface PublishDeps {
  db: DatabaseSync;
  reportRoot: string;
  lookupCompanyProfile: (branchCode: string) => CompanyProfile | null;
  renderPdf: (html: string, options: RenderPdfOptions) => Promise<Buffer>;
}

/**
 * The part of the lifecycle shared by a first-time generation and a later
 * regeneration: evacuate whatever currently occupies the mode's Gerados
 * folder to Historico, run the unchanged Fase 4 generator, verify every PDF
 * is real and non-empty, persist one `documents` row per generated PDF, and
 * update the batch's output count. Does NOT touch the source file or the
 * batch's own status - callers decide what "done" means for their case.
 */
export async function publishGeneratedDocuments(
  mode: ReportMode,
  batchId: string,
  parseResult: PrevisaoParseResult | RelacaoParseResult,
  generatedAt: Date,
  deps: PublishDeps
): Promise<GenerateReportResult> {
  const { db, reportRoot, lookupCompanyProfile, renderPdf } = deps;

  evacuateGeradosToHistorico(db, reportRoot, mode);

  const genDeps: GenerateReportPdfsDeps = { reportRoot, generatedAt, lookupCompanyProfile, renderPdf };
  const result =
    mode === 'Previsao'
      ? await generatePrevisaoPdfs(parseResult as PrevisaoParseResult, genDeps)
      : await generateRelacaoPdfs(parseResult as RelacaoParseResult, genDeps);

  for (const document of result.generated) {
    if (!existsSync(document.filePath) || statSync(document.filePath).size === 0) {
      // No documents row is inserted for ANY file from this attempt below - clean up every
      // PDF it already wrote so none are left stranded on disk, untracked by the database
      // and invisible to future evacuation/History/delete (which all query by documents row).
      for (const generated of result.generated) {
        try {
          if (existsSync(generated.filePath)) unlinkSync(generated.filePath);
        } catch (cleanupError) {
          log('warn', 'failed to clean up an orphaned PDF after a verification failure', {
            filePath: generated.filePath,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          });
        }
      }
      throw new Error(`PDF invalido ou vazio: ${document.filePath}`);
    }
  }

  for (const document of result.generated) {
    insertDocument(db, {
      id: randomUUID(),
      batchId,
      mode,
      branchCode: document.branchCode,
      branchName: lookupCompanyProfile(document.branchCode)?.displayName ?? document.branchCode,
      sellerCode: document.sellerCode,
      sellerName: document.sellerName,
      sourceRowCount: document.rowCount,
      commissionTotal: document.total,
      pdfPath: document.filePath,
      generatedAt: generatedAt.toISOString(),
      templateVersion: TEMPLATE_VERSION
    });
  }
  updateBatchOutputCount(db, batchId, result.generated.length);

  return result;
}

/**
 * Wraps the existing Fase 4 generator with the full batch lifecycle: evacuate
 * the mode's current Gerados batch to Historico, generate (unchanged Fase 4
 * code), verify every PDF is real and non-empty, archive the source into
 * Processados, remove the Entrada original only after everything else
 * succeeded, and persist batch+document rows. The batch only ever reaches
 * `completed` after all of that - any failure along the way leaves it
 * `failed` with the source workspace copy intact for diagnosis.
 */
export async function runBatchGeneration(
  params: RunBatchGenerationParams,
  deps: RunBatchGenerationDeps
): Promise<GenerateReportResult> {
  const { mode } = params;
  // Serialized per mode: two generations (or a generation and a regeneration/delete) for the
  // same mode must never interleave their evacuate-Gerados/generate/persist steps.
  return withModeLock(mode, () => runBatchGenerationLocked(params, deps));
}

async function runBatchGenerationLocked(
  params: RunBatchGenerationParams,
  deps: RunBatchGenerationDeps
): Promise<GenerateReportResult> {
  const { mode, batchId, sourcePath, sourceKind, workspaceFilePath } = params;
  const { db, reportRoot, lookupCompanyProfile, appVersion, renderPdf } = deps;

  const parseResult =
    mode === 'Previsao' ? await parsePrevisaoFile(workspaceFilePath) : await parseRelacaoFile(workspaceFilePath);

  const missingBranchCodes = findUnconfiguredBranchCodes(parseResult.groups, lookupCompanyProfile);
  if (missingBranchCodes.length > 0) {
    // Nothing persisted, nothing published - exactly the pre-existing Fase 4 contract.
    return { generated: [], missingBranchCodes };
  }

  const generatedAt = new Date();
  const sourceOriginalName = basename(sourcePath);
  const sourceHash = computeFileHashSync(workspaceFilePath);

  insertBatch(db, {
    id: batchId,
    mode,
    sourceOriginalName,
    sourceHash,
    importedAt: generatedAt.toISOString(),
    sourceRowCount: parseResult.rows.length,
    outputCount: 0,
    status: 'generating',
    appVersion
  });

  try {
    const result = await publishGeneratedDocuments(mode, batchId, parseResult, generatedAt, {
      db,
      reportRoot,
      lookupCompanyProfile,
      renderPdf
    });

    updateBatchStatus(db, batchId, 'archiving');
    const archivedPath = archiveSourceFile(reportRoot, mode, generatedAt, batchId, workspaceFilePath);
    updateBatchArchivedPath(db, batchId, archivedPath);

    removeEntradaOriginalIfApplicable(reportRoot, mode, sourceKind, sourcePath, workspaceFilePath);

    cleanupProcessamentoWorkspace(reportRoot, mode, batchId);

    updateBatchStatus(db, batchId, 'completed');
    log('info', 'batch completed', { batchId, mode, outputCount: result.generated.length });
    return result;
  } catch (error) {
    updateBatchStatus(db, batchId, 'failed');
    const message = error instanceof Error ? error.message : String(error);
    log('error', 'batch failed', { batchId, mode, error: message, workspaceFilePath });
    throw error;
  }
}

function removeEntradaOriginalIfApplicable(
  reportRoot: string,
  mode: ReportMode,
  sourceKind: SourceKind,
  sourcePath: string,
  workspaceFilePath: string
): void {
  if (sourceKind !== 'entrada') return;
  if (sourcePath === workspaceFilePath) return;

  const entradaDir = join(reportRoot, mode, 'Entrada');
  if (!sourcePath.startsWith(entradaDir)) return; // defensive: only ever touch files truly inside Entrada
  if (!existsSync(sourcePath)) return;

  try {
    unlinkSync(sourcePath);
  } catch (error) {
    // Best-effort: the source is already safely archived in Processados, so a
    // failure to clear the Entrada copy is a warning, never a batch failure.
    log('warn', 'failed to remove Entrada original after archiving', {
      sourcePath,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

function cleanupProcessamentoWorkspace(reportRoot: string, mode: ReportMode, batchId: string): void {
  const workspaceDir = resolveProcessamentoDir(reportRoot, mode, batchId);
  try {
    rmSync(workspaceDir, { recursive: true, force: true });
  } catch (error) {
    log('warn', 'failed to clean Processamento workspace', {
      workspaceDir,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
