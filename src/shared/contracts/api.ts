import type { AppState, CompleteFirstRunResult, FolderPermissionResult } from '../types/settings';
import type {
  CompanyGroup,
  CompanyProfileInput,
  CompanyProfileWithLogoPreview,
  DeleteCompanyProfileResult
} from '../types/companyProfile';
import type { GenerateReportResult, PrintPdfResult } from '../types/pdf';
import type { BatchPreview, EntradaFileDetectedPayload, ImportResult, SourceKind } from '../types/import';
import type {
  DeleteResult,
  HistoryBatch,
  HistoryDocument,
  HistoryFilters,
  RegenerateResult
} from '../types/history';
import type { ReportMode } from '../constants/folders';

/**
 * The full surface the preload exposes on window.api. Kept intentionally narrow:
 * one typed method per allowed operation, no generic fs/shell/ipcRenderer passthrough.
 */
export interface FormatadorComissaoApi {
  settings: {
    getState(): Promise<AppState>;
    chooseFolder(currentPath?: string): Promise<string | null>;
    testFolder(path: string): Promise<FolderPermissionResult>;
    completeFirstRun(reportRoot: string): Promise<CompleteFirstRunResult>;
  };
  companies: {
    list(): Promise<CompanyProfileWithLogoPreview[]>;
    listGroups(): Promise<CompanyGroup[]>;
    upsert(input: CompanyProfileInput): Promise<CompanyProfileWithLogoPreview>;
    chooseLogo(branchCode: string): Promise<CompanyProfileWithLogoPreview | null>;
    setActive(branchCode: string, active: boolean): Promise<CompanyProfileWithLogoPreview | null>;
    delete(branchCode: string): Promise<DeleteCompanyProfileResult>;
  };
  reports: {
    chooseSourceFile(): Promise<string | null>;
    openEntradaFolder(mode: ReportMode): Promise<void>;
    previewImport(mode: ReportMode, sourcePath: string, sourceKind: SourceKind): Promise<ImportResult>;
    /** Runs the full Fase 5 lifecycle (evacuate, generate, archive, persist) for a previewed batch. */
    generatePdfs(preview: BatchPreview): Promise<GenerateReportResult>;
    onEntradaFileDetected(callback: (payload: EntradaFileDetectedPayload) => void): () => void;
  };
  pdf: {
    open(filePath: string): Promise<string | null>;
    openFolder(filePath: string): Promise<void>;
    print(filePath: string): Promise<PrintPdfResult>;
  };
  history: {
    list(filters: HistoryFilters): Promise<HistoryDocument[]>;
    getBatch(batchId: string): Promise<HistoryBatch | null>;
    deleteDocument(documentId: string): Promise<DeleteResult>;
    deleteBatch(batchId: string): Promise<DeleteResult>;
    regenerateDocument(documentId: string): Promise<RegenerateResult>;
    regenerateBatch(batchId: string): Promise<RegenerateResult>;
  };
  files: {
    /** Resolves the real filesystem path of a file dropped onto the window (drag-and-drop). */
    getPathForFile(file: File): string;
  };
}
