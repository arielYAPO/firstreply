"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Send, BarChart3 } from "lucide-react";
import { saveSession } from "@/lib/session";

/* ──────────────────────────────────────────────
   Main component
   ────────────────────────────────────────────── */
export default function AccessGate() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const normalizedKey = key.trim().toUpperCase();

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: normalizedKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Code invalide. Vérifie ton code et réessaie.");
        setShake(true);
        window.setTimeout(() => setShake(false), 500);
        return;
      }

      saveSession({
        key: data.key,
        creditsLimit: data.creditsLimit,
        creditsUsed: data.creditsUsed,
        creditsRemaining: data.creditsRemaining,
      });

      window.location.assign("/dashboard");
    } catch {
      setError("Impossible de vérifier la clé.");
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-[#f5f7f3] text-slate-950 overflow-x-hidden">
      {/* Subtle grid bg */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(13,148,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(13,148,136,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow orbs */}
      <div className="pointer-events-none fixed -top-[200px] -left-[100px] h-[500px] w-[500px] rounded-full bg-teal-400/[0.07] blur-[100px]" />
      <div className="pointer-events-none fixed -bottom-[200px] -right-[100px] h-[400px] w-[400px] rounded-full bg-teal-500/[0.05] blur-[100px]" />

      {/* ── NAV ── */}
      <FloatingNav />

      {/* ── HERO ── */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 pb-16 pt-32 text-center">
        <FadeUp>
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-teal-200 bg-teal-50/60 px-4 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0d9488] shadow-[0_0_8px_rgba(13,148,136,0.6)] animate-pulse" />
            <span className="font-mono text-[11px] font-semibold text-[#0d9488]">
              Accès anticipé · ouvert
            </span>
          </div>
        </FadeUp>

        <FadeUp delay={1}>
          <h1 className="mx-auto max-w-[800px] text-[clamp(36px,6vw,72px)] font-black leading-[0.95] tracking-[-0.04em]">
            Obtiens ta première{" "}
            <span className="font-['Instrument_Serif'] font-normal italic text-[#0d9488]">
              réponse.
            </span>
          </h1>
        </FadeUp>

        <FadeUp delay={2}>
          <p className="mx-auto mt-5 max-w-[520px] text-[clamp(15px,1.3vw,18px)] font-medium leading-relaxed text-slate-500">
            Colle une offre, on te prépare un plan d'attaque complet.
            Candidature ciblée, bon contact, relances au bon moment.
          </p>
        </FadeUp>

        <FadeUp delay={3}>
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-10 w-full max-w-[520px]"
          >
            <div
              className={`flex items-center gap-2 rounded-2xl border bg-white p-2 shadow-lg shadow-slate-900/[0.04] transition focus-within:border-[#0d9488] focus-within:ring-4 focus-within:ring-teal-600/10 ${
                error ? "border-red-400" : "border-slate-200"
              } ${shake ? "animate-[shake_0.4s_ease]" : ""}`}
            >
              <input
                type="text"
                placeholder="Code d'accès"
                value={key}
                onChange={(event) => {
                  setKey(event.target.value.toUpperCase());
                  setError("");
                }}
                className="flex-1 bg-transparent px-4 py-3 text-sm font-semibold tracking-[0.03em] text-slate-950 outline-none placeholder:text-slate-400"
              />
              <button
                disabled={loading}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0d9488] px-5 py-3 text-sm font-black text-white transition hover:bg-[#0f766e] disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span className="hidden sm:inline">Vérification...</span>
                  </>
                ) : (
                  <>
                    Commencer
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
            {error && (
              <p className="mt-2 text-left text-[12px] font-bold text-red-500">
                {error}
              </p>
            )}
          </form>
        </FadeUp>

        <FadeUp delay={4}>
          <p className="mt-4 font-mono text-[11px] text-slate-400">
            Pas encore de code ?{" "}
            <span className="font-semibold text-[#0d9488]">
              Demande un accès.
            </span>
          </p>
        </FadeUp>
      </section>

      {/* ── STEPS ── */}
      <section id="comment" className="relative z-10 mx-auto max-w-[1100px] px-5 py-20">
        <FadeUp>
          <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0d9488]">
            Comment ça marche
          </p>
        </FadeUp>
        <FadeUp delay={1}>
          <h2 className="mb-3 max-w-[600px] text-[clamp(28px,4vw,48px)] font-black leading-[1.02] tracking-[-0.03em]">
            Trois étapes,{" "}
            <span className="font-['Instrument_Serif'] font-normal italic text-[#0d9488]">
              zéro prise de tête.
            </span>
          </h2>
        </FadeUp>
        <FadeUp delay={2}>
          <p className="mb-14 max-w-[480px] text-base font-medium text-slate-500">
            Pas de formulaire interminable. Tu colles, on analyse, tu envoies.
          </p>
        </FadeUp>

        <div className="grid border-t border-slate-200/80 sm:grid-cols-3">
          <Step
            n="01"
            icon={<Search className="h-5 w-5" />}
            title="Colle l'offre"
            description="On analyse le poste, compare avec ton profil et calcule ton score de match."
            delay={0}
          />
          <Step
            n="02"
            icon={<Send className="h-5 w-5" />}
            title="On prépare tout"
            description="Message personnalisé, lettre de motivation, recherche du bon contact."
            delay={1}
          />
          <Step
            n="03"
            icon={<BarChart3 className="h-5 w-5" />}
            title="Tu relances"
            description="Relance J+3, J+7, tout est prêt. Tu copies, tu envoies, c'est fait."
            delay={2}
            last
          />
        </div>
      </section>

      {/* ── MOCKUP ── */}
      <section id="demo" className="relative z-10 mx-auto max-w-[1100px] px-5 py-10">
        <FadeUp>
          <p className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0d9488]">
            Voir en action
          </p>
        </FadeUp>
        <FadeUp delay={1}>
          <h2 className="mb-3 max-w-[600px] text-[clamp(28px,4vw,48px)] font-black leading-[1.02] tracking-[-0.03em]">
            Un dashboard qui{" "}
            <span className="font-['Instrument_Serif'] font-normal italic text-[#0d9488]">
              fait le taf.
            </span>
          </h2>
        </FadeUp>
        <FadeUp delay={2}>
          <p className="mb-12 max-w-[480px] text-base font-medium text-slate-500">
            Chaque candidature devient une carte. Tu vois tout, tu oublies rien.
          </p>
        </FadeUp>

        <FadeUp delay={3}>
          <MockupTracker />
        </FadeUp>
      </section>

      {/* ── STATS STRIP ── */}
      <section className="relative z-10 mx-auto max-w-[1100px] px-5 py-20">
        <div className="grid grid-cols-2 border-t border-slate-200/80 sm:grid-cols-4">
          <StatCell value="100" unit="+" label="candidatures gérées par utilisateur en moyenne" delay={0} />
          <StatCell value="3" unit="min" label="pour préparer une candidature complète avec relances" delay={1} />
          <StatCell value="64" unit="%" label="de refus en moyenne — c'est normal, continue" delay={2} />
          <StatCell value="1" unit="oui" label="suffit. C'est tout ce qu'il te faut pour décrocher" delay={3} last />
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 px-5 py-24 text-center">
        <FadeUp>
          <p className="mb-6 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0d9488]">
            Prêt ?
          </p>
        </FadeUp>
        <FadeUp delay={1}>
          <h2 className="mx-auto max-w-[700px] text-[clamp(28px,5vw,56px)] font-black leading-[1] tracking-[-0.03em]">
            Arrête de postuler{" "}
            <span className="font-['Instrument_Serif'] font-normal italic text-[#0d9488]">
              dans le vide.
            </span>
          </h2>
        </FadeUp>
        <FadeUp delay={2}>
          <p className="mx-auto mt-4 max-w-[400px] text-base font-medium text-slate-500">
            Un code d'accès, et tu commences à candidater intelligemment.
          </p>
        </FadeUp>
        <FadeUp delay={3}>
          <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-[#0d9488] px-7 py-3.5 text-sm font-black text-white shadow-lg shadow-teal-900/10 transition hover:bg-[#0f766e]"
            >
              Entrer mon code
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </FadeUp>
      </section>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200/60 px-6 py-8 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0d9488] font-mono text-[11px] font-bold text-white">
            F
          </span>
          <span className="text-sm font-black text-slate-950">FIRSTREPLY</span>
        </div>
        <p className="text-[11px] font-medium text-slate-400">
          Fait pour ceux qui en ont marre de postuler dans le vide.
        </p>
      </footer>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────── */

function FloatingNav() {
  return (
    <nav className="fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-slate-200/60 bg-[#f5f7f3]/70 px-3 py-2 pl-5 shadow-lg shadow-slate-900/[0.04] backdrop-blur-xl sm:gap-8">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#0d9488] font-mono text-[11px] font-bold text-white">
          F
        </span>
        <span className="text-sm font-black tracking-[-0.02em] text-slate-950">
          FIRSTREPLY
        </span>
      </div>

      <div className="hidden items-center gap-6 sm:flex">
        <a
          href="#comment"
          className="text-[12px] font-semibold text-slate-500 transition hover:text-slate-950"
        >
          Comment ça marche
        </a>
        <a
          href="#demo"
          className="text-[12px] font-semibold text-slate-500 transition hover:text-slate-950"
        >
          Démo
        </a>
      </div>

      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        className="rounded-full bg-[#0d9488] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#0f766e]"
      >
        Accéder
      </a>
    </nav>
  );
}

function Step({
  n,
  icon,
  title,
  description,
  delay,
  last,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
  last?: boolean;
}) {
  return (
    <FadeUp delay={delay}>
      <div
        className={`px-1 py-10 transition sm:px-8 ${
          last ? "" : "border-b border-slate-200/80 sm:border-b-0 sm:border-r"
        }`}
      >
        <p className="mb-5 font-mono text-[11px] font-semibold tracking-[0.2em] text-[#0d9488]">
          {n}
        </p>
        <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-[#0d9488]">
          {icon}
        </div>
        <h3 className="mb-2 text-lg font-black tracking-[-0.02em] text-slate-950">
          {title}
        </h3>
        <p className="text-[13px] font-medium leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
    </FadeUp>
  );
}

function StatCell({
  value,
  unit,
  label,
  delay,
  last,
}: {
  value: string;
  unit: string;
  label: string;
  delay: number;
  last?: boolean;
}) {
  return (
    <FadeUp delay={delay}>
      <div
        className={`px-2 py-10 sm:px-6 ${
          last
            ? ""
            : "border-b border-slate-200/80 sm:border-b-0 sm:border-r"
        }`}
      >
        <p className="mb-2 font-mono text-[clamp(32px,4vw,48px)] font-bold leading-[0.95] tracking-[-0.04em] text-[#0d9488]">
          {value}
          <span className="ml-1 text-[0.4em] font-medium text-slate-400">
            {unit}
          </span>
        </p>
        <p className="max-w-[200px] text-[13px] font-medium text-slate-500">
          {label}
        </p>
      </div>
    </FadeUp>
  );
}

function MockupTracker() {
  const cards = [
    {
      company: "Mistral AI",
      role: "AI Engineer — LLM & RAG",
      score: 84,
      status: "Entretien",
      statusClass: "border-blue-200 bg-blue-100 text-blue-800",
      dotClass: "bg-blue-600",
      railClass: "bg-blue-500",
      cardClass: "border-blue-200 bg-blue-50/75",
      secondary: "Entretien à préparer",
      secondaryClass: "text-blue-700",
    },
    {
      company: "Dust",
      role: "Software Engineer — AI Platform",
      score: 72,
      status: "À relancer",
      statusClass: "border-violet-100 bg-violet-50 text-violet-700",
      dotClass: "bg-violet-500",
      railClass: "bg-violet-400",
      cardClass: "border-violet-100 bg-violet-50/50",
      secondary: "Relance à envoyer",
      secondaryClass: "text-violet-700",
    },
    {
      company: "Dataiku",
      role: "ML Engineer Intern",
      score: 91,
      status: "Offre reçue",
      statusClass: "border-emerald-600 bg-emerald-500 text-white font-bold",
      dotClass: "bg-white",
      railClass: "bg-emerald-500",
      cardClass:
        "border-emerald-300 bg-[linear-gradient(135deg,#ecfdf5,#ffffff_62%,#fefce8)] shadow-[0_18px_55px_rgba(16,185,129,0.18)]",
      secondary: "La guerre est finie",
      secondaryClass: "text-emerald-700",
    },
  ];

  return (
    <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white/50 shadow-xl shadow-slate-900/[0.06]">
      {/* Top gradient line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-[#0d9488] to-transparent opacity-40" />

      <div className="p-5 sm:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 pb-5">
          <div className="flex items-center gap-2.5 font-mono text-[11px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-[#0d9488] shadow-[0_0_6px_rgba(13,148,136,0.5)]" />
            firstreply · tracker
          </div>
          <div className="flex gap-4 font-mono text-[10px] text-slate-400">
            <span>
              <strong className="text-slate-500">Actives</strong>: 18
            </span>
            <span>
              <strong className="text-slate-500">Entretiens</strong>: 5
            </span>
            <span>
              <strong className="text-slate-500">Total</strong>: 100
            </span>
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <div
              key={card.company}
              className={`relative rounded-[18px] border p-3.5 shadow-sm ${card.cardClass}`}
            >
              <div
                className={`absolute inset-x-4 top-0 h-1 rounded-b-full ${card.railClass}`}
              />

              <div className="mb-3 flex items-start justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${card.statusClass}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${card.dotClass}`}
                  />
                  {card.status}
                </span>
                <MiniScoreRing score={card.score} />
              </div>

              <h4 className="text-sm font-black tracking-[-0.02em] text-slate-950">
                {card.company}
              </h4>
              <p className="mb-3 text-[11px] font-bold text-slate-500">
                {card.role}
              </p>
              <p className={`text-[11px] font-black ${card.secondaryClass}`}>
                {card.secondary}
              </p>
            </div>
          ))}
        </div>

        {/* Metrics row */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200/80 bg-[#f5f7f3]/50 px-4 py-3">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Score moyen
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-[#0d9488]">
              72
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-[#f5f7f3]/50 px-4 py-3">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Taux de réponse
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-amber-500">
              18%
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-[#f5f7f3]/50 px-4 py-3">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Relances envoyées
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-950">
              47
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniScoreRing({ score }: { score: number }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 65 ? "#0d9488" : score >= 40 ? "#d97706" : "#94a3b8";

  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
      <svg
        className="h-9 w-9 -rotate-90"
        viewBox="0 0 36 36"
        aria-hidden="true"
      >
        <circle
          cx="18"
          cy="18"
          r={radius}
          stroke="rgba(255,255,255,0.86)"
          strokeWidth="3.5"
          fill="none"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className="absolute font-mono text-[10px] font-black"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Fade-up animation (intersection observer)
   ────────────────────────────────────────────── */
function FadeUp({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="transition-[opacity,transform] duration-700"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(24px)",
        transitionDelay: `${delay * 0.1}s`,
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {children}
    </div>
  );
}
