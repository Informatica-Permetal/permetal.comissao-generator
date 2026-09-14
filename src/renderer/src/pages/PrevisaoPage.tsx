import type { ReportMode } from '@shared/constants/folders';
import ImportPage from '../components/ImportPage';

interface PrevisaoPageProps {
  onBack: () => void;
  onGoToSettings: () => void;
  onSwitchMode: (mode: ReportMode, sourcePath: string) => void;
  initialSourcePath?: string | null;
  onInitialSourceConsumed?: () => void;
}

export default function PrevisaoPage(props: PrevisaoPageProps) {
  return <ImportPage mode="Previsao" title="Previsao de Comissoes" {...props} />;
}
