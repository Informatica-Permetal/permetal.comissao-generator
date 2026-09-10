interface PlaceholderPageProps {
  title: string;
  message: string;
  onBack: () => void;
}

export default function PlaceholderPage({ title, message, onBack }: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <h2>{title}</h2>
      <p>{message}</p>
      <button type="button" onClick={onBack}>
        Voltar
      </button>
    </section>
  );
}
