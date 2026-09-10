import PlaceholderPage from '../components/PlaceholderPage';

export default function PrevisaoPage({ onBack }: { onBack: () => void }) {
  return (
    <PlaceholderPage
      title="Previsao de Comissoes"
      message="A importacao e leitura do relatorio Protheus sera implementada na Fase 2."
      onBack={onBack}
    />
  );
}
