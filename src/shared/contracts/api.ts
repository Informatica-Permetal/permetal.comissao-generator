import type { AppState, CompleteFirstRunResult, FolderPermissionResult } from '../types/settings';
import type { CompanyProfileInput, CompanyProfileWithLogoPreview } from '../types/companyProfile';
import type { GenerateReportResult, PrintPdfResult } from '../types/pdf';
import type { EntradaFileDetectedPayload, ImportResult, SourceKind } from '../types/import';
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
    upsert(input: CompanyProfileInput): Promise<CompanyProfileWithLogoPreview>;
    chooseLogo(branchCode: string): Promise<CompanyProfileWithLogoPreview | null>;
  };
  reports: {
    chooseSourceFile(): Promise<string | null>;
    openEntradaFolder(mode: ReportMode): Promise<void>;
    previewImport(mode: ReportMode, sourcePath: string, sourceKind: SourceKind): Promise<ImportResult>;
    generatePdfs(mode: ReportMode, filePath: string): Promise<GenerateReportResult>;
    onEntradaFileDetected(callback: (payload: EntradaFileDetectedPayload) => void): () => void;
  };
  pdf: {
    open(filePath: string): Promise<string | null>;
    openFolder(filePath: string): Promise<void>;
    print(filePath: string): Promise<PrintPdfResult>;
  };
  files: {
    /** Resolves the real filesystem path of a file dropped onto the window (drag-and-drop). */
    getPathForFile(file: File): string;
  };
}
