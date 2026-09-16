import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, Copy, Info, X } from 'lucide-react';
import type { ReportMode } from '@shared/constants/folders';
import { formatFieldListForCopy, IMPORT_HELP_CONTENT, type ImportHelpContent } from '../lib/importHelpContent';
import { useToast } from './ToastProvider';

/**
 * Discreet info icon next to a report mode's title. Opens a self-contained,
 * accessible, scrollable modal describing exactly which Protheus Smart View
 * fields that mode requires - fully static/offline, no network dependency.
 */
export default function ImportHelp({ mode }: { mode: ReportMode }) {
  const [open, setOpen] = useState(false);
  const content = IMPORT_HELP_CONTENT[mode];

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        data-tooltip="Ajuda"
        aria-label={`Ajuda sobre o relatório ${content.modeTitle}`}
        onClick={() => setOpen(true)}
      >
        <Info size={18} />
      </button>
      {open && <ImportHelpDialog content={content} onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportHelpDialog({ content, onClose }: { content: ImportHelpContent; onClose: () => void }) {
  const { showToast } = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(formatFieldListForCopy(content));
      showToast('success', 'Lista de campos copiada.');
    } catch {
      showToast('error', 'Não foi possível copiar a lista.');
    }
  }

  return (
    <div className="help-modal-overlay" onClick={onClose}>
      <div
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="help-modal__header">
          <span className="help-modal__icon">
            <Info size={18} />
          </span>
          <h2 id={titleId} className="help-modal__title">
            Ajuda - {content.modeTitle}
          </h2>
          <button type="button" className="icon-btn" data-tooltip="Fechar" aria-label="Fechar" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="help-modal__body">
          <div className="help-modal__field">
            <span className="help-modal__label">Relatório no Protheus</span>
            <span className="help-modal__value">{content.reportName}</span>
          </div>
          <div className="help-modal__field">
            <span className="help-modal__label">Código</span>
            <code className="help-modal__code">{content.code}</code>
          </div>
          <div className="help-modal__field">
            <span className="help-modal__label">Caminho</span>
            <span className="help-modal__path">
              {content.path.map((segment, index) => (
                <span key={segment}>
                  {index > 0 && <ChevronRight size={12} className="help-modal__path-sep" />}
                  {segment}
                </span>
              ))}
            </span>
          </div>

          {content.warning && (
            <div className="message-banner message-banner--warning help-modal__warning">
              <AlertTriangle size={16} />
              {content.warning}
            </div>
          )}

          <div>
            <div className="help-modal__section-title">Colunas obrigatórias ({content.requiredFieldCount})</div>
            <ol className="help-modal__field-list">
              {content.fields.map((field) => (
                <li key={field}>
                  <code>{field}</code>
                </li>
              ))}
            </ol>
          </div>

          <ul className="help-modal__notes">
            {content.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>

        <footer className="help-modal__footer">
          <button type="button" className="btn btn--sm" onClick={() => void handleCopy()}>
            <Copy size={14} /> Copiar lista de campos
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={onClose}>
            Fechar
          </button>
        </footer>
      </div>
    </div>
  );
}
