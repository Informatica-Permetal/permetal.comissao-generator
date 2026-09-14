export interface GeneratedPdfInfo {
  branchCode: string;
  sellerCode: string;
  sellerName: string;
  filePath: string;
  total: string;
  rowCount: number;
}

export interface GenerateReportResult {
  generated: GeneratedPdfInfo[];
  missingBranchCodes: string[];
}

export interface PrintPdfResult {
  ok: boolean;
  error?: string;
}
