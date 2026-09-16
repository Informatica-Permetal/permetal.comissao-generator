import { copyFileSync, mkdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { CompanyProfile } from '@shared/types/companyProfile';
import type { BatchPreview, ImportRequest, ImportResult } from '@shared/types/import';
import { findUnconfiguredBranchCodes } from '../companies/branchConfiguration';
import { findMultiBranchSellers } from '../reports/common/grouping';
import { formatCurrencyBRL } from '../pdf/format';
import { AmbiguousHeaderError, MissingHeadersError, WrongModeError } from '../reports/common/errors';
import { parsePrevisaoFile } from '../reports/previsao/parser';
import { parseRelacaoFile } from '../reports/relacao/parser';
import { findLatestBatchBySourceHash } from '../storage/batchRepository';
import { resolveProcessamentoDir } from '../batches/archivePaths';
import { computeFileHashSync } from './computeFileHash';

export interface ImportServiceDeps {
  db: DatabaseSync;
  reportRoot: string;
  lookupCompanyProfile: (branchCode: string) => CompanyProfile | null;
}

/**
 * Paths currently being imported, across drag-drop/picker/watcher alike -
 * guards against the same file being processed twice concurrently.
 */
const activeImportPaths = new Set<string>();

/**
 * The single import pipeline shared by drag-drop, the file picker, and the
 * Entrada watcher. Never mutates `sourcePath`: it only ever reads it once to
 * copy into an isolated Processamento workspace before parsing.
 */
export async function importFile(request: ImportRequest, deps: ImportServiceDeps): Promise<ImportResult> {
  const fileName = basename(request.sourcePath);

  if (fileName.startsWith('~$')) {
    return {
      ok: false,
      error: { kind: 'temporaryFile', message: `Arquivo temporário do Excel ignorado: ${fileName}` }
    };
  }
  if (extname(fileName).toLowerCase() !== '.xlsx') {
    return {
      ok: false,
      error: { kind: 'unsupportedFileType', message: `Apenas arquivos .xlsx são aceitos: ${fileName}` }
    };
  }
  if (activeImportPaths.has(request.sourcePath)) {
    return {
      ok: false,
      error: { kind: 'alreadyProcessing', message: `Este arquivo já está sendo processado: ${fileName}` }
    };
  }

  activeImportPaths.add(request.sourcePath);
  try {
    return await runImport(request, deps, fileName);
  } finally {
    activeImportPaths.delete(request.sourcePath);
  }
}

async function runImport(request: ImportRequest, deps: ImportServiceDeps, fileName: string): Promise<ImportResult> {
  const { mode, sourcePath, sourceKind } = request;
  const { db, reportRoot, lookupCompanyProfile } = deps;

  const batchId = randomUUID();
  const workspaceDir = resolveProcessamentoDir(reportRoot, mode, batchId);
  mkdirSync(workspaceDir, { recursive: true });
  const workspaceFilePath = join(workspaceDir, fileName);
  copyFileSync(sourcePath, workspaceFilePath);

  const sourceHash = computeFileHashSync(workspaceFilePath);

  try {
    const parseResult =
      mode === 'Previsao' ? await parsePrevisaoFile(workspaceFilePath) : await parseRelacaoFile(workspaceFilePath);

    const missingBranchCodes = findUnconfiguredBranchCodes(parseResult.groups, lookupCompanyProfile);
    const previousBatch = findLatestBatchBySourceHash(db, sourceHash);

    const preview: BatchPreview = {
      batchId,
      mode,
      sourceOriginalName: fileName,
      sourcePath,
      workspaceFilePath,
      sourceKind,
      sourceHash,
      totalRows: parseResult.rows.length,
      sellerCount: new Set(parseResult.groups.map((group) => group.sellerCode)).size,
      branchCount: new Set(parseResult.groups.map((group) => group.branchCode)).size,
      documents: parseResult.groups.map((group) => ({
        branchCode: group.branchCode,
        sellerCode: group.sellerCode,
        sellerName: group.sellerName,
        rowCount: group.rows.length,
        total: formatCurrencyBRL(group.total)
      })),
      multiBranchSellers: findMultiBranchSellers(parseResult.groups),
      warnings: parseResult.warnings,
      missingBranchCodes,
      previouslyProcessedAt: previousBatch?.importedAt ?? null
    };

    return { ok: true, preview };
  } catch (error) {
    if (error instanceof WrongModeError) {
      return {
        ok: false,
        error: { kind: 'wrongMode', expectedMode: error.expectedMode, detectedMode: error.detectedMode }
      };
    }
    if (error instanceof MissingHeadersError) {
      return { ok: false, error: { kind: 'missingHeaders', mode: error.mode, missingHeaders: error.missingHeaders } };
    }
    if (error instanceof AmbiguousHeaderError) {
      return {
        ok: false,
        error: {
          kind: 'ambiguousHeader',
          mode: error.mode,
          header: error.header,
          occurrences: error.occurrences,
          message: error.message
        }
      };
    }
    return {
      ok: false,
      error: { kind: 'unreadable', message: error instanceof Error ? error.message : String(error) }
    };
  }
}
