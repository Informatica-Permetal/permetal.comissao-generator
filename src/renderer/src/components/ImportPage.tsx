import { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  FileStack,
  FolderOpen,
  Upload,
  Wand2,
  AlertTriangle,
  AlertCircle,
  FileCheck2,
  Printer,
  FolderOutput,
  RefreshCw,
  Users,
  X,
  Settings as SettingsIcon
} from 'lucide-react';
import type { ReportMode } from '@shared/constants/folders';
import type { BatchPreview, GroupingChoices, ImportServiceError, SourceKind } from '@shared/types/import';
import type { GroupingMode } from '@shared/types/history';
import type { GenerateReportResult } from '@shared/types/pdf';
import PageHeader from './PageHeader';
import { useToast } from './ToastProvider';
import { modeDisplayLabel } from '../lib/modeLabel';
import ImportHelp from './ImportHelp';

interface ImportPageProps {
  mode: ReportMode;
  title: string;
  onBack: () => void;
  onGoToSettings: () => void;
  onSwitchMode: (mode: ReportMode, sourcePath: string) => void;
  initialSourcePath?: string | null;
  onInitialSourceConsumed?: () => void;
}

type PageState =
  | { status: 'idle' }
  | { status: 'previewing' }
  | { status: 'previewError'; error: ImportServiceError; sourcePath: string }
  | { status: 'previewReady'; preview: BatchPreview }
  | { status: 'generating'; preview: BatchPreview }
  | { status: 'generated'; preview: BatchPreview; result: GenerateReportResult }
  | { status: 'generateError'; preview: BatchPreview; message: string };

const MODE_ICON: Record<ReportMode, typeof FileSpreadsheet> = {
  Previsao: FileSpreadsheet,
  Relacao: FileStack
};

export default function ImportPage({
  mode,
  title,
  onBack,
  onGoToSettings,
  onSwitchMode,
  initialSourcePath,
  onInitialSourceConsumed
}: ImportPageProps) {
  const [state, setState] = useState<PageState>({ status: 'idle' });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribe = window.api.reports.onEntradaFileDetected((payload) => {
      if (payload.mode !== mode) return;
      void runPreview(payload.filePath, 'entrada');
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (initialSourcePath) {
      void runPreview(initialSourcePath, 'external');
      onInitialSourceConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSourcePath]);

  async function runPreview(sourcePath: string, sourceKind: SourceKind): Promise<void> {
    setState({ status: 'previewing' });
    const result = await window.api.reports.previewImport(mode, sourcePath, sourceKind);
    if (result.ok) {
      setState({ status: 'previewReady', preview: result.preview });
    } else {
      setState({ status: 'previewError', error: result.error, sourcePath });
    }
  }

  async function handleChooseFile(): Promise<void> {
    const path = await window.api.reports.chooseSourceFile();
    if (path) void runPreview(path, 'external');
  }

  async function handleOpenEntradaFolder(): Promise<void> {
    await window.api.reports.openEntradaFolder(mode);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDraggingOver(true);
  }

  function handleDragLeave(): void {
    setIsDraggingOver(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDraggingOver(false);
    const file = event.dataTransfer.files[0];
    if (!file) return;
    const path = window.api.files.getPathForFile(file);
    if (path) void runPreview(path, 'external');
  }

  async function handleGenerate(groupingChoices: GroupingChoices): Promise<void> {
    if (state.status !== 'previewReady') return;
    const preview = state.preview;
    setState({ status: 'generating', preview });
    try {
      const result = await window.api.reports.generatePdfs(preview, groupingChoices);
      setState({ status: 'generated', preview, result });
      showToast('success', `${result.generated.length} PDF(s) gerado(s) com sucesso.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao gerar PDFs.';
      setState({ status: 'generateError', preview, message });
      showToast('error', message);
    }
  }

  async function handlePrint(pdfPath: string): Promise<void> {
    const result = await window.api.pdf.print(pdfPath);
    if (!result.ok) showToast('error', result.error ?? 'Falha ao imprimir.');
  }

  function reset(): void {
    setState({ status: 'idle' });
  }

  const Icon = MODE_ICON[mode];

  return (
    <section>
      <PageHeader icon={Icon} title={title} onBack={onBack} actions={<ImportHelp mode={mode} />} />

      {(state.status === 'idle' || state.status === 'previewing' || state.status === 'previewError') && (
        <>
          <div
            className={`dropzone card${isDraggingOver ? ' dropzone--active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span className="dropzone__icon">
              <Upload size={24} />
            </span>
            <p className="dropzone__title">Arraste seu relatório aqui</p>
            <p className="section-hint" style={{ margin: 0 }}>
              Aceita arquivos .xlsx exportados do Protheus Smart View
            </p>
            <div className="dropzone__actions">
              <button type="button" className="btn btn--primary" onClick={() => void handleChooseFile()}>
                <FileSpreadsheet size={16} /> Selecionar arquivo
              </button>
              <button type="button" className="btn" onClick={() => void handleOpenEntradaFolder()}>
                <FolderOpen size={16} /> Abrir pasta de entrada
              </button>
            </div>
            <p className="dropzone__hint">
              <FolderOutput size={13} /> A pasta de Entrada deste modo está sendo monitorada automaticamente
            </p>
          </div>

          {state.status === 'previewing' && (
            <div className="loading-row">
              <span className="spinner" />
              Lendo arquivo...
            </div>
          )}

          {state.status === 'previewError' && (
            <ImportErrorMessage error={state.error} sourcePath={state.sourcePath} onSwitchMode={onSwitchMode} />
          )}
        </>
      )}

      {state.status === 'previewReady' && (
        <PreviewSummary
          preview={state.preview}
          onConfirm={(groupingChoices) => void handleGenerate(groupingChoices)}
          onCancel={reset}
          onGoToSettings={onGoToSettings}
        />
      )}

      {state.status === 'generating' && (
        <div className="loading-row card" style={{ padding: 'var(--space-5)' }}>
          <span className="spinner" />
          Gerando PDFs...
        </div>
      )}

      {state.status === 'generateError' && (
        <div className="card" style={{ padding: 'var(--space-5)' }}>
          <div className="message-banner message-banner--error">
            <AlertCircle size={16} />
            {state.message}
          </div>
          <button type="button" className="btn" onClick={reset}>
            Tentar novamente
          </button>
        </div>
      )}

      {state.status === 'generated' && (
        <GeneratedResults result={state.result} onPrint={(path) => void handlePrint(path)} onNewFile={reset} />
      )}
    </section>
  );
}

function ImportErrorMessage({
  error,
  sourcePath,
  onSwitchMode
}: {
  error: ImportServiceError;
  sourcePath: string;
  onSwitchMode: (mode: ReportMode, sourcePath: string) => void;
}) {
  switch (error.kind) {
    case 'wrongMode':
      return (
        <div className="message-banner message-banner--warning">
          <AlertTriangle size={16} />
          <span>
            Este arquivo parece ser de <strong>{modeDisplayLabel(error.detectedMode)}</strong>, não de{' '}
            {modeDisplayLabel(error.expectedMode)}.{' '}
            <button type="button" className="btn btn--sm" onClick={() => onSwitchMode(error.detectedMode, sourcePath)}>
              Processar como {modeDisplayLabel(error.detectedMode)}
            </button>
          </span>
        </div>
      );
    case 'missingHeaders':
      return (
        <div className="message-banner message-banner--error">
          <AlertCircle size={16} />
          Colunas obrigatórias ausentes: {error.missingHeaders.join(', ')}
        </div>
      );
    case 'ambiguousHeader':
      return (
        <div className="message-banner message-banner--error">
          <AlertCircle size={16} />
          {error.message}
        </div>
      );
    case 'temporaryFile':
    case 'alreadyProcessing':
    case 'unsupportedFileType':
    case 'unreadable':
      return (
        <div className="message-banner message-banner--error">
          <AlertCircle size={16} />
          {error.message}
        </div>
      );
    default:
      return null;
  }
}

export function PreviewSummary({
  preview,
  onConfirm,
  onCancel,
  onGoToSettings
}: {
  preview: BatchPreview;
  onConfirm: (groupingChoices: GroupingChoices) => void;
  onCancel: () => void;
  onGoToSettings: () => void;
}) {
  const blocked = preview.missingBranchCodes.length > 0;
  const [groupingChoices, setGroupingChoices] = useState<GroupingChoices>({});

  function setChoice(sellerCode: string, mode: GroupingMode): void {
    setGroupingChoices((current) => ({ ...current, [sellerCode]: mode }));
  }

  function applyToAll(mode: GroupingMode): void {
    setGroupingChoices(
      Object.fromEntries(preview.multiBranchSellers.map((seller) => [seller.sellerCode, mode]))
    );
  }

  return (
    <div className="card preview-summary">
      <div className="section-title">{preview.sourceOriginalName}</div>

      <div className="preview-summary__grid">
        <div className="stat">
          <div className="stat__label">Linhas</div>
          <div className="stat__value">{preview.totalRows}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Vendedores</div>
          <div className="stat__value">{preview.sellerCount}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Filiais</div>
          <div className="stat__value">{preview.branchCount}</div>
        </div>
        <div className="stat">
          <div className="stat__label">Documentos</div>
          <div className="stat__value">{preview.documents.length}</div>
        </div>
      </div>

      {preview.multiBranchSellers.length > 0 && (
        <div className="multi-branch-panel">
          <div className="multi-branch-panel__header">
            <Users size={16} />
            <span>
              {preview.multiBranchSellers.length > 1
                ? `${preview.multiBranchSellers.length} vendedores possuem registros em mais de uma filial.`
                : 'Este vendedor possui registros em mais de uma filial.'}
            </span>
          </div>

          {preview.multiBranchSellers.map((seller) => {
            const mode = groupingChoices[seller.sellerCode] ?? 'separate_by_branch';
            return (
              <div className="multi-branch-panel__seller" key={seller.sellerCode}>
                <div className="multi-branch-panel__seller-info">
                  <strong>
                    {seller.sellerName} ({seller.sellerCode})
                  </strong>
                  <span className="multi-branch-panel__branches">Filiais: {seller.branchCodes.join(', ')}</span>
                </div>
                <div className="multi-branch-panel__options">
                  <label className="radio-option">
                    <input
                      type="radio"
                      name={`grouping-${seller.sellerCode}`}
                      checked={mode === 'separate_by_branch'}
                      onChange={() => setChoice(seller.sellerCode, 'separate_by_branch')}
                    />
                    Gerar separado por filial
                  </label>
                  <label className="radio-option">
                    <input
                      type="radio"
                      name={`grouping-${seller.sellerCode}`}
                      checked={mode === 'consolidated_by_seller'}
                      onChange={() => setChoice(seller.sellerCode, 'consolidated_by_seller')}
                    />
                    Gerar consolidado por vendedor
                  </label>
                  {preview.multiBranchSellers.length > 1 && (
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => applyToAll(mode)}
                      title="Aplicar esta escolha a todos os vendedores com múltiplas filiais"
                    >
                      Aplicar a todos
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview.previouslyProcessedAt && (
        <div className="message-banner message-banner--warning">
          <AlertTriangle size={16} />
          Este arquivo já foi processado em {new Date(preview.previouslyProcessedAt).toLocaleString('pt-BR')}. Deseja processar novamente?
        </div>
      )}

      {preview.warnings.length > 0 && (
        <div className="message-banner message-banner--warning">
          <AlertTriangle size={16} />
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {blocked && (
        <div className="message-banner message-banner--error">
          <AlertCircle size={16} />
          <span>
            Configure a(s) filial(is) antes de gerar: {preview.missingBranchCodes.join(', ')}{' '}
            <button type="button" className="btn btn--sm" onClick={onGoToSettings}>
              <SettingsIcon size={14} /> Ir para Configurações
            </button>
          </span>
        </div>
      )}

      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Filial</th>
              <th>Código</th>
              <th>Vendedor</th>
              <th>Linhas</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {preview.documents.map((document) => (
              <tr key={`${document.branchCode}-${document.sellerCode}`}>
                <td>{document.branchCode}</td>
                <td>{document.sellerCode}</td>
                <td>{document.sellerName}</td>
                <td>{document.rowCount}</td>
                <td className="num">{document.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="form-actions" style={{ padding: 0, border: 'none', marginTop: 'var(--space-4)' }}>
        <button type="button" className="btn btn--primary" onClick={() => onConfirm(groupingChoices)} disabled={blocked}>
          <Wand2 size={16} /> Gerar PDFs
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          <X size={16} /> Cancelar
        </button>
      </div>
    </div>
  );
}

function GeneratedResults({
  result,
  onPrint,
  onNewFile
}: {
  result: GenerateReportResult;
  onPrint: (pdfPath: string) => void;
  onNewFile: () => void;
}) {
  return (
    <div className="card preview-summary">
      <div className="message-banner message-banner--success">
        <FileCheck2 size={16} />
        {result.generated.length} PDF(s) gerado(s) com sucesso.
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Filial</th>
              <th>Vendedor</th>
              <th>Linhas</th>
              <th className="num">Total</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {result.generated.map((doc) => (
              <tr key={doc.filePath}>
                <td>
                  {doc.groupingMode === 'consolidated_by_seller' ? (
                    <>
                      <span className="badge badge--consolidated">Consolidado</span>
                      <div className="doc-branches-list">{doc.branches.map((b) => b.branchCode).join(', ')}</div>
                    </>
                  ) : (
                    <>
                      <span className="badge badge--separado">Separado</span>
                      <div className="doc-branches-list">{doc.branchCode}</div>
                    </>
                  )}
                </td>
                <td>
                  {doc.sellerName} ({doc.sellerCode})
                </td>
                <td>{doc.rowCount}</td>
                <td className="num">{doc.total}</td>
                <td>
                  <div className="data-table__actions">
                    <button type="button" className="icon-btn" data-tooltip="Abrir PDF" onClick={() => void window.api.pdf.open(doc.filePath)}>
                      <FileCheck2 size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      data-tooltip="Abrir pasta"
                      onClick={() => void window.api.pdf.openFolder(doc.filePath)}
                    >
                      <FolderOpen size={16} />
                    </button>
                    <button type="button" className="icon-btn" data-tooltip="Imprimir" onClick={() => onPrint(doc.filePath)}>
                      <Printer size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn" style={{ marginTop: 'var(--space-4)' }} onClick={onNewFile}>
        <RefreshCw size={16} /> Importar outro arquivo
      </button>
    </div>
  );
}
