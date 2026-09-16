import type { ReportMode } from '../constants/folders';
import type { GroupingMode } from './history';

export type SourceKind = 'entrada' | 'external';

export interface ImportRequest {
  mode: ReportMode;
  sourcePath: string;
  sourceKind: SourceKind;
}

export interface BatchPreviewDocument {
  branchCode: string;
  sellerCode: string;
  sellerName: string;
  rowCount: number;
  total: string;
}

/** A seller with rows in more than one branch within this same import - triggers the separado/consolidado choice. */
export interface MultiBranchSeller {
  sellerCode: string;
  sellerName: string;
  branchCodes: string[];
}

export interface BatchPreview {
  batchId: string;
  mode: ReportMode;
  sourceOriginalName: string;
  /** Absolute path of the original file (Entrada or external) - never written to, only read. */
  sourcePath: string;
  workspaceFilePath: string;
  sourceKind: SourceKind;
  sourceHash: string;
  totalRows: number;
  sellerCount: number;
  branchCount: number;
  documents: BatchPreviewDocument[];
  /** Empty when no seller in this import spans more than one branch. */
  multiBranchSellers: MultiBranchSeller[];
  warnings: string[];
  missingBranchCodes: string[];
  previouslyProcessedAt: string | null;
}

/** User's grouping choice per multi-branch seller code; a seller absent from this map defaults to `separate_by_branch`. */
export type GroupingChoices = Record<string, GroupingMode>;

export type ImportServiceError =
  | { kind: 'unsupportedFileType'; message: string }
  | { kind: 'temporaryFile'; message: string }
  | { kind: 'alreadyProcessing'; message: string }
  | { kind: 'wrongMode'; expectedMode: ReportMode; detectedMode: ReportMode }
  | { kind: 'missingHeaders'; mode: ReportMode; missingHeaders: string[] }
  | { kind: 'ambiguousHeader'; mode: ReportMode; header: string; occurrences: number; message: string }
  | { kind: 'unreadable'; message: string };

export type ImportResult = { ok: true; preview: BatchPreview } | { ok: false; error: ImportServiceError };

export interface EntradaFileDetectedPayload {
  mode: ReportMode;
  filePath: string;
}
