"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import {
  APPLICATIONS_STORAGE_KEY,
  APPLICATIONS_UPDATED_EVENT,
  WORKFLOW_STATE_EVENT,
  type TrackedApplication,
} from "@/lib/applications";
import { loadSession, saveSession } from "@/lib/session";

const loadingSteps = [
  "Analyse de l'offre...",
  "Extraction des compétences clés...",
  "Comparaison avec ton profil...",
  "Préparation de l'angle d'approche...",
  "Génération des messages...",
  "Ajout au tracker...",
];

const capabilityBadges = [
  "Score de match",
  "Angle d'approche",
  "Lettre courte",
  "Email + DM",
  "Relances",
  "Contacts à chercher",
];

export default function MessageGenerator() {
  const [jobOffer, setJobOffer] = useState("");
  const [profile, setProfile] = useState("");
  const [latestApplication, setLatestApplication] =
    useState<TrackedApplication | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [copiedKey, setCopiedKey] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading) return;

    setLoadingStep(0);
    const interval = window.setInterval(() => {
      setLoadingStep((current) =>
        Math.min(current + 1, loadingSteps.length - 1)
      );
    }, 1100);

    return () => window.clearInterval(interval);
  }, [loading]);

  async function analyzeApplication() {
    setError("");
    setLatestApplication(null);

    if (!jobOffer.trim() || !profile.trim()) {
      setError("Colle l'offre et ton CV/profil avant de lancer l'analyse.");
      return;
    }

    const session = loadSession();

    if (!session) {
      setError("Session introuvable. Reconnecte-toi avec ta clé.");
      return;
    }

    setLoading(true);
    window.dispatchEvent(new CustomEvent(WORKFLOW_STATE_EVENT, { detail: "analyze" }));

    try {
      const response = await fetch("/api/analyze-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: session.key,
          jobOfferText: jobOffer,
          profileText: profile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Impossible d'analyser cette candidature.");
        window.dispatchEvent(
          new CustomEvent(WORKFLOW_STATE_EVENT, { detail: "prepare" })
        );
        return;
      }

      const application = data.application as TrackedApplication;
      const applications = [application, ...loadApplications()];

      localStorage.setItem(
        APPLICATIONS_STORAGE_KEY,
        JSON.stringify(applications)
      );
      window.dispatchEvent(
        new CustomEvent(APPLICATIONS_UPDATED_EVENT, { detail: applications })
      );

      saveSession({
        ...session,
        creditsUsed: session.creditsLimit - data.creditsRemaining,
        creditsRemaining: data.creditsRemaining,
      });

      setLatestApplication(application);
      window.dispatchEvent(new CustomEvent(WORKFLOW_STATE_EVENT, { detail: "send" }));
    } catch {
      setError("Impossible de contacter le serveur d'analyse.");
      window.dispatchEvent(
        new CustomEvent(WORKFLOW_STATE_EVENT, { detail: "prepare" })
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyMessage(key: string, message: string) {
    await navigator.clipboard.writeText(message);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(""), 1400);
  }

  return (
    <section className="card overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="border-b border-line bg-elevated/40 p-6 lg:border-b-0 lg:border-r">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">
            Nouvelle candidature
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
            Prépare une candidature ciblée
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            FirstReply lit l'offre, compare ton profil et prépare une
            candidature prête à envoyer.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {capabilityBadges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-line bg-slate-950/50 px-3 py-1.5 text-xs font-semibold text-slate-300"
              >
                {badge}
              </span>
            ))}
          </div>

          <p className="mt-6 rounded-2xl border border-line bg-slate-950/40 px-4 py-3 text-xs leading-5 text-slate-400">
            FirstReply ne promet pas un stage. Il t'aide à envoyer une
            candidature plus ciblée, plus lisible et plus facile à relancer.
          </p>
        </div>

        <div className="p-6">
          <div className="grid gap-5">
            <Textarea
              label="Offre d'emploi"
              helper="Copie-colle l'offre complète : missions, profil recherché, entreprise, compétences, lieu et lien si tu l'as."
              value={jobOffer}
              onChange={setJobOffer}
              placeholder="Exemple : Data Analyst Intern — missions, profil recherché, compétences demandées..."
            />
            <Textarea
              label="Ton CV / profil"
              helper="Colle ton CV en texte, ton profil LinkedIn, ou résume ton parcours : formation, expériences, compétences, projets."
              value={profile}
              onChange={setProfile}
              placeholder="Exemple : L3 éco-gestion, projet Python, Excel avancé, expérience vente..."
            />

            {error && (
              <p className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}

            <button
              onClick={analyzeApplication}
              disabled={loading}
              className="btn-primary flex w-full items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              {loading
                ? "Préparation en cours..."
                : "Analyser et préparer ma candidature"}
            </button>

            {loading && <LoadingSteps activeStep={loadingStep} />}
          </div>
        </div>
      </div>

      {latestApplication && (
        <PreparedApplicationPanel
          application={latestApplication}
          copiedKey={copiedKey}
          onCopy={copyMessage}
        />
      )}
    </section>
  );
}

function PreparedApplicationPanel({
  application,
  copiedKey,
  onCopy,
}: {
  application: TrackedApplication;
  copiedKey: string;
  onCopy: (key: string, message: string) => void;
}) {
  const directEmail = getDirectEmail(application);

  return (
    <div className="border-t border-line bg-slate-950/30 p-6">
      <div className="rounded-3xl border border-accent/20 bg-elevated/70 p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">
              Candidature préparée
            </p>
            <h3 className="mt-3 text-3xl font-black tracking-tight text-white">
              {getText(application.company)} — {getText(application.role)}
            </h3>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              {getText(application.suggestedAngle)}
            </p>
          </div>
          <ScoreCard score={application.matchScore} />
        </div>

        <ResultSection title="Résumé du match">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
            <InfoPanel
              title="Explication"
              value={getText(application.scoreBreakdown)}
            />
            <ListPanel
              title="Points forts"
              items={safeList(application.candidateStrengths)}
              tone="success"
            />
            <ListPanel
              title="Points à corriger"
              items={safeList(application.candidateWeaknesses)}
              tone="warning"
            />
          </div>
        </ResultSection>

        <ResultSection title="Lettre courte">
          <MessagePanel
            copyKey="shortCoverLetter"
            title="Pour portail ou champ motivation"
            label="Prête à adapter"
            value={getText(application.shortCoverLetter)}
            buttonLabel="Copier la lettre"
            copiedKey={copiedKey}
            onCopy={onCopy}
          />
        </ResultSection>

        <ResultSection title="Messages prêts à envoyer">
          <div className="grid gap-4 lg:grid-cols-2">
            <MessagePanel
              copyKey="directEmail"
              title="Direct outreach email"
              label="Prêt à personnaliser"
              value={directEmail}
              buttonLabel="Copier l'email"
              copiedKey={copiedKey}
              onCopy={onCopy}
            />
            <MessagePanel
              copyKey="linkedInDM"
              title="LinkedIn DM"
              label="Prêt à personnaliser"
              value={getText(application.linkedInDM)}
              buttonLabel="Copier le DM"
              copiedKey={copiedKey}
              onCopy={onCopy}
            />
          </div>
        </ResultSection>

        <ResultSection
          title="Qui chercher ?"
          helper="Trouve d'abord une vraie personne. FirstReply t'aide à identifier qui chercher, puis à générer les formats d'emails probables."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <InfoPanel
              title="Contact recommandé"
              value={getText(application.contactToFind)}
            />
            <ListPanel
              title="Profils LinkedIn"
              items={safeList(application.linkedinProfilesToSearch)}
            />
            <ListPanel
              title="Requêtes à essayer"
              items={safeList(application.searchQueries)}
            />
          </div>
        </ResultSection>

        <ResultSection
          title="Formats d'emails probables"
          helper="À utiliser après avoir identifié un contact avec prénom + nom. Ces formats ne sont pas vérifiés."
        >
          <EmailPatternBuilder
            defaultPatterns={safeList(application.likelyEmailPatterns)}
          />
        </ResultSection>

        <ResultSection title="Relances">
          <div className="grid gap-4 lg:grid-cols-2">
            <MessagePanel
              copyKey="followUpJ3"
              title="Relance J+3"
              label="À envoyer si pas de réponse"
              value={getText(application.followUpJ3)}
              buttonLabel="Copier relance J+3"
              copiedKey={copiedKey}
              onCopy={onCopy}
            />
            <MessagePanel
              copyKey="followUpJ7"
              title="Relance J+7"
              label="Dernière relance courte"
              value={getText(application.followUpJ7)}
              buttonLabel="Copier relance J+7"
              copiedKey={copiedKey}
              onCopy={onCopy}
            />
          </div>
        </ResultSection>

        <ResultSection title="Prochaine action">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <InfoPanel title="À faire maintenant" value={getText(application.nextAction)} />
            <div className="rounded-2xl border border-line bg-slate-950/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Relance prévue
              </p>
              <p className="mt-3 text-2xl font-black text-white">
                {formatDate(application.nextFollowUpDate)}
              </p>
            </div>
          </div>
        </ResultSection>
      </div>
    </div>
  );
}

function EmailPatternBuilder({
  defaultPatterns,
}: {
  defaultPatterns: string[];
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [domain, setDomain] = useState("");

  const generatedPatterns = useMemo(() => {
    const normalizedFirstName = normalizeEmailPart(firstName);
    const normalizedLastName = normalizeEmailPart(lastName);
    const normalizedDomain = domain.trim().replace(/^@/, "").toLowerCase();

    if (!normalizedFirstName || !normalizedLastName || !normalizedDomain) {
      return defaultPatterns.length > 0
        ? defaultPatterns
        : [
            "prenom.nom@domaine",
            "p.nom@domaine",
            "prenom@domaine",
            "prenom_nom@domaine",
          ];
    }

    return [
      `${normalizedFirstName}.${normalizedLastName}@${normalizedDomain}`,
      `${normalizedFirstName[0]}.${normalizedLastName}@${normalizedDomain}`,
      `${normalizedFirstName}@${normalizedDomain}`,
      `${normalizedFirstName}_${normalizedLastName}@${normalizedDomain}`,
    ];
  }, [defaultPatterns, domain, firstName, lastName]);

  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-2xl border border-line bg-slate-950/50 p-4">
        <p className="text-sm font-semibold text-white">Contact trouvé ?</p>
        <div className="mt-4 grid gap-3">
          <SmallInput label="Prénom" value={firstName} onChange={setFirstName} />
          <SmallInput label="Nom" value={lastName} onChange={setLastName} />
          <SmallInput
            label="Domaine"
            value={domain}
            onChange={setDomain}
            placeholder="ex: entreprise.com"
          />
        </div>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Remplis ces champs après avoir trouvé une vraie personne sur LinkedIn.
        </p>
      </div>
      <ListPanel title="Formats probables" items={generatedPatterns} />
    </div>
  );
}

function LoadingSteps({ activeStep }: { activeStep: number }) {
  return (
    <div className="rounded-2xl border border-line bg-elevated/70 p-4">
      <div className="space-y-3">
        {loadingSteps.map((step, index) => (
          <div
            key={step}
            className="flex items-center gap-3 text-sm text-slate-400"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                index <= activeStep
                  ? "border-accent/40 bg-accent/10 text-accent"
                  : "border-line bg-slate-950 text-slate-600"
              }`}
            >
              {index < activeStep ? <Check size={12} /> : null}
            </span>
            <span className={index === activeStep ? "text-slate-100" : ""}>
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultSection({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3">
        <h4 className="text-lg font-bold text-white">{title}</h4>
        {helper && <p className="mt-1 text-sm leading-6 text-slate-400">{helper}</p>}
      </div>
      {children}
    </section>
  );
}

function ScoreCard({ score }: { score: number }) {
  const label = getQualityLabel(score);

  return (
    <div className="rounded-3xl border border-accent/25 bg-accent/10 p-5 text-left lg:min-w-60 lg:text-right">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
        Score de match
      </p>
      <p className="mt-3 text-5xl font-black text-white">{score}/100</p>
      <p className="mt-2 text-sm font-semibold text-slate-200">{label}</p>
    </div>
  );
}

function InfoPanel({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-slate-950/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <p className="mt-3 text-sm leading-6 text-slate-200">
        {value || "À compléter."}
      </p>
    </div>
  );
}

function ListPanel({
  title,
  items,
  tone = "accent",
}: {
  title: string;
  items: string[];
  tone?: "accent" | "success" | "warning";
}) {
  const dotClass =
    tone === "success"
      ? "bg-success"
      : tone === "warning"
        ? "bg-warning"
        : "bg-accent";

  return (
    <div className="rounded-2xl border border-line bg-slate-950/50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {title}
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
        {items.length === 0 && <li className="text-slate-500">À compléter.</li>}
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessagePanel({
  copyKey,
  title,
  label,
  value,
  buttonLabel,
  copiedKey,
  onCopy,
}: {
  copyKey: string;
  title: string;
  label: string;
  value: string;
  buttonLabel: string;
  copiedKey: string;
  onCopy: (key: string, message: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-slate-950/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
        </div>
        <button
          onClick={() => onCopy(copyKey, value)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-accent hover:text-white"
        >
          <Copy size={14} />
          {copiedKey === copyKey ? "Copié" : buttonLabel}
        </button>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-200">
        {value || "À compléter."}
      </p>
    </div>
  );
}

function SmallInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </span>
      <input
        className="mt-2 w-full rounded-xl border border-line bg-elevated/70 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-accent"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function Textarea({
  label,
  helper,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  helper: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="mb-2">
        <label className="label">{label}</label>
        <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
      </div>
      <textarea
        className="input min-h-48 resize-y leading-6"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function loadApplications() {
  const raw = localStorage.getItem(APPLICATIONS_STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as TrackedApplication[];
  } catch {
    localStorage.removeItem(APPLICATIONS_STORAGE_KEY);
    return [];
  }
}

function getQualityLabel(score: number) {
  if (score >= 85) return "Très bon potentiel";
  if (score >= 70) return "Bon potentiel";
  if (score >= 50) return "Potentiel moyen";
  return "À retravailler";
}

function getText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getDirectEmail(application: TrackedApplication) {
  const legacyApplication = application as TrackedApplication & { email?: string };
  return application.directEmail || legacyApplication.email || "";
}

function normalizeEmailPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

function formatDate(value: string) {
  if (!value) return "À définir";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(date);
}
