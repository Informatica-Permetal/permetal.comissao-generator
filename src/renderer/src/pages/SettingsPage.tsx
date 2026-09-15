import { Settings as SettingsIcon, FolderOpen, Database, FileClock, HardDrive, Tag } from 'lucide-react';
import type { AppState } from '@shared/types/settings';
import PageHeader from '../components/PageHeader';
import CompanyProfilesSection from '../components/CompanyProfilesSection';

interface SettingsPageProps {
  state: AppState;
  onBack: () => void;
}

export default function SettingsPage({ state, onBack }: SettingsPageProps) {
  return (
    <section>
      <PageHeader icon={SettingsIcon} title="Configurações" onBack={onBack} />

      <div className="settings-page__info">
        <div className="card info-card">
          <span className="info-card__icon">
            <FolderOpen size={17} />
          </span>
          <div>
            <div className="info-card__label">Pasta raiz de relatórios</div>
            <div className="info-card__value">{state.reportRoot ?? '-'}</div>
          </div>
        </div>
        <div className="card info-card">
          <span className="info-card__icon">
            <Database size={17} />
          </span>
          <div>
            <div className="info-card__label">Dados internos do aplicativo</div>
            <div className="info-card__value">{state.appDataPath}</div>
          </div>
        </div>
        <div className="card info-card">
          <span className="info-card__icon">
            <FileClock size={17} />
          </span>
          <div>
            <div className="info-card__label">Logs</div>
            <div className="info-card__value">{state.logPath}</div>
          </div>
        </div>
        <div className="card info-card">
          <span className="info-card__icon">
            <HardDrive size={17} />
          </span>
          <div>
            <div className="info-card__label">Banco de dados local</div>
            <div className="info-card__value">{state.databasePath}</div>
          </div>
        </div>
        <div className="card info-card">
          <span className="info-card__icon">
            <Tag size={17} />
          </span>
          <div>
            <div className="info-card__label">Versão</div>
            <div className="info-card__value">{state.appVersion}</div>
          </div>
        </div>
      </div>

      <div className="section-title">Empresas / Filiais</div>
      <p className="section-hint">
        Cada filial pode reutilizar a mesma logo de outra filial da mesma empresa. Campos vazios ficam em branco no
        PDF - nada é inventado automaticamente.
      </p>
      <CompanyProfilesSection />
    </section>
  );
}
