import PlaceholderPage from '../components/PlaceholderPage';

export default function HistoricoPage({ onBack }: { onBack: () => void }) {
  return (
    <PlaceholderPage
      title="Historico"
      message="A lista de documentos gerados sera implementada na Fase 5."
      onBack={onBack}
    />
  );
}
