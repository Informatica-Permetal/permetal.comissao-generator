import { FileSpreadsheet, LayoutGrid, History, Settings, FileStack } from 'lucide-react';
import { APP_NAME } from '@shared/constants/app';

export type SidebarView = 'home' | 'previsao' | 'relacao' | 'historico' | 'configuracoes';

interface SidebarProps {
  view: SidebarView;
  onNavigate: (view: SidebarView) => void;
  appVersion?: string;
}

const NAV_ITEMS: { key: Exclude<SidebarView, 'configuracoes'>; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'home', label: 'Início', icon: LayoutGrid },
  { key: 'previsao', label: 'Previsão', icon: FileSpreadsheet },
  { key: 'relacao', label: 'Relação', icon: FileStack },
  { key: 'historico', label: 'Histórico', icon: History }
];

export default function Sidebar({ view, onNavigate, appVersion }: SidebarProps) {
  return (
    <nav className="sidebar" aria-label="Navegação principal">
      <div className="sidebar__brand">
        <span className="sidebar__brand-mark">
          <FileSpreadsheet size={16} />
        </span>
        <span className="sidebar__brand-name">{APP_NAME}</span>
      </div>

      <div className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`sidebar__item${view === item.key ? ' sidebar__item--active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            <item.icon size={17} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="sidebar__spacer" />

      <div className="sidebar__nav">
        <button
          type="button"
          className={`sidebar__item${view === 'configuracoes' ? ' sidebar__item--active' : ''}`}
          onClick={() => onNavigate('configuracoes')}
        >
          <Settings size={17} />
          Configurações
        </button>
      </div>
      {appVersion && <div className="sidebar__footer">Versão {appVersion}</div>}
    </nav>
  );
}
