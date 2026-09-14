import { useEffect, useState } from 'react';
import type { ReportMode } from '@shared/constants/folders';
import type { BatchPreview, ImportServiceError, SourceKind } from '@shared/types/import';
import type { GenerateReportResult } from '@shared/types/pdf';

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
  const [printMessage, setPrintMessage] = useState<string | null>(null);

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

  async function handleGenerate(): Promise<void> {
    if (state.status !== 'previewReady') return;
    const preview = state.preview;
    setState({ status: 'generating', preview });
    try {
      const result = await window.api.reports.generatePdfs(preview);
      setState({ status: 'generated', preview, result });
    } catch (error) {
      setState({
        status: 'generateError',
        preview,
        message: error instanceof Error ? error.message : 'Falha ao gerar PDFs.'
      });
    }
  }

  async function handlePrint(pdfPath: string): Promise<void> {
    setPrintMessage(null);
    const result = await window.api.pdf.print(pdfPath);
    if (!result.ok) setPrintMessage(result.error ?? 'Falha ao imprimir.');
  }

  function reset(): void {
    setState({ status: 'idle' });
    setPrintMessage(null);
  }

  return (
    <section className="import-page">
      <h2>{title}</h2>

      {(state.status === 'idle' || state.status === 'previewing' || state.status === 'previewError') && (
        <>
          <div
            className={`import-page__dropzone${isDraggingOver ? ' import-page__dropzone--active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <p>Arraste um arquivo .xlsx aqui</p>
            <div className="import-page__actions">
              <button type="button" onClick={() => void handleChooseFile()}>
                + Selecionar arquivo
              </button>
              <button type="button" onClick={() => void handleOpenEntradaFolder()}>
                Abrir pasta de entrada
              </button>
            </div>
            <p className="import-page__hint">
              A pasta de Entrada deste modo esta sendo monitorada automaticamente.
            </p>
          </div>

          {state.status === 'previewing' && <p>Lendo arquivo...</p>}

          {state.status === 'previewError' && (
            <ImportErrorMessage
              error={state.error}
              sourcePath={state.sourcePath}
              onSwitchMode={onSwitchMode}
            />
          )}

          <button type="button" onClick={onBack}>
            Voltar
          </button>
        </>
      )}

      {state.status === 'previewReady' && (
        <PreviewSummary
          preview={state.preview}
          onConfirm={() => void handleGenerate()}
          onCancel={reset}
          onGoToSettings={onGoToSettings}
        />
      )}

      {state.status === 'generating' && <p>Gerando PDFs...</p>}

      {state.status === 'generateError' && (
        <div>
          <p className="import-page__error">{state.message}</p>
          <button type="button" onClick={reset}>
            Tentar novamente
          </button>
        </div>
      )}

      {state.status === 'generated' && (
        <GeneratedResults
          result={state.result}
          printMessage={printMessage}
          onPrint={(path) => void handlePrint(path)}
          onNewFile={reset}
        />
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
        <div className="import-page__error">
          <p>
            Este arquivo parece ser de <strong>{error.detectedMode}</strong>, nao de {error.expectedMode}.
          </p>
          <button type="button" onClick={() => onSwitchMode(error.detectedMode, sourcePath)}>
            Processar como {error.detectedMode}
          </button>
        </div>
      );
    case 'missingHeaders':
      return (
        <p className="import-page__error">
          Colunas obrigatorias ausentes: {error.missingHeaders.join(', ')}
        </p>
      );
    case 'temporaryFile':
    case 'alreadyProcessing':
    case 'unsupportedFileType':
    case 'unreadable':
      return <p className="import-page__error">{error.message}</p>;
    default:
      return null;
  }
}

function PreviewSummary({
  preview,
  onConfirm,
  onCancel,
  onGoToSettings
}: {
  preview: BatchPreview;
  onConfirm: () => void;
  onCancel: () => void;
  onGoToSettings: () => void;
}) {
  const blocked = preview.missingBranchCodes.length > 0;

  return (
    <div className="import-page__preview">
      <dl className="import-page__summary">
        <dt>Arquivo</dt>
        <dd>{preview.sourceOriginalName}</dd>
        <dt>Linhas</dt>
        <dd>{preview.totalRows}</dd>
        <dt>Vendedores</dt>
        <dd>{preview.sellerCount}</dd>
        <dt>Filiais</dt>
        <dd>{preview.branchCount}</dd>
        <dt>Documentos a gerar</dt>
        <dd>{preview.documents.length}</dd>
      </dl>

      {preview.previouslyProcessedAt && (
        <p className="import-page__warning">
          Este arquivo ja foi processado em {new Date(preview.previouslyProcessedAt).toLocaleString('pt-BR')}.
          Deseja processar novamente?
        </p>
      )}

      {preview.warnings.length > 0 && (
        <ul className="import-page__warning">
          {preview.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      {blocked && (
        <div className="import-page__error">
          <p>Configure a(s) filial(is) antes de gerar: {preview.missingBranchCodes.join(', ')}</p>
          <button type="button" onClick={onGoToSettings}>
            Ir para Configuracoes
          </button>
        </div>
      )}

      <table className="import-page__table">
        <thead>
          <tr>
            <th>Filial</th>
            <th>Codigo</th>
            <th>Vendedor</th>
            <th>Linhas</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {preview.documents.map((document) => (
            <tr key={`${document.branchCode}-${document.sellerCode}`}>
              <td>{document.branchCode}</td>
              <td>{document.sellerCode}</td>
              <td>{document.sellerName}</td>
              <td>{document.rowCount}</td>
              <td>{document.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="import-page__actions">
        <button type="button" onClick={onConfirm} disabled={blocked}>
          Gerar PDFs
        </button>
        <button type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

function GeneratedResults({
  result,
  printMessage,
  onPrint,
  onNewFile
}: {
  result: GenerateReportResult;
  printMessage: string | null;
  onPrint: (pdfPath: string) => void;
  onNewFile: () => void;
}) {
  return (
    <div>
      <p>{result.generated.length} PDF(s) gerado(s) com sucesso.</p>
      {printMessage && <p className="import-page__error">{printMessage}</p>}
      <table className="import-page__table">
        <thead>
          <tr>
            <th>Filial</th>
            <th>Vendedor</th>
            <th>Linhas</th>
            <th>Total</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {result.generated.map((doc) => (
            <tr key={doc.filePath}>
              <td>{doc.branchCode}</td>
              <td>
                {doc.sellerName} ({doc.sellerCode})
              </td>
              <td>{doc.rowCount}</td>
              <td>{doc.total}</td>
              <td className="import-page__row-actions">
                <button type="button" onClick={() => void window.api.pdf.open(doc.filePath)}>
                  Abrir PDF
                </button>
                <button type="button" onClick={() => void window.api.pdf.openFolder(doc.filePath)}>
                  Abrir pasta
                </button>
                <button type="button" onClick={() => onPrint(doc.filePath)}>
                  Imprimir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" onClick={onNewFile}>
        Importar outro arquivo
      </button>
    </div>
  );
}
