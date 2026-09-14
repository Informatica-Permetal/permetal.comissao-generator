import type { AppState } from '@shared/types/settings';
import CompanyProfilesSection from '../components/CompanyProfilesSection';

interface SettingsPageProps {
  state: AppState;
  onBack: () => void;
}

export default function SettingsPage({ state, onBack }: SettingsPageProps) {
  return (
    <section className="settings-page">
      <h2>Configuracoes</h2>
      <dl className="settings-page__list">
        <dt>Pasta raiz de relatorios</dt>
        <dd>{state.reportRoot}</dd>
        <dt>Dados internos do aplicativo</dt>
        <dd>{state.appDataPath}</dd>
        <dt>Logs</dt>
        <dd>{state.logPath}</dd>
        <dt>Banco de dados local</dt>
        <dd>{state.databasePath}</dd>
        <dt>Versao</dt>
        <dd>{state.appVersion}</dd>
      </dl>

      <h3>Empresas / Filiais</h3>
      <p className="settings-page__hint">
        Cada filial pode reutilizar a mesma logo de outra filial da mesma empresa. Campos vazios ficam em
        branco no PDF - nada e inventado automaticamente.
      </p>
      <CompanyProfilesSection />

      <button type="button" onClick={onBack}>
        Voltar
      </button>
    </section>
  );
}
