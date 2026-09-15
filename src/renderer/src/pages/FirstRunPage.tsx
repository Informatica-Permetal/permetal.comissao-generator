import { useEffect, useState } from 'react';
import { FolderCog, FolderOpen, CheckCircle2, AlertTriangle } from 'lucide-react';
import { APP_NAME } from '@shared/constants/app';
import type { AppState, FolderPermissionResult } from '@shared/types/settings';

interface FirstRunPageProps {
  initialState: AppState;
  onCompleted: (state: AppState) => void;
}

export default function FirstRunPage({ initialState, onCompleted }: FirstRunPageProps) {
  const [path, setPath] = useState(initialState.reportRoot ?? initialState.suggestedReportRoot);
  const [permission, setPermission] = useState<FolderPermissionResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTesting(true);
    setPermission(null);
    void window.api.settings.testFolder(path).then((result) => {
      if (!cancelled) {
        setPermission(result);
        setTesting(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [path]);

  async function handleChooseFolder(): Promise<void> {
    const chosen = await window.api.settings.chooseFolder(path);
    if (chosen) setPath(chosen);
  }

  async function handleConfirm(): Promise<void> {
    setSubmitting(true);
    setSubmitError(null);
    const result = await window.api.settings.completeFirstRun(path);
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error ?? 'Falha ao concluir a configuracao inicial.');
      return;
    }
    const refreshed = await window.api.settings.getState();
    onCompleted(refreshed);
  }

  return (
    <div className="first-run">
      <span className="first-run__icon">
        <FolderCog size={26} />
      </span>
      <div className="card first-run__card">
        <h1>Configuracao inicial</h1>
        <p>
          Bem-vindo ao {APP_NAME}. Escolha onde os relatorios importados e os PDFs gerados serao guardados.
        </p>
        <p className="first-run__path">
          <FolderOpen size={16} />
          {path}
        </p>
        <div className="first-run__actions">
          <button type="button" className="btn" onClick={() => void handleChooseFolder()}>
            Escolher outra pasta
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void handleConfirm()}
            disabled={testing || submitting || permission?.ok !== true}
          >
            {submitting ? 'Criando pastas...' : 'Concluir configuracao inicial'}
          </button>
        </div>
        {testing && (
          <div className="first-run__status">
            <span className="spinner" />
            Testando permissao de criar, gravar e excluir...
          </div>
        )}
        {permission && !permission.ok && (
          <div className="first-run__status first-run__error">
            <AlertTriangle size={15} />
            {permission.reason}
          </div>
        )}
        {permission?.ok && (
          <div className="first-run__status first-run__ok">
            <CheckCircle2 size={15} />
            Permissao verificada: criar, gravar e excluir OK.
          </div>
        )}
        {submitError && (
          <div className="first-run__status first-run__error">
            <AlertTriangle size={15} />
            {submitError}
          </div>
        )}
      </div>
    </div>
  );
}
