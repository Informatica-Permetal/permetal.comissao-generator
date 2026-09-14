import type { ReportMode } from '@shared/constants/folders';
import ImportPage from '../components/ImportPage';

interface RelacaoPageProps {
  onBack: () => void;
  onGoToSettings: () => void;
  onSwitchMode: (mode: ReportMode, sourcePath: string) => void;
  initialSourcePath?: string | null;
  onInitialSourceConsumed?: () => void;
}

export default function RelacaoPage(props: RelacaoPageProps) {
  return <ImportPage mode="Relacao" title="Relacao de Comissoes" {...props} />;
}
