import { useEffect, useState } from 'react';
import { APP_NAME } from '@shared/constants/app';
import type { AppState } from '@shared/types/settings';
import type { ReportMode } from '@shared/constants/folders';
import FirstRunPage from './pages/FirstRunPage';
import HomePage, { type HomeDestination } from './pages/HomePage';
import PrevisaoPage from './pages/PrevisaoPage';
import RelacaoPage from './pages/RelacaoPage';
import HistoricoPage from './pages/HistoricoPage';
import SettingsPage from './pages/SettingsPage';

type View = HomeDestination | 'configuracoes';

interface PendingImport {
  mode: ReportMode;
  sourcePath: string;
}

export default function App() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  useEffect(() => {
    window.api.settings
      .getState()
      .then(setAppState)
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Falha ao iniciar o aplicativo.');
      });
  }, []);

  if (loadError) {
    return (
      <main className="app-shell app-shell--error">
        <h1>{APP_NAME}</h1>
        <p>Nao foi possivel iniciar o aplicativo: {loadError}</p>
      </main>
    );
  }

  if (!appState) {
    return (
      <main className="app-shell">
        <p>Carregando...</p>
      </main>
    );
  }

  if (!appState.isFirstRunComplete) {
    return <FirstRunPage initialState={appState} onCompleted={setAppState} />;
  }

  function handleSwitchMode(mode: ReportMode, sourcePath: string): void {
    setPendingImport({ mode, sourcePath });
    setView(mode === 'Previsao' ? 'previsao' : 'relacao');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{APP_NAME}</h1>
        <button type="button" onClick={() => setView('configuracoes')}>
          Configuracoes
        </button>
      </header>
      {view === 'home' && <HomePage onNavigate={setView} />}
      {view === 'previsao' && (
        <PrevisaoPage
          onBack={() => setView('home')}
          onGoToSettings={() => setView('configuracoes')}
          onSwitchMode={handleSwitchMode}
          initialSourcePath={pendingImport?.mode === 'Previsao' ? pendingImport.sourcePath : null}
          onInitialSourceConsumed={() => setPendingImport(null)}
        />
      )}
      {view === 'relacao' && (
        <RelacaoPage
          onBack={() => setView('home')}
          onGoToSettings={() => setView('configuracoes')}
          onSwitchMode={handleSwitchMode}
          initialSourcePath={pendingImport?.mode === 'Relacao' ? pendingImport.sourcePath : null}
          onInitialSourceConsumed={() => setPendingImport(null)}
        />
      )}
      {view === 'historico' && <HistoricoPage onBack={() => setView('home')} />}
      {view === 'configuracoes' && <SettingsPage state={appState} onBack={() => setView('home')} />}
    </div>
  );
}
