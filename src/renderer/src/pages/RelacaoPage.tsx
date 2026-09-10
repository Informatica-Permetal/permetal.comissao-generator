import PlaceholderPage from '../components/PlaceholderPage';

export default function RelacaoPage({ onBack }: { onBack: () => void }) {
  return (
    <PlaceholderPage
      title="Relacao de Comissoes"
      message="A importacao e leitura do relatorio Protheus sera implementada na Fase 2."
      onBack={onBack}
    />
  );
}
