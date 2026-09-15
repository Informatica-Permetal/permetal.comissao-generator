import type { ReactNode } from 'react';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: ReactNode;
}

export default function PageHeader({ icon: Icon, title, subtitle, onBack, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      {onBack && (
        <button type="button" className="icon-btn" data-tooltip="Voltar" onClick={onBack} aria-label="Voltar">
          <ArrowLeft size={18} />
        </button>
      )}
      <span className="page-header__icon">
        <Icon size={20} />
      </span>
      <div>
        <div className="page-header__title">{title}</div>
        {subtitle && <div className="page-header__subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
