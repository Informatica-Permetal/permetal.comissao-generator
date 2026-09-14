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

export interface HistoryDocument {
  id: string;
  batchId: string;
  mode: ReportMode;
  branchCode: string;
  branchName: string;
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
