"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Plus, RotateCcw, Search } from "lucide-react";

// This is a hardcoded marketing demo route for video recording.
type PrimaryStatus =
  | "Ghosté"
  | "Refusé"
  | "En attente"
  | "À relancer"
  | "Entretien"
  | "Offre reçue";

type DemoFilter = "all" | "active" | "rejected" | "interviews" | "offers";
type DemoAction = "followup" | "interview" | "none";
type FollowupState = "idle" | "loading" | "ready";

type DemoApplication = {
  id: string;
  company: string;
  role: string;
  score: number;
  status: PrimaryStatus;
  contract: string;
  location: string;
  compensation: string;
  appliedDate: string;
  isHero?: boolean;
};

type StatusConfig = {
  badgeClass: string;
  cardClass: string;
  railClass: string;
  dotClass: string;
  menuDotClass: string;
  secondaryClass: string;
  secondaryLabel: string;
  action: DemoAction;
  actionClass: string;
  optionIcon: string;
};

const tealActionClass =
  "border border-teal-200 bg-teal-50/70 text-teal-700 hover:bg-teal-100";

const statusConfig: Record<PrimaryStatus, StatusConfig> = {
  Ghosté: {
    badgeClass: "border-zinc-300 bg-zinc-200 text-zinc-700",
    cardClass: "border-zinc-300 bg-zinc-100",
    railClass: "bg-zinc-400",
    dotClass: "bg-zinc-500",
    menuDotClass: "bg-zinc-500",
    secondaryClass: "text-zinc-600",
    secondaryLabel: "Sans réponse",
    action: "followup",
    actionClass: tealActionClass,
    optionIcon: "●",
  },
  Refusé: {
    badgeClass: "border-red-300 bg-red-500 text-white font-bold",
    cardClass: "border-red-300 bg-red-50 opacity-90",
    railClass: "bg-red-500",
    dotClass: "bg-white",
    menuDotClass: "bg-red-500",
    secondaryClass: "text-red-600 font-bold",
    secondaryLabel: "Refusé",
    action: "none",
    actionClass: tealActionClass,
    optionIcon: "●",
  },
  "En attente": {
    badgeClass: "border-amber-100 bg-amber-50 text-amber-700",
    cardClass: "border-amber-200 bg-amber-50/40",
    railClass: "bg-amber-400",
    dotClass: "bg-amber-500",
    menuDotClass: "bg-amber-500",
    secondaryClass: "text-amber-700",
    secondaryLabel: "Réponse attendue",
    action: "followup",
    actionClass: tealActionClass,
    optionIcon: "●",
  },
  "À relancer": {
    badgeClass: "border-violet-100 bg-violet-50 text-violet-700",
    cardClass: "border-violet-100 bg-violet-50/50",
    railClass: "bg-violet-400",
    dotClass: "bg-violet-500",
    menuDotClass: "bg-violet-500",
    secondaryClass: "text-violet-700",
    secondaryLabel: "Relance à envoyer",
    action: "followup",
    actionClass: tealActionClass,
    optionIcon: "●",
  },
  Entretien: {
    badgeClass: "border-blue-100 bg-blue-50 text-blue-700",
    cardClass: "border-blue-200 bg-blue-50/75",
    railClass: "bg-blue-500",
    dotClass: "bg-blue-500",
    menuDotClass: "bg-blue-500",
    secondaryClass: "text-blue-700",
    secondaryLabel: "Entretien à préparer",
    action: "interview",
    actionClass: "border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100",
    optionIcon: "●",
  },
  "Offre reçue": {
    badgeClass: "border-emerald-600 bg-emerald-500 text-white font-bold",
    cardClass:
      "border-emerald-300 bg-[linear-gradient(135deg,#ecfdf5,#ffffff_62%,#fefce8)] shadow-[0_18px_55px_rgba(16,185,129,0.18)]",
    railClass: "bg-emerald-500",
    dotClass: "bg-white",
    menuDotClass: "bg-emerald-500",
    secondaryClass: "text-emerald-700",
    secondaryLabel: "La guerre est finie",
    action: "none",
    actionClass: tealActionClass,
    optionIcon: "●",
  },
};

const STATUS_OPTIONS = Object.keys(statusConfig) as PrimaryStatus[];

const COMPANIES = [
  // Tier 1 — AI-native / recherche
  "Mistral AI",
  "Hugging Face",
  "LightOn",
  "Dust",
  "Poolside AI",
  "Kyutai",
  "Nabla",
  "Giskard",
  "Pollen Robotics",
  // Tier 2 — Scale-ups tech FR
  "Dataiku",
  "Contentsquare",
  "Criteo",
  "Algolia",
  "Alan",
  "Doctolib",
  "Qonto",
  "PayFit",
  "Spendesk",
  "Pennylane",
  "Pigment",
  "Ankorstore",
  "Back Market",
  "Mirakl",
  "Swile",
  "Ledger",
  "Yousign",
  "Sézane Tech",
  // Tier 3 — Grands groupes avec labs data
  "BNP Paribas CIB",
  "Société Générale",
  "AXA Data Innovation",
  "Renault Software Labs",
  "L'Oréal Research",
  "Airbus Defence & Space",
  "Thales DIS",
  "Safran Analytics",
  "Stellantis Digital",
  "TotalEnergies Digital",
  "Orange Innovation",
  "SNCF Réseau",
  "EDF Lab",
  "Dassault Systèmes",
  "Capgemini Invent",
  "Sopra Steria Next",
  // Tier 4 — Startups/PME data
  "Preligens",
  "Shift Technology",
  "Craft AI",
  "Heuritech",
  "Zelros",
  "Descartes Underwriting",
  "InstaDeep",
  "Lunit",
  "Joko",
  "Alma",
  "Legalstart",
  "ManoMano",
  "Meero",
  "Platform.sh",
  "Scaleway",
  "CleverCloud",
  "OVHcloud",
  "Meilisearch",
  "Deepki",
  "Kayrros",
  "Carbonfact",
  "Greenly",
  "Believe",
  "Lemonade",
  "Treatwell",
  "PhotoRoom",
  "Pretto",
  "Lydia",
  "Heetch",
  "Getaround",
  "BlaBlaCar",
  "Vestiaire Collective",
  "Veepee",
  "Deezer",
  "Ubisoft",
  "Voodoo",
  "Sorare",
  "Ledgity",
  "Artefact",
  "Ekimetrics",
  "Quantmetry",
  "Sia Partners",
  "eleven strategy",
  "McKinsey QuantumBlack",
  "BCG Gamma",
  "Wavestone",
  "Devoteam",
  "Xebia",
  "Octo Technology",
  "Theodo",
  "Sicara",
  "Stack Labs",
];

const ROLES = [
  "AI Engineer — LLM & RAG",
  "ML Engineer Intern",
  "Data Scientist — Alternance",
  "Data Engineer — Alternance",
  "NLP Research Intern",
  "MLOps Engineer — Alternance",
  "Computer Vision Intern",
  "Software Engineer — AI Platform",
  "Backend Engineer Python",
  "Data Analyst — Alternance",
  "Applied Scientist Intern",
  "ML Infrastructure Intern",
  "Prompt Engineer — Stage",
  "Recherche & Développement IA",
  "Deep Learning Intern",
  "Fullstack Engineer — Data Tools",
  "Platform Engineer — ML Serving",
  "Data Engineer — ETL & dbt",
  "DevOps / MLOps — Alternance",
  "Quantitative Analyst Intern",
];

const LOCATIONS = [
  "Paris 2e",
  "Paris 8e",
  "Paris 9e",
  "Paris 11e",
  "Paris 13e",
  "La Défense",
  "Boulogne-Billancourt",
  "Issy-les-Moulineaux",
  "Montrouge",
  "Saint-Denis",
  "Clichy",
  "Lyon 3e",
  "Remote",
  "Hybride — Paris",
  "Hybride — Lyon",
];

const CONTRACTS = [
  "Alternance 24 mois",
  "Alternance 12 mois",
  "Stage 6 mois",
  "Stage fin d'études",
  "CDI junior",
  "Graduate program",
];

const COMPENSATIONS = [
  "1 100€/mois",
  "1 200€/mois",
  "1 350€/mois",
  "1 450€/mois",
  "1 500€/mois",
  "1 600€/mois",
  "1 800€/mois",
  "38k€ – 42k€",
  "42k€ – 48k€",
  "45k€",
];

const APPLIED_DATES = [
  "4 janvier",
  "8 janvier",
  "12 janvier",
  "19 janvier",
  "25 janvier",
  "31 janvier",
  "2 février",
  "6 février",
  "12 février",
  "18 février",
  "25 février",
  "3 mars",
  "9 mars",
  "15 mars",
  "22 mars",
  "28 mars",
  "4 avril",
  "11 avril",
  "18 avril",
  "25 avril",
];

const HERO_APPLICATION: DemoApplication = {
  id: "hero-dust",
  company: "Dust",
  role: "Software Engineer - AI Platform",
  score: 72,
  status: "Entretien",
  contract: "Alternance 24 mois",
  location: "Paris",
  compensation: "1 600€/mois",
  appliedDate: "12 février",
  isHero: true,
};

const INITIAL_APPLICATIONS: DemoApplication[] = [
  HERO_APPLICATION,
  ...Array.from({ length: 99 }, (_, index) => buildApplication(index)),
];

export default function DemoTrackerPage() {
  const [applications, setApplications] = useState(INITIAL_APPLICATIONS);
  const [filter, setFilter] = useState<DemoFilter>("all");
  const [search, setSearch] = useState("");
  const [openStatusMenu, setOpenStatusMenu] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const [followups, setFollowups] = useState<Record<string, FollowupState>>({});

  const stats = useMemo(() => getStats(applications), [applications]);
  const stableOrder = useMemo(() => {
    const map = new Map<string, number>();
    for (const app of INITIAL_APPLICATIONS) {
      map.set(app.id, getPriority(app));
    }
    return map;
  }, []);
  const visibleApplications = useMemo(() => {
    return applications
      .filter((application) => matchesFilter(application, filter))
      .filter((application) => {
        const query = search.trim().toLowerCase();
        if (!query) return true;

        return `${application.company} ${application.role} ${application.status}`
          .toLowerCase()
          .includes(query);
      })
      .sort((a, b) => (stableOrder.get(a.id) ?? 0) - (stableOrder.get(b.id) ?? 0));
  }, [applications, filter, search, stableOrder]);

  function resetDemo() {
    setApplications(INITIAL_APPLICATIONS);
    setFilter("all");
    setSearch("");
    setOpenStatusMenu("");
    setCelebrating(false);
    setFollowups({});
  }

  function updateApplicationStatus(applicationId: string, status: PrimaryStatus) {
    setOpenStatusMenu("");
    setFollowups((current) => {
      const next = { ...current };
      delete next[applicationId];
      return next;
    });

    setApplications((current) =>
      current.map((application) =>
        application.id === applicationId
          ? {
              ...application,
              status,
              score:
                status === "Offre reçue"
                  ? Math.max(application.score, 91)
                  : application.score,
            }
          : application
      )
    );

    if (status === "Offre reçue") {
      setCelebrating(true);
      window.setTimeout(() => setCelebrating(false), 5200);
    }
  }

  function fakeGenerateFollowup(applicationId: string) {
    setFollowups((current) => ({ ...current, [applicationId]: "loading" }));
    window.setTimeout(() => {
      setFollowups((current) => ({ ...current, [applicationId]: "ready" }));
    }, 950);
  }

  return (
    <main className="min-h-screen bg-[#f5f7f3] text-slate-950">
      <div className="mx-auto max-w-[1760px] px-4 py-5 sm:px-6">
        <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#0d9488]">
              FirstReply
            </p>
            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-5xl">
              Suivi de tes candidatures
            </h1>
            <p className="mt-2 text-base font-medium text-slate-600">
              La galère, mais rangée proprement.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block sm:w-72">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-10 text-sm font-semibold outline-none transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-4 focus:ring-teal-600/10"
              />
            </label>
            <button
              onClick={resetDemo}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0d9488] px-4 text-sm font-black text-white shadow-lg shadow-teal-900/10 transition hover:bg-[#0f766e]"
            >
              <Plus className="h-4 w-4" />
              Nouvelle candidature
            </button>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatCard label="Candidatures" value={stats.total} tone="neutral" />
          <StatCard label="Refusés" value={stats.rejected} tone="rejected" />
          <StatCard label="Ghostés" value={stats.ghosted} tone="ghosted" />
          <StatCard label="Entretiens" value={stats.interviews} tone="interview" />
          <StatCard label="Offres" value={stats.offers} tone="offer" />
        </section>

        <section className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/60 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
              Toutes <span>{stats.total}</span>
            </FilterButton>
            <FilterButton active={filter === "active"} onClick={() => setFilter("active")}>
              En cours <span>{stats.active}</span>
            </FilterButton>
            <FilterButton active={filter === "rejected"} onClick={() => setFilter("rejected")}>
              Refusés <span>{stats.rejectedGroup}</span>
            </FilterButton>
            <FilterButton active={filter === "interviews"} onClick={() => setFilter("interviews")}>
              Entretiens <span>{stats.interviews}</span>
            </FilterButton>
            <FilterButton active={filter === "offers"} onClick={() => setFilter("offers")}>
              Offres <span>{stats.offers}</span>
            </FilterButton>
          </div>
          <button
            onClick={resetDemo}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300/80 bg-white/60 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-[#0d9488] hover:text-[#0d9488]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset démo
          </button>
        </section>

        <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6">
          {visibleApplications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              menuOpen={openStatusMenu === application.id}
              followupState={followups[application.id] ?? "idle"}
              onToggleMenu={() =>
                setOpenStatusMenu((current) =>
                  current === application.id ? "" : application.id
                )
              }
              onStatusChange={(status) => updateApplicationStatus(application.id, status)}
              onGenerateFollowup={() => fakeGenerateFollowup(application.id)}
            />
          ))}
        </section>
      </div>

      {openStatusMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenStatusMenu("")} />
      )}
      {celebrating && <CelebrationOverlay />}
    </main>
  );
}

function ApplicationCard({
  application,
  menuOpen,
  followupState,
  onToggleMenu,
  onStatusChange,
  onGenerateFollowup,
}: {
  application: DemoApplication;
  menuOpen: boolean;
  followupState: FollowupState;
  onToggleMenu: () => void;
  onStatusChange: (status: PrimaryStatus) => void;
  onGenerateFollowup: () => void;
}) {
  const config = statusConfig[application.status];
  const hasAction = config.action !== "none";
  const isWon = application.status === "Offre reçue";

  return (
    <article
      className={`relative min-h-[164px] rounded-[18px] border p-3 shadow-sm transition-[border-color,box-shadow,transform,opacity] duration-200 ${
        config.cardClass
      } ${application.isHero ? "ring-2 ring-[#0d9488]/25" : ""} ${
        menuOpen ? "z-50" : ""
      } ${isWon ? "scale-[1.01]" : ""
      }`}
    >
      <div className={`absolute inset-x-4 top-0 h-1 rounded-b-full ${config.railClass}`} />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="relative">
          <button
            type="button"
            aria-label={`Changer le statut de ${application.company}`}
            onClick={onToggleMenu}
            className={`inline-flex max-w-[176px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-teal-600/10 ${config.badgeClass}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${config.dotClass}`} />
            <span className="truncate">{application.status}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-80" />
          </button>

          {menuOpen && (
            <div className="absolute left-0 top-9 z-[999] w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              {STATUS_OPTIONS.map((status) => {
                const optionConfig = statusConfig[status];

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => onStatusChange(status)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-black text-slate-700 transition hover:bg-teal-50 hover:text-[#0d9488]"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${optionConfig.menuDotClass}`} />
                    <span>{status}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <ScoreRing score={application.score} status={application.status} />
      </div>

      <h2 className="line-clamp-1 text-lg font-black tracking-[-0.03em] text-slate-950">
        {application.company}
      </h2>
      <p className="mb-3 line-clamp-1 text-[13px] font-bold text-slate-600">
        {application.role}
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5 text-[11px] font-bold text-slate-500">
        <span className="rounded-lg bg-white/65 px-2 py-1">{application.contract}</span>
        <span className="rounded-lg bg-white/65 px-2 py-1">{application.location}</span>
        <span className="rounded-lg bg-white/65 px-2 py-1">{application.compensation}</span>
      </div>

      <p className="mb-2 text-[12px] font-semibold text-slate-500">
        Postulé le {application.appliedDate}
      </p>

      <div className="flex min-h-8 items-center justify-between gap-3">
        <p className={`line-clamp-1 text-[12px] font-black ${config.secondaryClass}`}>
          {config.secondaryLabel}
        </p>
        {hasAction && (
          <button
            onClick={onGenerateFollowup}
            className={`shrink-0 rounded-xl px-2.5 py-1 text-[11px] font-black transition ${config.actionClass}`}
          >
            {getActionLabel(config.action, followupState)}
          </button>
        )}
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "rejected" | "ghosted" | "interview" | "offer";
}) {
  const styles = {
    neutral: "border-slate-200 bg-white/60 text-slate-900",
    rejected: "border-red-200 bg-red-50/70 text-red-700",
    ghosted: "border-zinc-200 bg-zinc-50/80 text-zinc-700",
    interview: "border-blue-200 bg-blue-50/80 text-blue-800",
    offer: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
  };

  return (
    <article className={`rounded-[22px] border px-4 py-3 shadow-sm ${styles[tone]}`}>
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.13em] opacity-65">
        {label}
      </p>
      <p className="font-mono text-3xl font-black tracking-[-0.05em]">{value}</p>
    </article>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 border-b-4 px-1 pb-2 text-sm font-black transition ${
        active
          ? "border-[#0d9488] text-[#00796b]"
          : "border-transparent text-slate-700 hover:text-[#0d9488]"
      }`}
    >
      {children}
    </button>
  );
}

function ScoreRing({ score, status }: { score: number; status: PrimaryStatus }) {
  const safeScore = Math.max(0, Math.min(100, score));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeScore / 100) * circumference;
  const color = status === "Offre reçue" ? "#059669" : scoreColor(score);

  return (
    <div
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
        status === "Offre reçue"
          ? "shadow-[0_0_24px_rgba(13,148,136,0.35)]"
          : ""
      }`}
    >
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 52 52" aria-hidden="true">
        <circle
          cx="26"
          cy="26"
          r={radius}
          stroke="rgba(255,255,255,0.86)"
          strokeWidth="5"
          fill="none"
        />
        <circle
          cx="26"
          cy="26"
          r={radius}
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute font-mono text-[13px] font-black" style={{ color }}>
        {safeScore}
      </span>
    </div>
  );
}

function CelebrationOverlay() {
  const floaters = ["🎉", "✨", "💌", "📄", "🥲", "🎉", "✨", "💌", "📄", "🥲", "🎉", "✨"];

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center overflow-hidden bg-slate-950/45 px-5 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      {floaters.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="pointer-events-none absolute text-4xl"
          style={{
            left: `${4 + index * 8}%`,
            bottom: "-64px",
            animation: `demoConfetti 4.8s ${index * 0.13}s ease-out forwards`,
          }}
        >
          {item}
        </span>
      ))}

      <div className="demo-celebration-card relative w-full max-w-[680px] rounded-[36px] border border-amber-200 bg-[linear-gradient(135deg,#fef3c7,#ecfdf5_45%,#ffffff)] px-8 py-10 text-center shadow-2xl">
        <p className="demo-line-1 text-2xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl">
          La guerre est finie.
        </p>
        <p className="demo-line-2 mt-5 text-4xl font-black tracking-[-0.05em] text-[#00796b] sm:text-6xl">
          Elle a dit OUI.
        </p>
        <p className="demo-line-3 mt-5 text-xl font-black text-slate-700 sm:text-3xl">
          Non... tu nous quittes déjà ? 😭
        </p>
        <p className="demo-line-4 mt-6 text-lg font-bold text-amber-700 sm:text-2xl">
          Bravo. Va signer ton contrat.
        </p>
      </div>

      <style jsx>{`
        @keyframes demoConfetti {
          0% {
            opacity: 0;
            transform: translateY(0) rotate(0deg) scale(0.7);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(-115vh) rotate(520deg) scale(1.2);
          }
        }

        .demo-celebration-card {
          animation: demoBounce 0.7s cubic-bezier(0.2, 1.4, 0.4, 1) both;
        }

        .demo-line-1,
        .demo-line-2,
        .demo-line-3,
        .demo-line-4 {
          opacity: 0;
          transform: translateY(14px);
          animation: demoReveal 0.45s ease-out forwards;
        }

        .demo-line-1 {
          animation-delay: 0.15s;
        }

        .demo-line-2 {
          animation-delay: 1.05s;
        }

        .demo-line-3 {
          animation-delay: 2.05s;
        }

        .demo-line-4 {
          animation-delay: 3.1s;
        }

        @keyframes demoBounce {
          0% {
            transform: translateY(20px) scale(0.92);
            opacity: 0;
          }
          70% {
            transform: translateY(-6px) scale(1.02);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        @keyframes demoReveal {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function buildApplication(index: number): DemoApplication {
  const status = getGeneratedStatus(index);
  const role = ROLES[(index * 7) % ROLES.length];
  const company = COMPANIES[(index * 11) % COMPANIES.length];
  const contract = CONTRACTS[(index * 5) % CONTRACTS.length];
  const location = LOCATIONS[(index * 13) % LOCATIONS.length];
  const compensation = COMPENSATIONS[(index * 9) % COMPENSATIONS.length];
  const score = getGeneratedScore(index, role, status);

  return {
    id: `demo-${index + 1}`,
    company,
    role,
    score,
    status,
    contract,
    location,
    compensation,
    appliedDate: APPLIED_DATES[index % APPLIED_DATES.length],
  };
}

function getGeneratedStatus(index: number): PrimaryStatus {
  if (index < 62) return "Refusé";
  if (index < 78) return "Ghosté";
  if (index < 86) return "À relancer";
  if (index < 92) return "En attente";
  if (index < 96) return "Entretien";
  return (["Ghosté", "Refusé", "Refusé", "Refusé"] as PrimaryStatus[])[index - 96];
}

function getGeneratedScore(index: number, role: string, status: PrimaryStatus) {
  if (status === "Refusé") return [24, 31, 42, 56, 61, 68][index % 6];
  if (status === "Ghosté") return [52, 64, 71, 76, 83, 88][index % 6];
  if (status === "À relancer") return [55, 67, 72, 78, 82, 86][index % 6];
  if (status === "Offre reçue") return [86, 91, 94][index % 3];
  if (status === "Entretien") return [72, 79, 84, 89, 67, 81][index % 6];

  const isTech = /AI|Data|ML|Engineer|Developer|Cloud|Cybersecurity|DevOps/i.test(role);
  if (isTech) return [66, 73, 78, 82, 87][index % 5];
  return [35, 44, 58, 62, 69][index % 5];
}

function getActionLabel(action: DemoAction, state: FollowupState) {
  if (state === "loading") return "Préparation...";
  if (state === "ready") return "Relance prête";
  if (action === "followup") return "Générer la relance ✨";
  if (action === "interview") return "Préparer entretien";
  return "";
}

function matchesFilter(application: DemoApplication, filter: DemoFilter) {
  if (filter === "all") return true;
  if (filter === "active") {
    return ["À relancer", "En attente", "Entretien"].includes(application.status);
  }
  if (filter === "rejected") {
    return ["Refusé", "Ghosté"].includes(application.status);
  }
  if (filter === "interviews") {
    return application.status === "Entretien";
  }
  return application.status === "Offre reçue";
}

function getStats(applications: DemoApplication[]) {
  const rejected = applications.filter((a) => a.status === "Refusé").length;
  const ghosted = applications.filter((a) => a.status === "Ghosté").length;
  const interviews = applications.filter((a) => a.status === "Entretien").length;
  const offers = applications.filter((a) => a.status === "Offre reçue").length;
  const active = applications.filter((a) =>
    ["À relancer", "En attente", "Entretien"].includes(a.status)
  ).length;

  return {
    total: applications.length,
    active,
    rejected,
    ghosted,
    rejectedGroup: rejected + ghosted,
    interviews,
    offers,
  };
}

function getPriority(application: DemoApplication) {
  if (application.isHero) return 0;
  // Knuth multiplicative hash — deterministic but visually shuffled
  const n = Number(application.id.replace("demo-", ""));
  return ((n * 2654435761) >>> 0) % 10000;
}

function scoreColor(score: number) {
  if (score < 35) return "#94a3b8";
  if (score < 65) return "#d97706";
  return "#00796b";
}
