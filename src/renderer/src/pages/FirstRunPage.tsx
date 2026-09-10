import { useEffect, useState } from 'react';
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
    <main className="first-run">
      <h1>Configuracao inicial</h1>
      <p>Escolha onde o Formatador Comissao vai guardar os relatorios importados e os PDFs gerados.</p>
      <p className="first-run__path">{path}</p>
      <div className="first-run__actions">
        <button type="button" onClick={() => void handleChooseFolder()}>
          Escolher outra pasta
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={testing || submitting || permission?.ok !== true}
        >
          {submitting ? 'Criando pastas...' : 'Concluir configuracao inicial'}
        </button>
      </div>
      {testing && <p>Testando permissao de criar, gravar e excluir...</p>}
      {permission && !permission.ok && <p className="first-run__error">{permission.reason}</p>}
      {permission?.ok && <p className="first-run__ok">Permissao verificada: criar, gravar e excluir OK.</p>}
      {submitError && <p className="first-run__error">{submitError}</p>}
    </main>
  );
}
