import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { APP_NAME } from '@shared/constants/app';
import type { AppState } from '@shared/types/settings';
import type { ReportMode } from '@shared/constants/folders';
import { ToastProvider } from './components/ToastProvider';
import { ConfirmDialogProvider } from './components/ConfirmDialogProvider';
import Sidebar, { type SidebarView } from './components/Sidebar';
import FirstRunPage from './pages/FirstRunPage';
import HomePage from './pages/HomePage';
import PrevisaoPage from './pages/PrevisaoPage';
import RelacaoPage from './pages/RelacaoPage';
import HistoricoPage from './pages/HistoricoPage';
import SettingsPage from './pages/SettingsPage';

interface PendingImport {
  mode: ReportMode;
  sourcePath: string;
}

export default function App() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<SidebarView>('home');
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
        <AlertTriangle size={32} color="#c0342a" />
        <h1>{APP_NAME}</h1>
        <p>Não foi possível iniciar o aplicativo: {loadError}</p>
      </main>
    );
  }

  if (!appState) {
    return (
      <main className="app-shell app-shell--centered">
        <div className="loading-row">
          <span className="spinner" />
          Carregando...
        </div>
      </main>
    );
  }

  if (!appState.isFirstRunComplete) {
    return (
      <ToastProvider>
        <main className="app-shell app-shell--centered">
          <FirstRunPage initialState={appState} onCompleted={setAppState} />
        </main>
      </ToastProvider>
    );
  }

  function handleSwitchMode(mode: ReportMode, sourcePath: string): void {
    setPendingImport({ mode, sourcePath });
    setView(mode === 'Previsao' ? 'previsao' : 'relacao');
  }

  return (
    <ToastProvider>
      <ConfirmDialogProvider>
        <div className="app-shell">
          <Sidebar view={view} onNavigate={setView} appVersion={appState.appVersion} />
          <main className="app-main">
            {view === 'home' && <HomePage onNavigate={setView} appState={appState} />}
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
          </main>
        </div>
      </ConfirmDialogProvider>
    </ToastProvider>
  );
}
