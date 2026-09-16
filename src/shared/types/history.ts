import type { ReportMode } from '../constants/folders';

export interface HistoryFilters {
  mode?: ReportMode;
  sellerCode?: string;
  branchCode?: string;
  /** Matches against source file name or batch id (case-insensitive substring). */
  search?: string;
  /** ISO date (yyyy-MM-dd), inclusive. */
  dateFrom?: string;
  /** ISO date (yyyy-MM-dd), inclusive. */
  dateTo?: string;
}

/**
 * Explicit, persisted output-grouping strategy for a document. Never
 * inferred (e.g. from a filename) - always read back from `documents.grouping_mode`.
 */
export const GROUPING_MODES = ['separate_by_branch', 'consolidated_by_seller'] as const;
export type GroupingMode = (typeof GROUPING_MODES)[number];

/** One branch's contribution to a document - length 1 for `separate_by_branch`, length N for `consolidated_by_seller`. */
export interface DocumentBranchInfo {
  branchCode: string;
  branchName: string;
  rowCount: number;
  /** Formatted BRL subtotal for this branch alone - never recalculated, always the sum of that branch's own rows. */
  subtotal: string;
}

export interface HistoryDocument {
  id: string;
  batchId: string;
  mode: ReportMode;
  groupingMode: GroupingMode;
  /** Primary (first) branch - kept for simple sorting/back-compat; see `branches` for the full, authoritative list. */
  branchCode: string;
  branchName: string;
  /** Every branch included in this document, in generation order. */
  branches: DocumentBranchInfo[];
  sellerCode: string;
  sellerName: string;
  sourceRowCount: number;
  commissionTotal: string;
  pdfPath: string;
  pdfAvailable: boolean;
  generatedAt: string;
  sourceOriginalName: string;
}

export interface HistoryBatch {
  id: string;
  mode: ReportMode;
  sourceOriginalName: string;
  sourceArchivedPath: string | null;
  sourceHash: string;
  importedAt: string;
  sourceRowCount: number;
  outputCount: number;
  status: string;
}

export interface DeleteResult {
  ok: boolean;
  error?: string;
}

export interface RegenerateResult {
  ok: boolean;
  generatedCount?: number;
  missingBranchCodes?: string[];
  error?: string;
}
