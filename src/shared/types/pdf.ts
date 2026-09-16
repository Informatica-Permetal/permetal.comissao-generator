import type { DocumentBranchInfo, GroupingMode } from './history';

export interface GeneratedPdfInfo {
  groupingMode: GroupingMode;
  /** Primary (first) branch - see `branches` for the full list, always authoritative. */
  branchCode: string;
  sellerCode: string;
  sellerName: string;
  filePath: string;
  /** Grand total - for `consolidated_by_seller`, the sum of every branch's own subtotal. */
  total: string;
  rowCount: number;
  branches: DocumentBranchInfo[];
}

export interface GenerateReportResult {
  generated: GeneratedPdfInfo[];
  missingBranchCodes: string[];
}

export interface PrintPdfResult {
  ok: boolean;
  error?: string;
}
