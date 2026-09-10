export type HomeDestination = 'home' | 'previsao' | 'relacao' | 'historico';

interface HomePageProps {
  onNavigate: (destination: HomeDestination) => void;
}

const CARDS: { key: Exclude<HomeDestination, 'home'>; title: string; description: string }[] = [
  {
    key: 'previsao',
    title: 'Previsao de Comissoes',
    description:
      'Formata em PDF o relatorio Protheus de previsao de comissoes, dividido por vendedor e filial.'
  },
  {
    key: 'relacao',
    title: 'Relacao de Comissoes',
    description:
      'Formata em PDF o relatorio Protheus de relacao de comissoes, dividido por vendedor e filial.'
  },
  {
    key: 'historico',
    title: 'Historico',
    description: 'Consulta, reimprime e gerencia os documentos ja gerados anteriormente.'
  }
];

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <section className="home-grid">
      {CARDS.map((card) => (
        <button
          key={card.key}
          type="button"
          className="home-card"
          onClick={() => onNavigate(card.key)}
        >
          <h2>{card.title}</h2>
          <p>{card.description}</p>
        </button>
      ))}
    </section>
  );
}
