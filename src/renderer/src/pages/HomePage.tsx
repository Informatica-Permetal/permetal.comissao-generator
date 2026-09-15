import { useEffect, useState } from 'react';
import { FileSpreadsheet, FileStack, History, FolderOpen, Database, FileText, Inbox } from 'lucide-react';
import type { AppState } from '@shared/types/settings';
import type { HistoryDocument } from '@shared/types/history';
import type { SidebarView } from '../components/Sidebar';

interface HomePageProps {
  onNavigate: (destination: SidebarView) => void;
  appState: AppState;
}

const CARDS: { key: 'previsao' | 'relacao' | 'historico'; title: string; description: string; icon: typeof FileSpreadsheet }[] = [
  {
    key: 'previsao',
    title: 'Previsao de Comissoes',
    description: 'Formata em PDF o relatorio Protheus de previsao de comissoes, dividido por vendedor e filial.',
    icon: FileSpreadsheet
  },
  {
    key: 'relacao',
    title: 'Relacao de Comissoes',
    description: 'Formata em PDF o relatorio Protheus de relacao de comissoes, dividido por vendedor e filial.',
    icon: FileStack
  },
  {
    key: 'historico',
    title: 'Historico',
    description: 'Consulta, reimprime e gerencia os documentos ja gerados anteriormente.',
    icon: History
  }
];

const RECENT_LIMIT = 5;

export default function HomePage({ onNavigate, appState }: HomePageProps) {
  const [recent, setRecent] = useState<HistoryDocument[] | null>(null);

  useEffect(() => {
    window.api.history
      .list({})
      .then((docs) => setRecent(docs.slice(0, RECENT_LIMIT)))
      .catch(() => setRecent([]));
  }, []);

  return (
    <div>
      <div className="home-hero">
        <div className="home-hero__title">Bem-vindo</div>
        <p className="home-hero__subtitle">
          Escolha um relatorio do Protheus para formatar, ou consulte os documentos ja gerados.
        </p>
      </div>

      <section className="home-grid">
        {CARDS.map((card) => (
          <button key={card.key} type="button" className="home-card card" onClick={() => onNavigate(card.key)}>
            <span className="home-card__icon">
              <card.icon size={20} />
            </span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </button>
        ))}
      </section>

      <div className="home-panels">
        <div className="card home-panel">
          <div className="section-title">Documentos recentes</div>
          {recent === null && (
            <div className="loading-row">
              <span className="spinner" />
              Carregando...
            </div>
          )}
          {recent !== null && recent.length === 0 && (
            <div className="empty-state">
              <Inbox size={28} />
              <p className="empty-state__title">Nenhum documento gerado ainda</p>
              <p className="empty-state__hint">
                Importe uma Previsao ou Relacao de Comissoes para comecar.
              </p>
            </div>
          )}
          {recent !== null && recent.length > 0 && (
            <div className="recent-list">
              {recent.map((doc) => (
                <div className="recent-item" key={doc.id}>
                  <FileText className="recent-item__icon" size={16} />
                  <div className="recent-item__main">
                    <div className="recent-item__title">
                      {doc.sellerName} ({doc.sellerCode}) - {doc.branchCode}
                    </div>
                    <div className="recent-item__meta">
                      {doc.mode} - {new Date(doc.generatedAt).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  {doc.pdfAvailable && (
                    <button
                      type="button"
                      className="icon-btn"
                      data-tooltip="Abrir PDF"
                      onClick={() => void window.api.pdf.open(doc.pdfPath)}
                    >
                      <FileText size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card home-panel">
          <div className="section-title">Status operacional</div>
          <div className="status-row">
            <span className="status-row__label">
              <FolderOpen size={15} /> Pasta de relatorios
            </span>
            <span className="status-row__value">{appState.reportRoot ?? '-'}</span>
          </div>
          <div className="status-row">
            <span className="status-row__label">
              <Database size={15} /> Dados internos
            </span>
            <span className="status-row__value">{appState.appDataPath}</span>
          </div>
          <div className="status-row">
            <span className="status-row__label">
              <Inbox size={15} /> Pastas de Entrada
            </span>
            <span className="status-row__value">Monitoradas automaticamente</span>
          </div>
        </div>
      </div>
    </div>
  );
}
