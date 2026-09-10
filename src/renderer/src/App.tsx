import { useEffect, useState } from 'react';
import { APP_NAME } from '@shared/constants/app';
import type { AppState } from '@shared/types/settings';
import FirstRunPage from './pages/FirstRunPage';
import HomePage, { type HomeDestination } from './pages/HomePage';
import PrevisaoPage from './pages/PrevisaoPage';
import RelacaoPage from './pages/RelacaoPage';
import HistoricoPage from './pages/HistoricoPage';
import SettingsPage from './pages/SettingsPage';

type View = HomeDestination | 'configuracoes';

export default function App() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');

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

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{APP_NAME}</h1>
        <button type="button" onClick={() => setView('configuracoes')}>
          Configuracoes
        </button>
      </header>
      {view === 'home' && <HomePage onNavigate={setView} />}
      {view === 'previsao' && <PrevisaoPage onBack={() => setView('home')} />}
      {view === 'relacao' && <RelacaoPage onBack={() => setView('home')} />}
      {view === 'historico' && <HistoricoPage onBack={() => setView('home')} />}
      {view === 'configuracoes' && <SettingsPage state={appState} onBack={() => setView('home')} />}
    </div>
  );
}
