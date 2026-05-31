const steps = [
  "Colle l'offre complète.",
  "Ajoute ton CV ou ton profil.",
  "Lis l'angle recommandé.",
  "Copie le message le plus adapté.",
  "Cherche le bon contact LinkedIn.",
  "Relance à J+3 puis J+7.",
];

export default function ProtocolChecklist() {
  return (
    <section className="card p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-acid">
        Méthode
      </p>
      <h2 className="mt-2 text-2xl font-bold">Le protocole FirstReply</h2>

      <ol className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm text-slate-300">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-slate-950 text-xs text-accent">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
