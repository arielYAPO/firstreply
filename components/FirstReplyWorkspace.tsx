"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  APPLICATIONS_STORAGE_KEY,
  APPLICATIONS_UPDATED_EVENT,
  APPLICATION_STATUSES,
  type ApplicationStatus,
  type TrackedApplication,
} from "@/lib/applications";
import {
  clearSession,
  loadSession,
  saveSession,
  type FirstReplySession,
} from "@/lib/session";
import { useAuthContext } from "@/components/AuthProvider";
import {
  fetchApplications,
  upsertApplication,
  updateApplication as updateApplicationDB,
  deleteApplication as deleteApplicationDB,
} from "@/lib/applicationsDB";
import BuyCreditsPanel from "@/components/BuyCreditsPanel";

type Phase = "input" | "analyzing" | "result" | "outreach";
type OutreachResult = {
  emailFormats: string[];
  emailFormatsDisclaimer: string;
  personalizedDirectEmail: string;
  personalizedLinkedInDM: string;
  followUpJ3: string;
  followUpJ7: string;
};
type TrackerFilter = "active" | "all" | "won";
type TrackerSort = "priority" | "recent";
type TrackerUrgency = "overdue" | "today" | "interview" | "waiting" | "prepared" | "won" | "done";
type CelebrationState = {
  company: string;
} | null;

const ANALYSIS_STEPS = [
  "Lecture de l'offre",
  "Extraction et évaluation des critères",
  "Calcul du score de correspondance",
  "Rédaction du dossier de candidature",
  "Préparation du plan de contact",
];

const ONBOARDING_STORAGE_PREFIX = "firstreply_onboarding_v1";
const ONBOARDING_STARTED_STORAGE_PREFIX = "firstreply_onboarding_v1_started";
const DRAFT_STORAGE_PREFIX = "firstreply_draft_v1";

// Le stockage local peut échouer (quota dépassé sur un CV très long, navigation
// privée, stockage bloqué). Ces écritures sont du confort : elles ne doivent
// jamais interrompre une analyse réussie.
function safeStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignoré volontairement.
  }
}

function safeStorageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignoré volontairement.
  }
}

type TrackerStatusConfig = {
  badgeClass: string;
  cardClass: string;
  railClass: string;
  dotClass: string;
  menuDotClass: string;
  secondaryClass: string;
  secondaryLabel: string;
};

const tealActionClass =
  "border border-teal-200 bg-teal-50/70 text-teal-700 hover:bg-teal-100";

// Le prix doit rester visible avant le mur, pas seulement une fois le solde
// a zero : un compteur sans prix ne veut rien dire.
const CREDIT_PACK_LABEL = "100 analyses pour 10 €";
const LOW_CREDITS_THRESHOLD = 2;

const trackerStatusConfig: Record<ApplicationStatus, TrackerStatusConfig> = {
  "A contacter": {
    badgeClass: "border-slate-300 bg-slate-100 text-slate-700",
    cardClass: "border-slate-200 bg-white/60",
    railClass: "bg-slate-400",
    dotClass: "bg-slate-500",
    menuDotClass: "bg-slate-500",
    secondaryClass: "text-slate-600",
    secondaryLabel: "Prêt à envoyer",
  },
  "Message envoye": {
    badgeClass: "border-amber-100 bg-amber-50 text-amber-700",
    cardClass: "border-amber-200 bg-amber-50/40",
    railClass: "bg-amber-400",
    dotClass: "bg-amber-500",
    menuDotClass: "bg-amber-500",
    secondaryClass: "text-amber-700",
    secondaryLabel: "Réponse attendue",
  },
  "Relance J+3": {
    badgeClass: "border-violet-100 bg-violet-50 text-violet-700",
    cardClass: "border-violet-100 bg-violet-50/50",
    railClass: "bg-violet-400",
    dotClass: "bg-violet-500",
    menuDotClass: "bg-violet-500",
    secondaryClass: "text-violet-700",
    secondaryLabel: "Relance à envoyer",
  },
  "Relance J+7": {
    badgeClass: "border-violet-200 bg-violet-100 text-violet-800",
    cardClass: "border-violet-100 bg-violet-50/50",
    railClass: "bg-violet-500",
    dotClass: "bg-violet-600",
    menuDotClass: "bg-violet-600",
    secondaryClass: "text-violet-800",
    secondaryLabel: "Dernière relance",
  },
  "Reponse recue": {
    badgeClass: "border-blue-100 bg-blue-50 text-blue-700",
    cardClass: "border-blue-200 bg-blue-50/50",
    railClass: "bg-blue-400",
    dotClass: "bg-blue-500",
    menuDotClass: "bg-blue-500",
    secondaryClass: "text-blue-700",
    secondaryLabel: "Réponse reçue",
  },
  Entretien: {
    badgeClass: "border-blue-200 bg-blue-100 text-blue-800",
    cardClass: "border-blue-200 bg-blue-50/75",
    railClass: "bg-blue-500",
    dotClass: "bg-blue-600",
    menuDotClass: "bg-blue-600",
    secondaryClass: "text-blue-800",
    secondaryLabel: "Entretien à préparer",
  },
  Refus: {
    badgeClass: "border-red-300 bg-red-100 text-red-700",
    cardClass: "border-red-200 bg-red-50/50 opacity-90",
    railClass: "bg-red-400",
    dotClass: "bg-red-500",
    menuDotClass: "bg-red-500",
    secondaryClass: "text-red-600",
    secondaryLabel: "Refusé",
  },
  Archive: {
    badgeClass: "border-zinc-200 bg-zinc-100 text-zinc-500",
    cardClass: "border-zinc-200 bg-zinc-50/50 opacity-75",
    railClass: "bg-zinc-300",
    dotClass: "bg-zinc-400",
    menuDotClass: "bg-zinc-400",
    secondaryClass: "text-zinc-500",
    secondaryLabel: "Terminé",
  },
  Won: {
    badgeClass: "border-emerald-600 bg-emerald-500 text-white font-bold",
    cardClass:
      "border-emerald-300 bg-[linear-gradient(135deg,#ecfdf5,#ffffff_62%,#fefce8)] shadow-[0_18px_55px_rgba(16,185,129,0.18)]",
    railClass: "bg-emerald-500",
    dotClass: "bg-white",
    menuDotClass: "bg-emerald-500",
    secondaryClass: "text-emerald-700",
    secondaryLabel: "Décroché !",
  },
  "No response": {
    badgeClass: "border-zinc-300 bg-zinc-200 text-zinc-700",
    cardClass: "border-zinc-300 bg-zinc-100 opacity-85",
    railClass: "bg-zinc-400",
    dotClass: "bg-zinc-500",
    menuDotClass: "bg-zinc-500",
    secondaryClass: "text-zinc-600",
    secondaryLabel: "Sans réponse",
  },
};

const TRACKER_STATUS_OPTIONS = APPLICATION_STATUSES.filter(
  (s) => !["Archive", "No response"].includes(s)
);

export default function FirstReplyWorkspace() {
  const router = useRouter();
  const auth = useAuthContext();
  const isAuthenticated = !!auth.user;
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const outreachRef = useRef<HTMLDivElement | null>(null);
  const contactSectionRef = useRef<HTMLElement | null>(null);
  const [session, setSession] = useState<FirstReplySession | null>(null);
  const [applications, setApplications] = useState<TrackedApplication[]>([]);
  const [activeApplication, setActiveApplication] =
    useState<TrackedApplication | null>(null);
  const [phase, setPhase] = useState<Phase>("input");
  const [offer, setOffer] = useState("");
  const [profile, setProfile] = useState("");
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [contactHighlight, setContactHighlight] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [loadingPhase2, setLoadingPhase2] = useState(false);
  const [contactName, setContactName] = useState("");
  const [domain, setDomain] = useState("");
  const [preparedContact, setPreparedContact] = useState("");
  const [preparedDomain, setPreparedDomain] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [error, setError] = useState("");
  const [contactError, setContactError] = useState("");
  const [outreachResult, setOutreachResult] = useState<OutreachResult | null>(null);
  const [trackerFilter, setTrackerFilter] = useState<TrackerFilter>("active");
  const [trackerSearch, setTrackerSearch] = useState("");
  const [celebration, setCelebration] = useState<CelebrationState>(null);
  const [applicationsLoaded, setApplicationsLoaded] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [showFirstAnalysisSuccess, setShowFirstAnalysisSuccess] = useState(false);
  const [firstAnalysisCreditsRemaining, setFirstAnalysisCreditsRemaining] =
    useState<number | null>(null);

  useEffect(() => {
    if (auth.loading) return;

    if (isAuthenticated && auth.user) {
      const userId = auth.user.id;
      let cancelled = false;

      fetchApplications().then((apps) => {
        if (cancelled) return;

        setApplications(apps);
        setApplicationsLoaded(true);

        const onboardingKey = `${ONBOARDING_STORAGE_PREFIX}:${userId}`;
        const onboardingStartedKey =
          `${ONBOARDING_STARTED_STORAGE_PREFIX}:${userId}`;
        const onboardingDone = localStorage.getItem(onboardingKey) === "done";
        const onboardingStarted =
          localStorage.getItem(onboardingStartedKey) === "started";

        if (apps.length > 0 && !onboardingDone) {
          safeStorageSet(onboardingKey, "done");
          safeStorageRemove(onboardingStartedKey);
        }

        setOnboardingOpen(
          apps.length === 0 && !onboardingDone && !onboardingStarted
        );
      });

      return () => {
        cancelled = true;
      };
    }

    // Fallback: access key session
    const loadedSession = loadSession();
    if (!loadedSession) {
      router.push("/");
      return;
    }
    setSession(loadedSession);
    setApplications(loadApplications());
    setApplicationsLoaded(true);
  }, [router, auth.loading, isAuthenticated, auth.user]);

  useEffect(() => {
    if (phase !== "analyzing") return;

    setLoadingStep(0);
    setElapsedSeconds(0);

    const stepInterval = window.setInterval(() => {
      setLoadingStep((current) =>
        Math.min(current + 1, ANALYSIS_STEPS.length - 1)
      );
    }, 11000);

    const clockInterval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);

    return () => {
      window.clearInterval(stepInterval);
      window.clearInterval(clockInterval);
    };
  }, [phase]);

  const draftStorageKey = `${DRAFT_STORAGE_PREFIX}:${
    auth.user?.id ?? session?.key ?? "anon"
  }`;
  const draftReady =
    !auth.loading &&
    (isAuthenticated ? applicationsLoaded : Boolean(session));

  useEffect(() => {
    if (!draftReady) return;

    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) return;

      const draft = JSON.parse(raw) as { offer?: string; profile?: string };
      const savedOffer = typeof draft.offer === "string" ? draft.offer : "";
      const savedProfile = typeof draft.profile === "string" ? draft.profile : "";

      if (savedOffer.trim() || savedProfile.trim()) {
        setOffer((current) => current || savedOffer);
        setProfile((current) => current || savedProfile);
        setDraftRestored(true);
      }
    } catch {
      safeStorageRemove(draftStorageKey);
    }
    // Restore once when the workspace becomes ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftReady]);

  useEffect(() => {
    if (!draftReady || phase !== "input") return;

    const timeout = window.setTimeout(() => {
      if (offer.trim() || profile.trim()) {
        safeStorageSet(draftStorageKey, JSON.stringify({ offer, profile }));
      } else {
        safeStorageRemove(draftStorageKey);
      }
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [offer, profile, phase, draftReady, draftStorageKey]);

  const goToContact = useCallback(() => {
    contactSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setContactHighlight(true);
    window.setTimeout(() => {
      document
        .getElementById("firstreply-contact-name")
        ?.focus({ preventScroll: true });
    }, 450);
    window.setTimeout(() => setContactHighlight(false), 2600);
  }, []);

  async function handleAnalyze() {
    setError("");
    setShowFirstAnalysisSuccess(false);
    setFirstAnalysisCreditsRemaining(null);

    if (!offer.trim() || !profile.trim()) {
      setError("Colle l'offre et ton profil avant de lancer l'analyse.");
      return;
    }

    if (!isAuthenticated) {
      const currentSession = loadSession();
      if (!currentSession) {
        router.push("/");
        return;
      }
    }

    setPhase("analyzing");

    try {
      const currentSession = loadSession();
      const response = await fetch("/api/analyze-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: currentSession?.key ?? null,
          jobOfferText: offer,
          profileText: profile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Impossible d'analyser cette candidature.");
        setPhase("input");
        return;
      }

      const application = data.application as TrackedApplication;
      const onboardingKey = auth.user
        ? `${ONBOARDING_STORAGE_PREFIX}:${auth.user.id}`
        : null;
      const completesFirstOnboarding = Boolean(
        onboardingKey &&
          applications.length === 0 &&
          localStorage.getItem(onboardingKey) !== "done"
      );

      if (isAuthenticated && auth.user) {
        const savedApplication = await upsertApplication(application, auth.user.id);
        if (!savedApplication) {
          setError("L’analyse a réussi, mais l’ajout au suivi a échoué. Réessaie.");
          setPhase("input");
          return;
        }
        const apps = await fetchApplications();
        setApplications(apps.length > 0 ? apps : [savedApplication]);
        auth.refreshCredits();
      } else {
        const nextApplications = [
          application,
          ...loadApplications().filter((item) => item.id !== application.id),
        ];
        localStorage.setItem(
          APPLICATIONS_STORAGE_KEY,
          JSON.stringify(nextApplications)
        );
        window.dispatchEvent(
          new CustomEvent(APPLICATIONS_UPDATED_EVENT, { detail: nextApplications })
        );
        setApplications(nextApplications);

        const currentSessionForUpdate = loadSession();
        if (currentSessionForUpdate) {
          const nextSession = {
            ...currentSessionForUpdate,
            creditsUsed: currentSessionForUpdate.creditsLimit - data.creditsRemaining,
            creditsRemaining: data.creditsRemaining,
          };
          saveSession(nextSession);
          setSession(nextSession);
        }
      }

      if (completesFirstOnboarding && onboardingKey) {
        safeStorageSet(onboardingKey, "done");
        if (auth.user) {
          safeStorageRemove(
            `${ONBOARDING_STARTED_STORAGE_PREFIX}:${auth.user.id}`
          );
        }
        setShowFirstAnalysisSuccess(true);
        setFirstAnalysisCreditsRemaining(
          typeof data.creditsRemaining === "number"
            ? data.creditsRemaining
            : Math.max(effectiveCredits - 1, 0)
        );
      }

      safeStorageRemove(draftStorageKey);
      setDraftRestored(false);

      setActiveApplication(application);
      setPreparedContact("");
      setPreparedDomain("");
      setContactName("");
      setContactError("");
      setOutreachResult(null);
      setDomain("");
      setInputCollapsed(true);
      setPhase("result");
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch {
      setError("Impossible de contacter le serveur d'analyse.");
      setPhase("input");
    }
  }

  async function handlePrepareOutreach() {
    const trimmedContactName = contactName.trim();
    const trimmedDomain = domain.trim().toLowerCase();

    if (!isValidFullName(trimmedContactName)) {
      setContactError("Entre un nom complet, par exemple : François Dupont.");
      return;
    }

    if (!isValidDomain(trimmedDomain)) {
      setContactError("Entre un domaine valide, par exemple : mindlapse.ai.");
      return;
    }

    setLoadingPhase2(true);
    setContactError("");

    try {
      const response = await fetch("/api/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: session?.key,
          application: activeApplication,
          contactName: trimmedContactName,
          domain: trimmedDomain,
          jobOfferText: offer,
          profileText: profile,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setContactError(data.error || "Impossible de préparer l'approche directe.");
        return;
      }

      setOutreachResult({
        emailFormats: safeList(data.emailFormats),
        emailFormatsDisclaimer:
          typeof data.emailFormatsDisclaimer === "string"
            ? data.emailFormatsDisclaimer
            : "Formats probables, non vérifiés.",
        personalizedDirectEmail:
          typeof data.personalizedDirectEmail === "string" ? data.personalizedDirectEmail : "",
        personalizedLinkedInDM:
          typeof data.personalizedLinkedInDM === "string" ? data.personalizedLinkedInDM : "",
        followUpJ3: typeof data.followUpJ3 === "string" ? data.followUpJ3 : "",
        followUpJ7: typeof data.followUpJ7 === "string" ? data.followUpJ7 : "",
      });
      setPreparedContact(trimmedContactName);
      setPreparedDomain(trimmedDomain);
      setPhase("outreach");
      window.setTimeout(() => {
        outreachRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } catch {
      setContactError("Impossible de préparer l'approche directe.");
    } finally {
      setLoadingPhase2(false);
    }
  }

  async function copyText(key: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(""), 1800);
  }

  function updateApplications(
    updater: (applications: TrackedApplication[]) => TrackedApplication[]
  ) {
    if (isAuthenticated) {
      setApplications((prev) => {
        const next = updater(prev);
        setActiveApplication((current) =>
          current
            ? next.find((app) => app.id === current.id) ?? current
            : current
        );
        return next;
      });
      return;
    }

    const nextApplications = updater(loadApplications());

    localStorage.setItem(
      APPLICATIONS_STORAGE_KEY,
      JSON.stringify(nextApplications)
    );
    window.dispatchEvent(
      new CustomEvent(APPLICATIONS_UPDATED_EVENT, { detail: nextApplications })
    );
    setApplications(nextApplications);
    setActiveApplication((current) =>
      current
        ? nextApplications.find((application) => application.id === current.id) ?? current
        : current
    );
  }

  function updateTrackerApplication(applicationId: string, patch: Partial<TrackedApplication>) {
    updateApplications((currentApplications) =>
      currentApplications.map((application) =>
        application.id === applicationId ? { ...application, ...patch } : application
      )
    );
    if (isAuthenticated) {
      updateApplicationDB(applicationId, patch);
    }
  }

  function markTrackerActionDone(application: TrackedApplication) {
    const trackerState = getTrackerState(application);
    const today = new Date();

    if (trackerState.actionType === "send_application") {
      updateTrackerApplication(application.id, {
        status: "Message envoye",
        sentAt: today.toISOString(),
        followupStep: "j3",
        nextActionType: "followup_j3",
        nextActionDueAt: addDays(today, 3).toISOString(),
        nextAction: "Relance J+3",
        nextFollowUpDate: formatDisplayDate(addDays(today, 3)),
      });
      return;
    }

    if (trackerState.actionType === "followup_j3") {
      const sentDate = parseDate(application.sentAt) ?? today;
      const j7Date = addDays(sentDate, 7);
      updateTrackerApplication(application.id, {
        status: "Relance J+7",
        followupStep: "j7",
        nextActionType: "followup_j7",
        nextActionDueAt: j7Date.toISOString(),
        nextAction: "Relance J+7",
        nextFollowUpDate: formatDisplayDate(j7Date),
      });
      return;
    }

    if (trackerState.actionType === "followup_j7") {
      updateTrackerApplication(application.id, {
        status: "Archive",
        followupStep: "done",
        nextActionType: "none",
        nextActionDueAt: "",
        nextAction: "Passer à la prochaine candidature",
        nextFollowUpDate: "",
      });
    }
  }

  function markApplicationWon(application: TrackedApplication) {
    updateTrackerApplication(application.id, {
      status: "Won",
      wonAt: new Date().toISOString(),
      nextActionType: "none",
      nextActionDueAt: "",
      nextAction: "Candidature décrochée",
      nextFollowUpDate: "",
    });
    setCelebration({ company: safeText(application.company, "cette candidature") });
  }

  function selectFromTracker(application: TrackedApplication) {
    setShowFirstAnalysisSuccess(false);
    setFirstAnalysisCreditsRemaining(null);
    setActiveApplication(application);
    setInputCollapsed(true);
    setPhase("result");
    setTrackerOpen(false);
    setPreparedContact("");
    setPreparedDomain("");
    setContactName("");
    setContactError("");
    setOutreachResult(null);
    setDomain("");
  }

  function startNewApplication() {
    setShowFirstAnalysisSuccess(false);
    setFirstAnalysisCreditsRemaining(null);
    setActiveApplication(null);
    setPhase("input");
    setTrackerOpen(false);
    setInputCollapsed(false);
    setOffer("");
    setProfile("");
    setError("");
    setPreparedContact("");
    setPreparedDomain("");
    setContactName("");
    setContactError("");
    setOutreachResult(null);
    setDomain("");
  }

  function handleDeleteApplication(id: string) {
    updateApplications((apps) => apps.filter((a) => a.id !== id));
    if (isAuthenticated) {
      deleteApplicationDB(id);
    }
  }

  function logout() {
    clearSession();
    // Clear all Supabase auth cookies
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (name.startsWith("sb-")) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
    // Fire signOut in background, don't wait for it
    auth.signOut().catch(() => {});
    // Force hard redirect immediately
    window.location.replace("/");
  }

  function startFirstApplication() {
    if (auth.user) {
      safeStorageSet(
        `${ONBOARDING_STARTED_STORAGE_PREFIX}:${auth.user.id}`,
        "started"
      );
    }
    setOnboardingOpen(false);
    window.setTimeout(() => {
      document.getElementById("firstreply-offer")?.focus();
    }, 0);
  }

  const effectiveCredits = isAuthenticated ? auth.credits : (session?.creditsRemaining ?? 0);

  if (
    auth.loading ||
    (!isAuthenticated && !session) ||
    (isAuthenticated && !applicationsLoaded)
  ) {
    return (
      <main className="min-h-screen bg-[#f5f7f3] p-6 text-sm font-black text-slate-400">
        Chargement...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7f3] text-slate-950">
      {phase === "analyzing" && (
        <AnalysisLoader activeStep={loadingStep} elapsedSeconds={elapsedSeconds} />
      )}

      <TopBar
        credits={effectiveCredits}
        trackerCount={applications.length}
        userName={auth.user?.user_metadata?.full_name || auth.user?.user_metadata?.name || null}
        trackerDisabled={onboardingOpen}
        onOpenTracker={() => setTrackerOpen(true)}
        onLogout={logout}
      />

      {onboardingOpen ? (
        <FirstRunWelcome
          credits={effectiveCredits}
          userName={
            auth.user?.user_metadata?.full_name ||
            auth.user?.user_metadata?.name ||
            null
          }
          onStart={startFirstApplication}
        />
      ) : trackerOpen ? (
        <TrackerBoard
          items={applications}
          filter={trackerFilter}
          search={trackerSearch}
          celebration={celebration}
          onFilterChange={setTrackerFilter}
          onSearchChange={setTrackerSearch}
          onNewApplication={startNewApplication}
          onSelect={selectFromTracker}
          onActionDone={markTrackerActionDone}
          onWon={markApplicationWon}
          onDelete={(id) => handleDeleteApplication(id)}
          onStatusChange={(id, status) => {
            if (status === "Won") {
              const app = applications.find((a) => a.id === id);
              if (app) {
                markApplicationWon(app);
              }
              return;
            }
            updateTrackerApplication(id, {
              status,
              wonAt: "",
              nextActionType: undefined,
              nextAction: "",
            });
          }}
          onCloseCelebration={() => setCelebration(null)}
        />
      ) : (
        <div className="mx-auto max-w-[720px] px-4 pb-20 pt-5 sm:px-5 sm:pt-8">
          {isAuthenticated && effectiveCredits === 0 && <BuyCreditsPanel />}
          {inputCollapsed && activeApplication && (
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => setTrackerOpen(true)}
                className="rounded-2xl border border-slate-200 bg-white/60 px-3 py-1.5 text-[11px] font-black text-slate-500 transition hover:border-[#0d9488] hover:text-[#0d9488]"
              >
                ← Suivi
              </button>
              <button
                onClick={startNewApplication}
                className="rounded-2xl border border-teal-200 bg-teal-50/70 px-3 py-1.5 text-[11px] font-black text-teal-700 transition hover:bg-teal-100"
              >
                + Nouvelle candidature
              </button>
            </div>
          )}
          {inputCollapsed && activeApplication ? (
            <CollapsedInputSummary
              application={activeApplication}
              onEdit={() => setInputCollapsed(false)}
            />
          ) : (
            <InputZone
              credits={effectiveCredits}
              offer={offer}
              profile={profile}
              phase={phase}
              error={error}
              draftRestored={draftRestored}
              onOfferChange={setOffer}
              onProfileChange={setProfile}
              onAnalyze={handleAnalyze}
              onCollapse={() => setInputCollapsed(true)}
            />
          )}

          {showFirstAnalysisSuccess && activeApplication && phase === "result" && (
            <FirstAnalysisHero
              application={activeApplication}
              creditsRemaining={firstAnalysisCreditsRemaining ?? effectiveCredits}
              onGoToContact={goToContact}
              onOpenTracker={() => setTrackerOpen(true)}
            />
          )}

          {activeApplication && (phase === "result" || phase === "outreach") && (
            <PhaseOneResult
              refNode={resultsRef}
              application={activeApplication}
              copiedKey={copiedKey}
              onCopy={copyText}
              showNextStepCta={phase === "result" && !showFirstAnalysisSuccess}
              onGoToContact={goToContact}
            />
          )}

          {activeApplication && phase === "result" && (
            <ContactFoundBox
              refNode={contactSectionRef}
              highlighted={contactHighlight}
              application={activeApplication}
              copiedKey={copiedKey}
              onCopy={copyText}
              contactName={contactName}
              domain={domain}
              loading={loadingPhase2}
              error={contactError}
              onContactChange={(value) => {
                setContactName(value);
                setContactError("");
              }}
              onDomainChange={setDomain}
              onPrepare={handlePrepareOutreach}
            />
          )}

          {activeApplication && phase === "outreach" && (
            <PhaseTwoOutreach
              refNode={outreachRef}
              application={activeApplication}
              contactName={preparedContact}
              domain={preparedDomain}
              outreach={outreachResult}
              copiedKey={copiedKey}
              onCopy={copyText}
              onNew={startNewApplication}
            />
          )}
        </div>
      )}
    </main>
  );
}

function TopBar({
  credits,
  trackerCount,
  userName,
  trackerDisabled,
  onOpenTracker,
  onLogout,
}: {
  credits: number;
  trackerCount: number;
  userName: string | null;
  trackerDisabled: boolean;
  onOpenTracker: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 flex h-[60px] items-center justify-between border-b border-slate-200/60 bg-[#f5f7f3]/90 px-4 backdrop-blur-xl sm:h-[56px] sm:px-6">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f766e] sm:text-[11px]">
        FirstReply
      </span>
      <div className="flex items-center gap-1.5 sm:gap-3">
        {userName && (
          <span className="hidden text-[11px] font-bold text-slate-500 sm:block">
            {userName}
          </span>
        )}
        <span
          title={`Crédits restants. Ensuite : ${CREDIT_PACK_LABEL}.`}
          className={`rounded-2xl border px-2.5 py-1 text-[10px] font-black sm:px-3 sm:py-1.5 sm:text-[11px] ${
            credits <= LOW_CREDITS_THRESHOLD
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-teal-200 bg-teal-50/70 text-teal-800"
          }`}
        >
          {credits} crédit{credits !== 1 ? "s" : ""}
        </span>
        <button
          onClick={onOpenTracker}
          disabled={trackerDisabled}
          title={trackerDisabled ? "Commence par préparer ta première candidature" : undefined}
          className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white/60 px-2.5 text-[10px] font-black text-slate-700 transition hover:border-[#0f766e] hover:text-[#0f766e] disabled:cursor-not-allowed disabled:opacity-45 sm:h-9 sm:px-3.5 sm:text-[11px]"
        >
          Suivi ({trackerCount})
        </button>
        <button
          onClick={onLogout}
          aria-label="Déconnexion"
          title="Déconnexion"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-red-50 hover:text-red-600 sm:h-9 sm:w-9"
        >
          <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}

function FirstRunWelcome({
  credits,
  userName,
  onStart,
}: {
  credits: number;
  userName: string | null;
  onStart: () => void;
}) {
  const firstName = userName?.trim().split(/\s+/)[0];
  const [demoOpen, setDemoOpen] = useState(false);
  const demoRef = useRef<HTMLDivElement | null>(null);

  function openDemo() {
    setDemoOpen(true);
    window.setTimeout(() => {
      demoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6 sm:py-10">
      <section className="w-full overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:rounded-[30px]">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#ecfdf5,#ffffff_58%,#f0fdfa)] px-5 py-6 sm:px-10 sm:py-10">
          <span className="inline-flex rounded-full border border-teal-200 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-teal-800">
            {credits} crédit{credits !== 1 ? "s" : ""} offert{credits !== 1 ? "s" : ""} · 1 analyse = 1 crédit
          </span>
          <h1 className="mt-4 max-w-[560px] text-[28px] font-black leading-[1.06] tracking-[-0.045em] text-slate-950 sm:mt-5 sm:text-4xl">
            {firstName ? `Bienvenue ${firstName}.` : "Bienvenue."} Obtiens ta
            première réponse plus vite.
          </h1>
          <p className="mt-3 max-w-[580px] text-sm font-medium leading-6 text-slate-600 sm:mt-4 sm:text-base">
            Colle une offre et ton CV. FirstReply calcule ton score de
            correspondance, te donne l’angle pour te démarquer, identifie qui
            contacter, rédige tes messages et relances — puis suit chaque
            candidature pour toi.
          </p>
        </div>

        <div className="grid gap-2 px-5 py-4 sm:grid-cols-3 sm:gap-3 sm:px-10 sm:py-8">
          {[
            ["01", "Colle l’offre", "Le texte complet de l’annonce suffit."],
            ["02", "Colle ton profil", "Ton CV ou un résumé de ton parcours."],
            [
              "03",
              "Récupère ton plan",
              "Score, angle, contact, messages et suivi — en 90 secondes environ.",
            ],
          ].map(([number, title, description]) => (
            <div
              key={number}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:block sm:p-4"
            >
              <span className="mt-0.5 shrink-0 text-[11px] font-black tracking-[0.16em] text-teal-800 sm:mt-0 sm:text-[10px]">
                {number}
              </span>
              <div>
                <p className="text-sm font-black text-slate-900 sm:mt-2">{title}</p>
                <p className="mt-0.5 text-xs font-medium leading-5 text-slate-600 sm:mt-1">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 pb-6 sm:px-10 sm:pb-10">
          <button
            type="button"
            onClick={onStart}
            className="w-full rounded-2xl bg-[#0f766e] px-5 py-4 text-sm font-black text-white shadow-lg shadow-teal-900/10 transition hover:bg-[#115e59]"
          >
            Préparer ma première candidature
          </button>
          <p className="mt-3 text-center text-xs font-bold text-slate-600">
            {credits > 0
              ? `1 analyse = 1 crédit. Il t’en restera ${Math.max(credits - 1, 0)}.`
              : "Tu n’as plus de crédit disponible pour lancer une analyse."}{" "}
            <span className="text-slate-400">
              Ensuite : {CREDIT_PACK_LABEL}.
            </span>
          </p>

          {!demoOpen ? (
            <button
              type="button"
              aria-expanded={demoOpen}
              aria-controls="firstreply-demo"
              onClick={openDemo}
              className="mx-auto mt-3 block min-h-11 rounded-xl px-4 text-sm font-black text-teal-800 underline decoration-teal-300 underline-offset-4 transition hover:text-teal-950"
            >
              Voir d’abord un exemple — gratuit
            </button>
          ) : (
            <div ref={demoRef} className="scroll-mt-24">
              <DemoPreview onTryOwn={onStart} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type DemoTab = "analyse" | "contact" | "message" | "suivi";

const DEMO_TABS: Array<{ id: DemoTab; label: string }> = [
  { id: "analyse", label: "Analyse" },
  { id: "contact", label: "Contact" },
  { id: "message", label: "Message" },
  { id: "suivi", label: "Suivi" },
];

function DemoPreview({ onTryOwn }: { onTryOwn: () => void }) {
  const [tab, setTab] = useState<DemoTab>("analyse");
  const tabIndex = DEMO_TABS.findIndex((item) => item.id === tab);
  const isLastTab = tabIndex === DEMO_TABS.length - 1;

  return (
    <div
      id="firstreply-demo"
      role="region"
      aria-label="Exemple gratuit du parcours FirstReply"
      className="mt-5 overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50/60 text-left animate-[fadeUp_0.4s_ease-out]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 bg-white/70 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-800">
            Exemple · entreprise fictive
          </p>
          <p className="mt-0.5 truncate text-sm font-black text-slate-950">
            NovaTech · Stage Product Marketing
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-teal-200 bg-teal-50/80 px-2.5 py-1 text-[10px] font-black text-teal-800">
          0 crédit · rien n’est enregistré
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Étapes de l’exemple"
        className="grid grid-cols-4 gap-1 border-b border-slate-200/70 bg-white/40 px-2 pt-2"
      >
        {DEMO_TABS.map((item, index) => {
          const active = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`firstreply-demo-panel-${item.id}`}
              id={`firstreply-demo-tab-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`flex min-h-10 flex-col items-center justify-center gap-0.5 rounded-t-xl border-b-2 px-1 pb-2 pt-1.5 transition sm:flex-row sm:gap-2 ${
                active
                  ? "border-[#0d9488] bg-white text-[#0f766e]"
                  : "border-transparent text-slate-500 hover:text-[#0d9488]"
              }`}
            >
              <span
                className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-black ${
                  active
                    ? "bg-[#0d9488] text-white"
                    : index < tabIndex
                      ? "bg-teal-100 text-teal-800"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {index + 1}
              </span>
              <span className="text-[11px] font-black sm:text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div
        key={tab}
        role="tabpanel"
        id={`firstreply-demo-panel-${tab}`}
        aria-labelledby={`firstreply-demo-tab-${tab}`}
        className="px-4 py-4 sm:px-5 sm:py-5 animate-[fadeIn_0.25s_ease-out]"
      >
        {tab === "analyse" && <DemoAnalysePanel />}
        {tab === "contact" && <DemoContactPanel />}
        {tab === "message" && <DemoMessagePanel />}
        {tab === "suivi" && <DemoSuiviPanel />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 bg-white/70 px-4 py-3 sm:px-5">
        <p className="text-[10px] font-bold text-slate-500 sm:text-[11px]">
          Exemple fictif — aucune IA n’est appelée, rien n’est ajouté à ton suivi.
        </p>
        {isLastTab ? (
          <button
            type="button"
            onClick={onTryOwn}
            className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-[#0f766e] px-4 py-2 text-xs font-black text-white shadow-md shadow-teal-900/10 transition hover:bg-[#115e59] sm:text-sm"
          >
            Essayer avec ma propre offre
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setTab(DEMO_TABS[tabIndex + 1].id)}
            className="inline-flex min-h-10 items-center gap-1 rounded-2xl border border-teal-200 bg-teal-50/70 px-4 py-2 text-xs font-black text-teal-800 transition hover:bg-teal-100 sm:text-sm"
          >
            Étape suivante : {DEMO_TABS[tabIndex + 1].label} →
          </button>
        )}
      </div>
    </div>
  );
}

function DemoAnalysePanel() {
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
            Ce que tu colles · l’offre
          </p>
          <p className="mt-1.5 text-[12px] font-semibold leading-5 text-slate-700">
            « Stage Product Marketing 6 mois — Paris. Vous lancerez nos
            campagnes, analyserez les usages et travaillerez avec l’équipe
            produit… »
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
            Ce que tu colles · ton profil
          </p>
          <p className="mt-1.5 text-[12px] font-semibold leading-5 text-slate-700">
            « M1 marketing digital. Appli étudiante lancée en autonomie
            (300 utilisateurs). Excel, GA4, Notion… »
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-[#0d9488] bg-white">
          <span className="font-mono text-[22px] font-bold text-[#0d9488]">72</span>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
            Score de correspondance
          </p>
          <p className="mt-0.5 text-sm font-black text-slate-950">
            Bonne correspondance
          </p>
          <p className="mt-1 text-[12px] font-medium leading-5 text-slate-600">
            7 critères évalués : 4 acquis, 2 partiels, 1 manquant.
          </p>
        </div>
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3.5">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.13em] text-[#0d9488]">
            Tes atouts
          </p>
          <p className="relative mb-1.5 pl-3.5 text-[12px] font-medium leading-5 text-slate-700">
            <span className="absolute left-0 font-black text-[#0d9488]">+</span>
            Projet SaaS mené en autonomie, avec de vrais utilisateurs
          </p>
          <p className="relative pl-3.5 text-[12px] font-medium leading-5 text-slate-700">
            <span className="absolute left-0 font-black text-[#0d9488]">+</span>
            À l’aise avec l’analyse de données (Excel, GA4)
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-3.5">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.13em] text-[#d97706]">
            À compenser
          </p>
          <p className="relative pl-3.5 text-[12px] font-medium leading-5 text-slate-700">
            <span className="absolute left-0 font-black text-[#d97706]">→</span>
            Ils cherchent une première expérience growth — mets en avant les
            résultats chiffrés de ton appli.
          </p>
        </div>
      </div>

      <div className="mt-2 rounded-2xl border border-teal-200 bg-teal-50/50 p-3.5">
        <p className="mb-1 text-[9px] font-black uppercase tracking-[0.13em] text-[#0d9488]">
          Ton angle d’approche
        </p>
        <p className="text-[12px] font-medium leading-5 text-slate-800">
          Positionne-toi comme un profil produit orienté résultats : ton appli
          étudiante prouve que tu sais lancer, mesurer et itérer — exactement ce
          qu’ils attendent de ce stage.
        </p>
      </div>
    </div>
  );
}

function DemoContactPanel() {
  return (
    <div>
      <p className="text-sm font-black text-slate-950">
        Le bon contact, pas la boîte générique.
      </p>
      <p className="mt-1 text-[12px] font-medium leading-5 text-slate-600">
        Un message envoyé à la personne qui recrute vraiment obtient bien plus
        de réponses qu’un CV déposé dans un formulaire. FirstReply te dit qui
        chercher :
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {["Head of Marketing", "Product Marketing Manager", "Talent Acquisition"].map(
          (role) => (
            <span
              key={role}
              className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-700"
            >
              {role}
            </span>
          )
        )}
      </div>
      <div className="mt-2 rounded-2xl border border-slate-200 bg-white/80 px-3.5 py-2.5">
        <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-400">
          Requête prête à copier
        </p>
        <code className="mt-1 block truncate font-mono text-[11px] text-slate-600 sm:text-[12px]">
          site:linkedin.com/in &quot;NovaTech&quot; &quot;product marketing&quot;
        </code>
      </div>
      <p className="mt-3 text-[12px] font-medium leading-5 text-slate-600">
        Tu colles ensuite le nom trouvé : FirstReply déduit les formats d’email
        probables et personnalise ton approche.
      </p>
    </div>
  );
}

function DemoMessagePanel() {
  return (
    <div>
      <p className="text-sm font-black text-slate-950">
        Un message direct, personnalisé, prêt à envoyer.
      </p>
      <div className="mt-3 rounded-2xl border border-teal-200 bg-white/90 px-4 py-3.5">
        <pre className="m-0 whitespace-pre-wrap font-mono text-[11px] font-medium leading-[1.7] text-slate-700 sm:text-[12px]">
{`Objet : Stage Product Marketing — candidature directe

Bonjour Claire,

Je candidate au stage Product Marketing de NovaTech.
J’ai lancé une appli étudiante utilisée par 300 personnes :
positionnement, messages, mesure des résultats. Je veux
faire la même chose pour votre lancement…`}
        </pre>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {["Email direct", "DM LinkedIn", "Relance J+3", "Relance J+7"].map((item) => (
          <span
            key={item}
            className="rounded-full border border-teal-200 bg-teal-50/70 px-2.5 py-1 text-[10px] font-black text-teal-800"
          >
            {item}
          </span>
        ))}
      </div>
      <p className="mt-2.5 text-[12px] font-medium leading-5 text-slate-600">
        Les relances sont générées en même temps : tu sais quoi envoyer à J+3 et
        J+7 si tu n’as pas de réponse.
      </p>
    </div>
  );
}

function DemoSuiviPanel() {
  return (
    <div>
      <p className="text-sm font-black text-slate-950">
        Chaque analyse crée sa carte de suivi.
      </p>
      <p className="mt-1 text-[12px] font-medium leading-5 text-slate-600">
        Tu retrouves ta candidature, son statut et sa prochaine action — sans
        tableur à tenir à jour.
      </p>

      <div className="relative mt-3 rounded-[18px] border border-slate-200 bg-white/90 p-3.5 shadow-sm">
        <div className="absolute inset-x-4 top-0 h-1 rounded-b-full bg-slate-400" />
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-700">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            À envoyer
          </span>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-[#0d9488]">
            <span className="font-mono text-[12px] font-black text-[#0d9488]">72</span>
          </div>
        </div>
        <p className="text-base font-black tracking-[-0.03em] text-slate-950">
          NovaTech
        </p>
        <p className="mb-2 text-[12px] font-bold text-slate-600">
          Stage Product Marketing
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-black text-slate-600">
            Prochaine action : envoyer le message à Claire
          </p>
          <span className="rounded-xl border border-teal-200 bg-teal-50/70 px-2.5 py-1 text-[10px] font-black text-teal-700">
            Relance prévue J+3
          </span>
        </div>
      </div>

      <p className="mt-3 text-[12px] font-medium leading-5 text-slate-600">
        FirstReply te dit quand relancer — et quand passer à la candidature
        suivante.
      </p>
    </div>
  );
}

function FirstAnalysisHero({
  application,
  creditsRemaining,
  onGoToContact,
  onOpenTracker,
}: {
  application: TrackedApplication;
  creditsRemaining: number;
  onGoToContact: () => void;
  onOpenTracker: () => void;
}) {
  const company = safeText(application.company, "Entreprise");
  const role = safeText(application.role, "Poste");

  return (
    <section
      role="status"
      aria-live="polite"
      className="mb-4 overflow-hidden rounded-[22px] border border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5,#ffffff_70%)] shadow-sm"
    >
      <div className="p-5 sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-800">
          Première analyse réussie
        </p>
        <h2 className="mt-2 text-xl font-black tracking-[-0.03em] text-slate-950 sm:text-2xl">
          Ta candidature {company} est prête — et déjà suivie.
        </h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-emerald-800">
            <span className="text-[13px] leading-none">✓</span>
            Enregistrée dans ton suivi
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-700">
            {creditsRemaining} crédit{creditsRemaining !== 1 ? "s" : ""} restant
            {creditsRemaining !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">
              {company}
              <span className="mx-1.5 font-bold text-slate-300">·</span>
              <span className="font-bold text-slate-600">{role}</span>
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-slate-500">
              Statut : à envoyer — tu pourras la retrouver ici à tout moment.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenTracker}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black text-slate-600 transition hover:border-[#0d9488] hover:text-[#0d9488]"
          >
            Voir le suivi
          </button>
        </div>

        <div className="mt-4">
          <button
            type="button"
            onClick={onGoToContact}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-[#0f766e] px-4 py-3 text-sm font-black text-white shadow-lg shadow-teal-900/10 transition hover:bg-[#115e59] sm:w-auto"
          >
            Prochaine étape : trouver le bon contact
          </button>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-600">
            C’est l’étape qui change tout : un message envoyé à la bonne
            personne obtient bien plus de réponses qu’une candidature déposée
            dans un formulaire.
          </p>
        </div>
      </div>
    </section>
  );
}

function InputZone({
  credits,
  offer,
  profile,
  phase,
  error,
  draftRestored,
  onOfferChange,
  onProfileChange,
  onAnalyze,
  onCollapse,
}: {
  credits: number;
  offer: string;
  profile: string;
  phase: Phase;
  error: string;
  draftRestored: boolean;
  onOfferChange: (value: string) => void;
  onProfileChange: (value: string) => void;
  onAnalyze: () => void;
  onCollapse: () => void;
}) {
  const bothFilled = Boolean(offer.trim() && profile.trim());

  return (
    <section className="animate-[fadeUp_0.5s_ease-out]">
      {phase !== "input" && (
        <button
          onClick={onCollapse}
          className="mb-2 text-[11px] font-black text-slate-400 transition hover:text-[#0d9488]"
        >
          ← Réduire
        </button>
      )}

      {draftRestored && phase === "input" && (
        <p className="mb-4 rounded-2xl border border-teal-200 bg-teal-50/60 px-4 py-2.5 text-xs font-bold text-teal-800">
          Ton brouillon a été restauré — tu peux reprendre là où tu t’étais
          arrêté.
        </p>
      )}

      <FieldTextarea
        id="firstreply-offer"
        step="1"
        label="L’offre"
        helper="Colle l’annonce complète : missions, profil recherché, entreprise. Plus elle est complète, plus l’analyse est précise."
        placeholder="Ex. « Stage Assistant Marketing (6 mois) — Lyon. Vous participerez au lancement de… »"
        value={offer}
        onChange={onOfferChange}
      />
      <FieldTextarea
        step="2"
        label="Ton profil"
        helper="Colle ton CV tel quel, ou résume ta formation, tes expériences, tes projets et tes compétences."
        placeholder="Ex. « M1 marketing digital. Stage de 3 mois chez… Projets : … Compétences : Excel, Canva… »"
        value={profile}
        onChange={onProfileChange}
      />

      {error && (
        <p role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50/70 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      {phase === "input" && (
        <div>
          <button
            onClick={onAnalyze}
            className={`w-full rounded-2xl px-4 py-[15px] text-sm font-black text-white shadow-lg shadow-teal-900/10 transition ${
              bothFilled
                ? "bg-[#0f766e] hover:bg-[#115e59]"
                : "cursor-default bg-slate-300"
            }`}
          >
            Analyser cette candidature — 1 crédit
          </button>
          <CreditCostLine credits={credits} />
          <p className="mt-1 text-center text-[11px] font-bold text-slate-400">
            Brouillon enregistré automatiquement sur cet appareil.
          </p>
        </div>
      )}
    </section>
  );
}

/**
 * Coût de l'analyse et prix du pack, toujours affichés ensemble.
 * Le ton reste factuel : on annonce la limite, on ne la dramatise pas.
 */
function CreditCostLine({ credits }: { credits: number }) {
  if (credits <= 0) {
    return (
      <p className="mt-2 text-center text-xs font-bold text-slate-700">
        Tu n’as plus de crédit.{" "}
        <span className="text-[#0f766e]">{CREDIT_PACK_LABEL}.</span>
      </p>
    );
  }

  const remaining = credits - 1;
  const low = credits <= LOW_CREDITS_THRESHOLD;

  return (
    <p
      className={`mt-2 text-center text-xs font-bold ${
        low ? "text-slate-800" : "text-slate-600"
      }`}
    >
      {credits === 1
        ? "C’est ton dernier crédit gratuit."
        : `Cette analyse utilise 1 crédit. Il t’en restera ${remaining}.`}{" "}
      <span className={low ? "text-[#0f766e]" : "text-slate-400"}>
        Ensuite : {CREDIT_PACK_LABEL}.
      </span>
    </p>
  );
}

function FieldTextarea({
  id,
  step,
  label,
  helper,
  placeholder,
  value,
  onChange,
}: {
  id?: string;
  step: string;
  label: string;
  helper: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const filled = value.trim().length >= 80;

  return (
    <label className="mb-5 block sm:mb-6">
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition ${
            filled
              ? "bg-[#0d9488] text-white"
              : "bg-slate-200 text-slate-500"
          }`}
        >
          {filled ? "✓" : step}
        </span>
        <span className="text-sm font-black text-slate-950">{label}</span>
        {filled && (
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#0d9488]">
            Ajouté
          </span>
        )}
      </span>
      <span className="mb-1.5 mt-1 block text-[11px] font-bold leading-4 text-slate-400">
        {helper}
      </span>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={5}
        className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-[13px] leading-[1.6] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0d9488] focus:ring-4 focus:ring-teal-600/10 sm:px-4 sm:py-3.5 sm:text-sm"
      />
    </label>
  );
}

function AnalysisLoader({
  activeStep,
  elapsedSeconds,
}: {
  activeStep: number;
  elapsedSeconds: number;
}) {
  const waitMessage =
    elapsedSeconds < 30
      ? "Une analyse complète prend en général 60 à 90 secondes."
      : elapsedSeconds < 90
        ? "L’analyse continue — chaque critère de l’offre est évalué contre ton profil."
        : "C’est un peu plus long que d’habitude, mais l’analyse est toujours en cours.";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-[#f5f7f3] px-6 animate-[fadeIn_0.3s_ease-out]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="w-full max-w-[420px]">
        <div className="mb-10 text-center">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.18em] text-[#0f766e]">
            FirstReply
          </p>
          <p className="text-xl font-black tracking-[-0.03em] text-slate-950">
            Analyse en cours
          </p>
          <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
            {waitMessage}
          </p>
        </div>

        <div className="mb-10 rounded-[18px] border border-slate-200 bg-white/60 p-5 shadow-sm">
          {ANALYSIS_STEPS.map((step, index) => {
            const isDone = index < activeStep;
            const isActive = index === activeStep;
            const isPending = index > activeStep;

            return (
              <div
                key={step}
                className="flex items-center gap-3.5 py-[11px] transition-opacity"
                style={{ opacity: isPending ? 0.3 : 1 }}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
                    isDone
                      ? "border-[#0f766e] bg-[#0f766e]"
                      : isActive
                        ? "border-[#0f766e] bg-teal-50"
                        : "border-slate-200 bg-slate-50"
                  }`}
                >
                  {isDone ? (
                    <span className="text-sm font-black text-white">✓</span>
                  ) : isActive ? (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#0f766e]" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  )}
                </div>
                <span
                  className={`text-sm ${
                    isDone
                      ? "font-bold text-[#0f766e]"
                      : isActive
                        ? "font-black text-slate-950"
                        : "font-bold text-slate-400"
                  }`}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        <div
          className="h-1 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label="Analyse en cours"
        >
          <div className="h-full w-1/3 rounded-full bg-[#0f766e] animate-[progressSlide_1.6s_ease-in-out_infinite]" />
        </div>
        <p className="mt-3 text-center font-mono text-[11px] font-bold text-slate-400">
          {elapsedSeconds} s écoulée{elapsedSeconds !== 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}

function CollapsedInputSummary({
  application,
  onEdit,
}: {
  application: TrackedApplication;
  onEdit: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between rounded-[18px] border border-slate-200 bg-white/60 px-4 py-3 shadow-sm sm:px-5 sm:py-3.5">
      <div className="min-w-0">
        <span className="text-[13px] font-black text-slate-950 sm:text-base">
          {safeText(application.company, "Entreprise")}
        </span>
        <span className="mx-1.5 text-slate-300 sm:mx-2">·</span>
        <span className="text-[12px] font-bold text-slate-600 sm:text-sm">
          {safeText(application.role, "Poste")}
        </span>
      </div>
      <button
        onClick={onEdit}
        className="ml-3 shrink-0 text-[11px] font-black text-[#0d9488]"
      >
        Éditer
      </button>
    </div>
  );
}

function PhaseOneResult({
  refNode,
  application,
  copiedKey,
  onCopy,
  showNextStepCta,
  onGoToContact,
}: {
  refNode: React.RefObject<HTMLDivElement | null>;
  application: TrackedApplication;
  copiedKey: string;
  onCopy: (key: string, text: string) => void;
  showNextStepCta: boolean;
  onGoToContact: () => void;
}) {
  const preparedDate = formatPreparedDate(application.createdAt);
  const tags = [
    safeText(application.contractType, ""),
    safeText(application.location, ""),
    preparedDate ? `Préparé le ${preparedDate}` : "",
    "Ajoutée au suivi",
  ].filter(Boolean);

  return (
    <div ref={refNode} className="animate-[fadeUp_0.6s_ease-out]">
      <div className="mb-2 mt-5 rounded-[18px] border border-slate-200 bg-white/60 px-4 py-4 shadow-sm sm:mt-6 sm:px-6 sm:py-5">
        <h2 className="m-0 text-lg font-black tracking-[-0.03em] text-slate-950 sm:text-xl">
          {safeText(application.company, "Entreprise")}
        </h2>
        <p className="mb-2 mt-1 text-[12px] font-bold text-slate-600 sm:mb-2.5 sm:text-[13px]">
          {safeText(application.role, "Poste")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-lg bg-white/65 px-2 py-1 text-[10px] font-bold text-slate-500 sm:text-[11px]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <section className="mt-3 flex flex-col items-center gap-4 rounded-[18px] border border-slate-200 bg-white/60 p-4 shadow-sm sm:flex-row sm:items-start sm:gap-6 sm:p-6">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 sm:h-20 sm:w-20"
          style={{ borderColor: scoreColor(application.matchScore) }}
        >
          <span
            className="font-mono text-[22px] font-bold sm:text-[28px]"
            style={{ color: scoreColor(application.matchScore) }}
          >
            {application.matchScore}
          </span>
        </div>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <div className="mb-1 text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
            Score de correspondance
          </div>
          <p
            className="m-0 mb-1 text-sm font-black sm:text-base"
            style={{ color: scoreColor(application.matchScore) }}
          >
            {scoreMeaning(application.matchScore)}
          </p>
          <p className="m-0 text-[13px] font-medium leading-[1.65] text-slate-700 sm:text-sm">
            {safeText(application.scoreBreakdown, "Analyse du score à compléter.")}
          </p>
        </div>
      </section>

      <section className="mt-3 rounded-[18px] border border-teal-200 bg-teal-50/40 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.13em] text-[#0d9488]">
          Ton angle d'approche
        </div>
        <p className="m-0 text-sm font-medium leading-[1.7] text-slate-800">
          {safeText(application.suggestedAngle, "Angle à personnaliser.")}
        </p>
      </section>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ListCard
          label="Tes atouts"
          items={safeList(application.candidateStrengths)}
          marker="+"
          tone="#0d9488"
        />
        <ListCard
          label="Points à adresser"
          items={safeList(application.candidateWeaknesses)}
          marker="→"
          tone="#d97706"
        />
      </div>

      {showNextStepCta && (
        <button
          type="button"
          onClick={onGoToContact}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-2xl border border-teal-300 bg-teal-50/70 px-4 py-3 text-center text-sm font-black text-teal-800 transition hover:bg-teal-100"
        >
          Étape suivante : trouver le bon contact
        </button>
      )}

      <SectionTitle sub="À adapter selon le canal d'envoi.">
        Contenu généré
      </SectionTitle>
      <ContentBlock
        label="Lettre de motivation courte"
        text={safeText(application.shortCoverLetter, "")}
        copyKey="coverLetter"
        copiedKey={copiedKey}
        onCopy={onCopy}
      />
      <ContentBlock
        label="Email de candidature général"
        text={getDirectEmail(application)}
        copyKey="generalEmail"
        copiedKey={copiedKey}
        onCopy={onCopy}
      />
    </div>
  );
}

function ListCard({
  label,
  items,
  marker,
  tone,
}: {
  label: string;
  items: string[];
  marker: string;
  tone: string;
}) {
  return (
    <section className="rounded-[18px] border border-slate-200 bg-white/60 p-4 shadow-sm sm:p-5">
      <div
        className="mb-3 text-[10px] font-black uppercase tracking-[0.13em]"
        style={{ color: tone }}
      >
        {label}
      </div>
      {items.length === 0 && (
        <p className="text-[11px] font-bold text-slate-400">À compléter.</p>
      )}
      {items.map((item) => (
        <div
          key={item}
          className="relative mb-2 pl-3.5 text-[13px] font-medium leading-[1.6] text-slate-700"
        >
          <span
            className="absolute left-0 top-0.5 font-black"
            style={{ color: tone }}
          >
            {marker}
          </span>
          {item}
        </div>
      ))}
    </section>
  );
}

function SectionTitle({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className={sub ? "mb-2 mt-10" : "mb-5 mt-10"}>
      <h3 className="m-0 text-lg font-black tracking-[-0.03em] text-slate-950">
        {children}
      </h3>
      {sub && (
        <p className="m-0 mt-1 text-[11px] font-bold leading-[1.5] text-slate-400">
          {sub}
        </p>
      )}
    </div>
  );
}

function CopyBtn({
  text,
  copyKey,
  copiedKey,
  onCopy,
}: {
  text: string;
  copyKey: string;
  copiedKey: string;
  onCopy: (key: string, text: string) => void;
}) {
  const copied = copiedKey === copyKey;

  return (
    <button
      onClick={() => onCopy(copyKey, text)}
      className={`shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-black transition ${
        copied
          ? "bg-[#0d9488] text-white"
          : "border border-teal-200 bg-teal-50/70 text-teal-700 hover:bg-teal-100"
      }`}
    >
      {copied ? "Copié ✓" : "Copier"}
    </button>
  );
}

function ContentBlock({
  label,
  text,
  copyKey,
  copiedKey,
  onCopy,
  warning,
}: {
  label: string;
  text: string;
  copyKey: string;
  copiedKey: string;
  onCopy: (key: string, text: string) => void;
  warning?: boolean;
}) {
  return (
    <div
      className={`mb-3 rounded-[18px] border px-4 py-4 shadow-sm sm:px-5 sm:py-5 ${
        warning
          ? "border-amber-200 bg-amber-50/40"
          : "border-teal-200 bg-teal-50/30"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3 sm:items-center sm:gap-4">
        <span className="min-w-0 text-[13px] font-black text-slate-950 sm:text-sm">{label}</span>
        <CopyBtn
          text={text}
          copyKey={copyKey}
          copiedKey={copiedKey}
          onCopy={onCopy}
        />
      </div>
      <pre className="m-0 whitespace-pre-wrap font-mono text-[12px] font-medium leading-[1.7] text-slate-700">
        {text || "À compléter."}
      </pre>
    </div>
  );
}

function QueryRow({
  query,
  copyKey,
  copiedKey,
  onCopy,
}: {
  query: string;
  copyKey: string;
  copiedKey: string;
  onCopy: (key: string, text: string) => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/60 px-3 py-2.5 shadow-sm sm:gap-3 sm:px-3.5">
      <code className="min-w-0 truncate font-mono text-[11px] text-slate-600 sm:text-[13px]">{query}</code>
      <CopyBtn
        text={query}
        copyKey={copyKey}
        copiedKey={copiedKey}
        onCopy={onCopy}
      />
    </div>
  );
}

function ContactFoundBox({
  refNode,
  highlighted,
  application,
  copiedKey,
  onCopy,
  contactName,
  domain,
  loading,
  error,
  onContactChange,
  onDomainChange,
  onPrepare,
}: {
  refNode: React.RefObject<HTMLElement | null>;
  highlighted: boolean;
  application: TrackedApplication;
  copiedKey: string;
  onCopy: (key: string, text: string) => void;
  contactName: string;
  domain: string;
  loading: boolean;
  error: string;
  onContactChange: (value: string) => void;
  onDomainChange: (value: string) => void;
  onPrepare: () => void;
}) {
  const roles = getContactRoles(application);
  const queries = safeList(application.searchQueries);

  return (
    <section
      ref={refNode}
      id="firstreply-contact"
      className={`mt-8 scroll-mt-20 rounded-[20px] border bg-white/60 px-4 py-5 transition-[border-color,box-shadow] duration-500 sm:px-6 sm:py-6 ${
        highlighted
          ? "border-teal-400 shadow-[0_0_0_5px_rgba(13,148,136,0.16)]"
          : "border-slate-200 shadow-sm"
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0d9488]">
        Étape suivante
      </p>
      <h3 className="mt-1.5 text-lg font-black tracking-[-0.03em] text-slate-950">
        Trouve la bonne personne — pas la boîte mail générique.
      </h3>
      <p className="mt-1.5 text-[13px] font-medium leading-5 text-slate-600">
        Un message envoyé directement à la personne qui recrute obtient bien
        plus de réponses qu’un CV déposé dans un formulaire.
      </p>

      <p className="mt-4 text-xs font-black text-slate-700">
        1. Cherche ces profils chez {safeText(application.company, "l’entreprise")} :
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {roles.map((role) => (
          <span
            key={role}
            className="rounded-lg border border-slate-200 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-700"
          >
            {role}
          </span>
        ))}
      </div>
      {queries.length > 0 && (
        <div className="mt-2.5">
          {queries.map((query, index) => (
            <QueryRow
              key={`${query}-${index}`}
              query={query}
              copyKey={`query-${index}`}
              copiedKey={copiedKey}
              onCopy={onCopy}
            />
          ))}
        </div>
      )}

      <div className="mt-5 border-t border-slate-200/70 pt-4">
        <p className="text-xs font-black text-slate-700">
          2. Tu as trouvé quelqu’un ? Entre son nom — on prépare un message
          personnalisé et les relances.
        </p>
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
          <label className="w-full sm:min-w-[160px] sm:flex-[2]">
            <span className="mb-1.5 block text-xs font-black text-slate-700">
              Nom du contact
            </span>
            <input
              id="firstreply-contact-name"
              autoComplete="name"
              placeholder="Ex. Sophie Martin"
              value={contactName}
              onChange={(event) => onContactChange(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-base font-semibold text-slate-800 outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-teal-700/10 sm:text-sm"
            />
          </label>
          <label className="w-full sm:min-w-[120px] sm:flex-1">
            <span className="mb-1.5 block text-xs font-black text-slate-700">
              Domaine de l’entreprise
            </span>
            <input
              id="firstreply-contact-domain"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="exemple.com"
              value={domain}
              onChange={(event) => onDomainChange(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-3 font-mono text-base font-semibold text-slate-800 outline-none focus:border-[#0f766e] focus:ring-4 focus:ring-teal-700/10 sm:text-sm"
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-xs font-black text-red-700">
            {error}
          </p>
        )}
        <button
          onClick={onPrepare}
          disabled={!contactName.trim() || !domain.trim() || loading}
          className="mt-4 w-full rounded-2xl bg-slate-900 px-8 py-3 text-sm font-black text-white shadow-lg transition hover:bg-slate-700 disabled:cursor-default disabled:bg-slate-300 sm:w-auto"
        >
          {loading ? "Préparation..." : "Préparer l'approche directe"}
        </button>
      </div>
    </section>
  );
}

function PhaseTwoOutreach({
  refNode,
  application,
  contactName,
  domain,
  outreach,
  copiedKey,
  onCopy,
  onNew,
}: {
  refNode: React.RefObject<HTMLDivElement | null>;
  application: TrackedApplication;
  contactName: string;
  domain: string;
  outreach: OutreachResult | null;
  copiedKey: string;
  onCopy: (key: string, text: string) => void;
  onNew: () => void;
}) {
  if (!isValidFullName(contactName)) {
    return null;
  }

  const formats = outreach?.emailFormats ?? buildEmailFormats(contactName, domain);
  const directEmail = outreach?.personalizedDirectEmail ?? "";
  const linkedInDM = outreach?.personalizedLinkedInDM ?? "";
  const followupJ3 = outreach?.followUpJ3 ?? "";
  const followupJ7 = outreach?.followUpJ7 ?? "";

  return (
    <div ref={refNode} className="mt-8 animate-[fadeUp_0.6s_ease-out]">
      <div className="mx-auto mb-8 h-[3px] w-12 rounded-full bg-[#0d9488]" />

      <SectionTitle sub={outreach?.emailFormatsDisclaimer ?? "Formats probables, non vérifiés."}>
        Formats d'email probables
      </SectionTitle>
      <div className="mb-6">
        {formats.map((email, index) => (
          <QueryRow
            key={`${email}-${index}`}
            query={email}
            copyKey={`format-${index}`}
            copiedKey={copiedKey}
            onCopy={onCopy}
          />
        ))}
      </div>

      <SectionTitle>Approche personnalisée — {contactName}</SectionTitle>
      <ContentBlock
        label={`Email direct à ${contactName}`}
        text={directEmail}
        copyKey="directEmail"
        copiedKey={copiedKey}
        onCopy={onCopy}
      />
      <ContentBlock
        label={`Message LinkedIn à ${contactName}`}
        text={linkedInDM}
        copyKey="linkedinDM"
        copiedKey={copiedKey}
        onCopy={onCopy}
      />

      <SectionTitle sub="Si pas de réponse, relance exactement à J+3 puis J+7. Pas plus.">
        Relances
      </SectionTitle>
      <ContentBlock
        label="Relance J+3"
        text={followupJ3}
        copyKey="followupJ3"
        copiedKey={copiedKey}
        onCopy={onCopy}
      />
      <ContentBlock
        label="Relance J+7"
        text={followupJ7}
        copyKey="followupJ7"
        copiedKey={copiedKey}
        onCopy={onCopy}
        warning
      />
      <p className="mt-2 text-center text-[11px] font-black text-amber-600">
        Après ça, passe à la prochaine candidature.
      </p>

      <div className="mt-12 text-center">
        <button
          onClick={onNew}
          className="rounded-2xl bg-[#0d9488] px-9 py-3.5 text-sm font-black text-white shadow-lg shadow-teal-900/10 transition hover:bg-[#0f766e]"
        >
          Nouvelle candidature
        </button>
      </div>
    </div>
  );
}

function TrackerBoard({
  items,
  filter,
  search,
  celebration,
  onFilterChange,
  onSearchChange,
  onNewApplication,
  onSelect,
  onActionDone,
  onWon,
  onDelete,
  onStatusChange,
  onCloseCelebration,
}: {
  items: TrackedApplication[];
  filter: TrackerFilter;
  search: string;
  celebration: CelebrationState;
  onFilterChange: (filter: TrackerFilter) => void;
  onSearchChange: (search: string) => void;
  onNewApplication: () => void;
  onSelect: (application: TrackedApplication) => void;
  onActionDone: (application: TrackedApplication) => void;
  onWon: (application: TrackedApplication) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onCloseCelebration: () => void;
}) {
  const [openStatusMenu, setOpenStatusMenu] = useState("");
  const [sort, setSort] = useState<TrackerSort>("priority");

  const trackerItems = items.map((item) => ({
    application: item,
    state: getTrackerState(item),
  }));
  const stats = getTrackerStats(trackerItems);
  const filteredItems = trackerItems
    .filter(({ state }) => {
      if (filter === "won") return state.urgency === "won";
      if (filter === "active") return !["won", "done"].includes(state.urgency);
      return true;
    })
    .filter(({ application }) => {
      const haystack = `${application.company} ${application.role} ${application.nextAction}`.toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    })
    .sort((a, b) => {
      if (sort === "recent") {
        const dateA = new Date(a.application.createdAt || 0).getTime();
        const dateB = new Date(b.application.createdAt || 0).getTime();
        return dateB - dateA;
      }
      return a.state.priority - b.state.priority;
    });

  return (
    <section className="min-h-[calc(100vh-52px)] bg-[#f5f7f3] px-3 py-4 sm:min-h-[calc(100vh-56px)] sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[1760px]">
        <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#0d9488] sm:mb-2 sm:text-[11px]">
              FirstReply
            </p>
            <h1 className="m-0 text-2xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
              Suivi de tes candidatures
            </h1>
            <p className="mt-1 text-[13px] font-medium text-slate-600 sm:mt-2 sm:text-base">
              Les plus urgentes sont en haut. Avance carte par carte.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block sm:w-72">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                ⌕
              </span>
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Rechercher..."
                aria-label="Rechercher une candidature"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-10 text-base font-semibold outline-none transition placeholder:text-slate-500 focus:border-[#0f766e] focus:ring-4 focus:ring-teal-700/10 sm:text-sm"
              />
            </label>
            <button
              onClick={onNewApplication}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0f766e] px-4 text-[13px] font-black text-white shadow-lg shadow-teal-900/10 transition hover:bg-[#115e59] sm:text-sm"
            >
              + Nouvelle candidature
            </button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1.5 sm:mb-5 sm:grid-cols-5 sm:gap-2">
          <TrackerStatCard label="Candidatures" value={stats.total} tone="neutral" />
          <TrackerStatCard label="Refusés" value={stats.rejected} tone="red" />
          <TrackerStatCard label="Sans réponse" value={stats.noResponse} tone="ghosted" />
          <TrackerStatCard label="Entretiens" value={stats.interview} tone="blue" />
          <TrackerStatCard label="Décrochés" value={stats.won} tone="teal" />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-300/60 pb-3 sm:mb-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <TrackerFilterButton
              active={filter === "active"}
              label="En cours"
              count={stats.active}
              onClick={() => { onFilterChange("active"); setSort("priority"); }}
            />
            <TrackerFilterButton
              active={filter === "all"}
              label="Toutes"
              count={items.length}
              onClick={() => onFilterChange("all")}
            />
            <TrackerFilterButton
              active={filter === "won"}
              label="Décrochées"
              count={stats.won}
              onClick={() => { onFilterChange("won"); setSort("recent"); }}
            />
          </div>
          <button
            onClick={() => setSort((current) => current === "priority" ? "recent" : "priority")}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-[10px] font-black transition sm:min-h-9 sm:text-[11px] ${
              sort === "recent"
                ? "border-[#0d9488] bg-teal-50/70 text-[#0d9488]"
                : "border-slate-200 bg-white/60 text-slate-500 hover:border-[#0d9488] hover:text-[#0d9488]"
            }`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {sort === "recent" ? "Récentes" : "Urgence"}
          </button>
        </div>

        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-white/80 bg-white/75 p-8 text-center text-sm font-bold text-slate-400 shadow-sm sm:p-10">
            Aucune candidature dans cette vue.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map(({ application, state }) => (
              <TrackerCompactCard
                key={application.id}
                application={application}
                state={state}
                menuOpen={openStatusMenu === application.id}
                onToggleMenu={() =>
                  setOpenStatusMenu((current) =>
                    current === application.id ? "" : application.id
                  )
                }
                onStatusChange={(status) => {
                  setOpenStatusMenu("");
                  onStatusChange(application.id, status);
                }}
                onSelect={() => onSelect(application)}
                onActionDone={() => onActionDone(application)}
                onWon={() => onWon(application)}
                onDelete={() => onDelete(application.id)}
              />
            ))}
          </div>
        )}
      </div>

      {openStatusMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenStatusMenu("")} />
      )}

      {celebration && <TrackerCelebration company={celebration.company} onClose={onCloseCelebration} />}
    </section>
  );
}

function TrackerCelebration({ company, onClose }: { company: string; onClose: () => void }) {
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
            animation: `trackerConfetti 4.8s ${index * 0.13}s ease-out forwards`,
          }}
        >
          {item}
        </span>
      ))}

      <div className="tracker-celebration-card relative w-full max-w-[680px] rounded-[36px] border border-amber-200 bg-[linear-gradient(135deg,#fef3c7,#ecfdf5_45%,#ffffff)] px-8 py-10 text-center shadow-2xl">
        <p className="tracker-line-1 text-2xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl">
          La guerre est finie.
        </p>
        <p className="tracker-line-2 mt-5 text-4xl font-black tracking-[-0.05em] text-[#00796b] sm:text-6xl">
          Elle a dit OUI.
        </p>
        <p className="tracker-line-3 mt-5 text-xl font-black text-slate-700 sm:text-3xl">
          Non... tu nous quittes déjà ?
        </p>
        <p className="tracker-line-4 mt-4 text-sm text-slate-400">{company}</p>
        <button
          onClick={onClose}
          className="tracker-line-4 mt-6 rounded-2xl bg-[#00796b] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#00695c]"
        >
          Continuer
        </button>
      </div>

      <style jsx>{`
        @keyframes trackerConfetti {
          0% { opacity: 0; transform: translateY(0) rotate(0deg) scale(0.7); }
          12% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-115vh) rotate(520deg) scale(1.2); }
        }
        .tracker-celebration-card {
          animation: trackerBounce 0.7s cubic-bezier(0.2, 1.4, 0.4, 1) both;
        }
        .tracker-line-1, .tracker-line-2, .tracker-line-3, .tracker-line-4 {
          opacity: 0; transform: translateY(14px);
          animation: trackerReveal 0.45s ease-out forwards;
        }
        .tracker-line-1 { animation-delay: 0.15s; }
        .tracker-line-2 { animation-delay: 1.05s; }
        .tracker-line-3 { animation-delay: 2.05s; }
        .tracker-line-4 { animation-delay: 3.1s; }
        @keyframes trackerBounce {
          0% { transform: translateY(20px) scale(0.92); opacity: 0; }
          70% { transform: translateY(-6px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes trackerReveal {
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function TrackerStatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "amber" | "red" | "ghosted" | "blue" | "teal";
}) {
  const styles = {
    neutral: "border-slate-200 bg-white/60 text-slate-900",
    amber: "border-amber-200 bg-amber-50/70 text-amber-700",
    red: "border-red-200 bg-red-50/70 text-red-700",
    ghosted: "border-zinc-200 bg-zinc-50/80 text-zinc-700",
    blue: "border-blue-200 bg-blue-50/80 text-blue-800",
    teal: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
  };

  return (
    <article className={`rounded-2xl border px-3 py-2.5 shadow-sm sm:rounded-[22px] sm:px-4 sm:py-3 ${styles[tone]}`}>
      <p className="mb-0.5 text-[9px] font-black uppercase tracking-[0.1em] opacity-65 sm:mb-1 sm:text-[10px] sm:tracking-[0.13em]">
        {label}
      </p>
      <p className="font-mono text-2xl font-black tracking-[-0.05em] text-slate-950 sm:text-3xl">{value}</p>
    </article>
  );
}

function TrackerFilterButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-end gap-2 border-b-4 px-1 pb-2 text-sm font-black transition ${
        active
          ? "border-[#0d9488] text-[#00796b]"
          : "border-transparent text-slate-700 hover:text-[#0d9488]"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          active ? "bg-[#0d9488] text-white" : "bg-white/70 text-slate-500"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function TrackerCompactCard({
  application,
  state,
  menuOpen,
  onToggleMenu,
  onStatusChange,
  onSelect,
  onActionDone,
  onWon,
  onDelete,
}: {
  application: TrackedApplication;
  state: ReturnType<typeof getTrackerState>;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onStatusChange: (status: ApplicationStatus) => void;
  onSelect: () => void;
  onActionDone: () => void;
  onWon: () => void;
  onDelete: () => void;
}) {
  const config = trackerStatusConfig[application.status] ?? trackerStatusConfig["A contacter"];
  const tags = [application.contractType, application.location].filter(Boolean);
  const isWon = application.status === "Won";
  const isDone = state.urgency === "won" || state.urgency === "done";

  return (
    <article
      className={`relative min-h-[160px] rounded-[18px] border p-3 shadow-sm transition-[border-color,box-shadow,transform,opacity] duration-200 sm:min-h-[180px] ${
        config.cardClass
      } ${menuOpen ? "z-50" : ""} ${isWon ? "scale-[1.01]" : ""}`}
    >
      <div className={`absolute inset-x-4 top-0 h-1 rounded-b-full ${config.railClass}`} />

      <div className="mb-3 flex items-start justify-between gap-3">
        <div
          className="relative"
          onKeyDown={(event) => {
            if (event.key === "Escape" && menuOpen) {
              event.preventDefault();
              onToggleMenu();
            }
          }}
        >
          <button
            type="button"
            aria-label={`Changer le statut de ${safeText(application.company, "cette candidature")}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={`tracker-status-menu-${application.id}`}
            onClick={onToggleMenu}
            className={`inline-flex min-h-10 max-w-[176px] items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black transition hover:brightness-95 focus:outline-none focus:ring-4 focus:ring-teal-600/10 ${config.badgeClass}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${config.dotClass}`} />
            <span className="truncate">{trackerStatusLabel(application.status)}</span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-80" />
          </button>

          {menuOpen && (
            <div
              id={`tracker-status-menu-${application.id}`}
              role="menu"
              aria-label={`Statut de ${safeText(application.company, "la candidature")}`}
              className="absolute left-0 top-11 z-[999] w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              {TRACKER_STATUS_OPTIONS.map((status) => {
                const optionConfig = trackerStatusConfig[status];
                return (
                  <button
                    key={status}
                    type="button"
                    role="menuitemradio"
                    aria-checked={application.status === status}
                    onClick={() => onStatusChange(status)}
                    className="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-black text-slate-700 transition hover:bg-teal-50 hover:text-[#0f766e]"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${optionConfig.menuDotClass}`} />
                    <span>{trackerStatusLabel(status)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <TrackerScoreRing score={application.matchScore} won={isWon} />
          <button
            onClick={onDelete}
            aria-label={`Supprimer la candidature ${safeText(application.company, "sélectionnée")}`}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      <h2 className="line-clamp-1 text-base font-black tracking-[-0.03em] text-slate-950 sm:text-lg">
        <button
          type="button"
          onClick={onSelect}
          className="min-h-10 text-left transition hover:text-[#0f766e]"
        >
          {safeText(application.company, "Entreprise")}
        </button>
      </h2>
      <p className="mb-2 line-clamp-1 text-[12px] font-bold text-slate-600 sm:mb-3 sm:text-[13px]">
        {safeText(application.role, "Poste")}
      </p>

      <div className="mb-2 flex flex-wrap gap-1 text-[10px] font-bold text-slate-500 sm:mb-3 sm:gap-1.5 sm:text-[11px]">
        {tags.map((tag) => (
          <span key={tag} className="rounded-lg bg-white/65 px-1.5 py-0.5 sm:px-2 sm:py-1">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 sm:gap-3">
        <p className={`line-clamp-1 text-[11px] font-black sm:text-[12px] ${config.secondaryClass}`}>
          {state.dueText}
        </p>
        {!isDone && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={onActionDone}
              className={`min-h-10 shrink-0 rounded-xl px-2.5 py-1 text-[10px] font-black transition sm:text-[11px] ${tealActionClass}`}
            >
              {state.primaryAction}
            </button>
            <button
              onClick={onWon}
              className="min-h-10 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-[10px] font-black text-emerald-800 transition hover:bg-emerald-100 sm:text-[11px]"
            >
              Décroché
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function TrackerScoreRing({ score, won }: { score: number; won: boolean }) {
  const safeScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeScore / 100) * circumference;
  const color = won ? "#059669" : scoreColor(safeScore);

  return (
    <div
      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
        won ? "shadow-[0_0_24px_rgba(13,148,136,0.35)]" : ""
      }`}
    >
      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r={radius} stroke="rgba(255,255,255,0.86)" strokeWidth="5" fill="none" />
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

function getTrackerStats(
  items: Array<{ application: TrackedApplication; state: ReturnType<typeof getTrackerState> }>,
) {
  return {
    total: items.length,
    rejected: items.filter(({ application }) => application.status === "Refus").length,
    noResponse: items.filter(({ application }) => application.status === "No response").length,
    interview: items.filter(({ state }) => state.urgency === "interview").length,
    won: items.filter(({ state }) => state.urgency === "won").length,
    active: items.filter(({ state }) => !["won", "done"].includes(state.urgency)).length,
  };
}

function getTrackerState(application: TrackedApplication) {
  const actionType = getActionType(application);
  const dueDate = getDueDate(application, actionType);
  const urgency = getUrgency(application, actionType, dueDate);
  const priorityByUrgency: Record<TrackerUrgency, number> = {
    overdue: 1,
    today: 2,
    interview: 3,
    waiting: 4,
    prepared: 5,
    won: 6,
    done: 7,
  };

  return {
    actionType,
    dueDate,
    urgency,
    priority: priorityByUrgency[urgency],
    badge: getUrgencyBadge(urgency),
    dueText: getDueText(urgency, dueDate),
    actionLabel: getActionLabel(actionType, application),
    primaryAction: getPrimaryActionLabel(actionType, urgency),
  };
}

function getActionType(application: TrackedApplication) {
  if (application.nextActionType) return application.nextActionType;
  if (application.status === "Message envoye") return "followup_j3";
  if (application.status === "Relance J+3") return "followup_j3";
  if (application.status === "Relance J+7") return "followup_j7";
  if (application.status === "Entretien") return "interview_prep";
  if (["Archive", "Refus", "No response", "Won"].includes(application.status)) return "none";
  return "send_application";
}

function getDueDate(application: TrackedApplication, actionType: string) {
  const explicitDate =
    parseDate(application.nextActionDueAt) ?? parseDate(application.nextFollowUpDate);

  if (explicitDate) return explicitDate;
  if (actionType === "followup_j3") return addDays(parseDate(application.sentAt) ?? new Date(), 3);
  if (actionType === "followup_j7") return addDays(parseDate(application.sentAt) ?? new Date(), 7);
  return null;
}

function getUrgency(
  application: TrackedApplication,
  actionType: string,
  dueDate: Date | null
): TrackerUrgency {
  if (application.status === "Won" || application.wonAt) return "won";
  if (["Archive", "Refus", "No response"].includes(application.status) || actionType === "none") return "done";
  if (application.status === "Entretien" || actionType === "interview_prep") return "interview";
  if (!dueDate) return actionType === "send_application" ? "prepared" : "waiting";

  const diff = differenceInCalendarDays(dueDate, new Date());
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  return "waiting";
}

function getUrgencyBadge(urgency: TrackerUrgency) {
  const labels: Record<TrackerUrgency, string> = {
    overdue: "En retard",
    today: "Aujourd'hui",
    interview: "Entretien",
    waiting: "En attente",
    prepared: "À envoyer",
    won: "Décroché",
    done: "Terminé",
  };

  return labels[urgency];
}

function getDueText(urgency: TrackerUrgency, dueDate: Date | null) {
  if (urgency === "overdue" && dueDate) {
    const days = Math.abs(differenceInCalendarDays(dueDate, new Date()));
    return `En retard de ${days} jour${days > 1 ? "s" : ""}`;
  }

  if (urgency === "today") return "À envoyer aujourd'hui";
  if (urgency === "prepared") return "Prêt à envoyer";
  if (urgency === "interview") return "À préparer";
  if (urgency === "won") return "Objectif atteint";
  if (urgency === "done") return "Aucune action";
  return dueDate ? `Prévu le ${formatDisplayDate(dueDate)}` : "À planifier";
}

function getActionLabel(actionType: string, application: TrackedApplication) {
  if (actionType === "followup_j3") return "Relance J+3";
  if (actionType === "followup_j7") return "Relance J+7";
  if (actionType === "interview_prep") return "Préparer entretien";
  if (actionType === "none") return safeText(application.nextAction, "Aucune action");
  return "Envoyer la candidature";
}

function getPrimaryActionLabel(actionType: string, urgency: TrackerUrgency) {
  if (urgency === "won") return "Décroché";
  if (urgency === "done") return "Terminé";
  if (actionType === "followup_j3") return "Relance J+3 envoyée";
  if (actionType === "followup_j7") return "Relance J+7 envoyée";
  if (actionType === "interview_prep") return "Préparer entretien";
  return "Marquer envoyée";
}

function trackerStatusLabel(status: ApplicationStatus) {
  const labels: Record<string, string> = {
    "A contacter": "À envoyer",
    "Message envoye": "Contacté",
    "Relance J+3": "Relance J+3",
    "Relance J+7": "Relance J+7",
    "Reponse recue": "Réponse reçue",
    Entretien: "Entretien",
    Refus: "Refusé",
    Archive: "Terminé",
    Won: "Décroché",
    "No response": "Sans réponse",
  };
  return labels[status] || status;
}

function differenceInCalendarDays(date: Date, baseDate: Date) {
  const left = startOfDay(date).getTime();
  const right = startOfDay(baseDate).getTime();
  return Math.round((left - right) / 86400000);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = value.trim().toLowerCase().match(/^(\d{1,2})\s+([a-zéû\.]+)\s+(\d{4})$/i);
  if (!match) return null;

  const monthIndex = FRENCH_MONTHS[match[2].replace(".", "")];
  if (monthIndex === undefined) return null;

  return new Date(Number(match[3]), monthIndex, Number(match[1]));
}

const FRENCH_MONTHS: Record<string, number> = {
  janv: 0,
  janvier: 0,
  févr: 1,
  février: 1,
  fevr: 1,
  fevrier: 1,
  mars: 2,
  avr: 3,
  avril: 3,
  mai: 4,
  juin: 5,
  juil: 6,
  juillet: 6,
  août: 7,
  aout: 7,
  sept: 8,
  septembre: 8,
  oct: 9,
  octobre: 9,
  nov: 10,
  novembre: 10,
  déc: 11,
  décembre: 11,
  dec: 11,
  decembre: 11,
};

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function TrackerPanel({
  items,
  onClose,
  onSelect,
}: {
  items: TrackedApplication[];
  onClose: () => void;
  onSelect: (application: TrackedApplication) => void;
}) {
  return (
    <aside className="fixed bottom-0 right-0 top-0 z-[200] flex w-full animate-[slideIn_0.25s_ease-out] flex-col bg-[#f5f7f3] shadow-[-8px_0_30px_rgba(0,0,0,0.08)] sm:w-[min(380px,100vw)]">
      <div className="flex items-center justify-between border-b border-slate-200/60 px-5 py-4.5">
        <span className="text-base font-black text-slate-950">
          Suivi des candidatures
        </span>
        <button
          onClick={onClose}
          className="px-2 py-1 text-xl leading-none text-slate-400"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-auto px-5 py-4">
        {items.length === 0 ? (
          <p className="mt-12 text-center text-sm font-bold text-slate-400">
            Aucune candidature préparée.
            <br />
            Lance ta première analyse.
          </p>
        ) : (
          items.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className="mb-2.5 w-full rounded-[18px] border border-slate-200 bg-white/60 p-4 text-left shadow-sm transition hover:border-[#0d9488]"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-black text-slate-950">
                  {safeText(item.company, "Entreprise")}
                </span>
                <span
                  className="font-mono text-[13px] font-black"
                  style={{ color: scoreColor(item.matchScore) }}
                >
                  {item.matchScore}
                </span>
              </div>
              <p className="m-0 mb-2 text-[11px] font-bold text-slate-600">
                {safeText(item.role, "Poste")}
              </p>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                  <span
                    className="h-[7px] w-[7px] rounded-full"
                    style={{ background: statusDot(item.status) }}
                  />
                  {statusLabel(item.status)}
                </span>
                <span className="truncate text-[11px] font-bold text-slate-400">
                  {safeText(item.nextAction, "Prochaine action à définir.")}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}

function buildEmailFormats(contactName: string, domain: string) {
  const names = normalizeContactName(contactName);
  const cleanDomain = domain.trim().toLowerCase().replace(/^@/, "");

  if (!names.first || !names.last || !cleanDomain) return [];

  return [
    `${names.first}.${names.last}@${cleanDomain}`,
    `${names.first[0]}.${names.last}@${cleanDomain}`,
    `${names.first}${names.last}@${cleanDomain}`,
    `${names.first}_${names.last}@${cleanDomain}`,
  ];
}

function isValidFullName(value: string) {
  const namePartPattern = /^[A-Za-zÀ-ÖØ-öø-ÿ]{2,}(?:[-'][A-Za-zÀ-ÖØ-öø-ÿ]{2,})*$/;
  const parts = value.trim().split(/\s+/).filter(Boolean);

  return parts.length >= 2 && parts.every((part) => namePartPattern.test(part));
}

function isValidDomain(value: string) {
  if (!value || value.includes("@") || value.includes("/") || value.includes(":")) {
    return false;
  }

  const labels = value.split(".");

  if (labels.length < 2) {
    return false;
  }

  return labels.every((label, index) => {
    if (!label || label.startsWith("-") || label.endsWith("-")) {
      return false;
    }

    if (!/^[a-z0-9-]+$/i.test(label)) {
      return false;
    }

    return index < labels.length - 1 || /^[a-z]{2,}$/i.test(label);
  });
}

function getContactRoles(application: TrackedApplication) {
  const roleItems = safeList(application.linkedinProfilesToSearch);

  if (roleItems.length > 0) {
    return uniqueStrings(roleItems);
  }

  return uniqueStrings(
    safeText(application.contactToFind, "")
      .split(",")
      .map((role) => role.trim())
      .filter(Boolean)
  );
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items));
}

function normalizeContactName(value: string) {
  const parts = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 -]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  return {
    first: parts[0] || "",
    last: parts.slice(1).join("-") || "",
  };
}

function personalizeText(text: string, contactName: string) {
  const firstName = contactName.trim().split(/\s+/)[0] || contactName;

  return text
    .replaceAll("[Nom]", firstName)
    .replaceAll("[Prénom]", firstName)
    .replaceAll("[Votre prénom]", "")
    .replaceAll("[Votre Prénom Nom]", "");
}

function scoreColor(score: number) {
  if (score < 40) return "#94a3b8";
  if (score < 65) return "#d97706";
  return "#0d9488";
}

function scoreMeaning(score: number) {
  if (score < 40) return "Correspondance limitée";
  if (score < 65) return "Correspondance moyenne";
  if (score < 80) return "Bonne correspondance";
  return "Très bonne correspondance";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    "A contacter": "Préparé",
    "Message envoye": "Contacté",
    "Relance J+3": "Relance J+3",
    "Relance J+7": "Relance J+7",
    "Reponse recue": "Réponse reçue",
    Entretien: "Entretien",
    Refus: "Refus",
    Archive: "Terminé",
  };

  return labels[status] || status;
}

function statusDot(status: string) {
  const colors: Record<string, string> = {
    "A contacter": "#94a3b8",
    "Message envoye": "#f59e0b",
    "Relance J+3": "#f59e0b",
    "Relance J+7": "#f59e0b",
    "Reponse recue": "#10b981",
    Entretien: "#10b981",
    Refus: "#94a3b8",
    Archive: "#10b981",
  };

  return colors[status] || "#94a3b8";
}

function formatPreparedDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function safeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && !!item)
    : [];
}

function getDirectEmail(application: TrackedApplication) {
  const legacyApplication = application as TrackedApplication & { email?: string };
  return application.directEmail || legacyApplication.email || "";
}

function loadApplications() {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(APPLICATIONS_STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as TrackedApplication[];
  } catch {
    localStorage.removeItem(APPLICATIONS_STORAGE_KEY);
    return [];
  }
}
