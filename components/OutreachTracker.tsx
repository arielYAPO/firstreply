"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, Trash2 } from "lucide-react";
import {
  APPLICATIONS_STORAGE_KEY,
  APPLICATIONS_UPDATED_EVENT,
  type TrackedApplication,
} from "@/lib/applications";

export default function OutreachTracker() {
  const [applications, setApplications] = useState<TrackedApplication[]>([]);
  const [copiedId, setCopiedId] = useState("");
  const [openId, setOpenId] = useState("");

  useEffect(() => {
    setApplications(loadApplications());

    function handleApplicationsUpdated(event: Event) {
      const customEvent = event as CustomEvent<TrackedApplication[]>;
      setApplications(customEvent.detail);
    }

    window.addEventListener(
      APPLICATIONS_UPDATED_EVENT,
      handleApplicationsUpdated
    );

    return () => {
      window.removeEventListener(
        APPLICATIONS_UPDATED_EVENT,
        handleApplicationsUpdated
      );
    };
  }, []);

  function removeApplication(id: string) {
    setApplications((current) => {
      const updated = current.filter((application) => application.id !== id);
      localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  async function copyEmail(application: TrackedApplication) {
    await navigator.clipboard.writeText(getDirectEmail(application));
    setCopiedId(application.id);
    window.setTimeout(() => setCopiedId(""), 1400);
  }

  return (
    <section className="card p-6">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-accent">
          Tracker
        </p>
        <h2 className="mt-2 text-2xl font-black text-white">
          Prochaines actions
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Chaque candidature devient une mission claire : quoi envoyer, qui
          chercher et quand relancer.
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-slate-950/40 p-7 text-sm leading-6 text-slate-400">
          Aucune candidature préparée pour l'instant. Lance une analyse pour
          créer automatiquement ta première mission.
        </div>
      ) : (
        <div className="grid gap-4">
          {applications.map((application) => (
            <ApplicationCard
              key={application.id}
              application={application}
              copied={copiedId === application.id}
              open={openId === application.id}
              onCopy={() => copyEmail(application)}
              onToggle={() =>
                setOpenId((current) =>
                  current === application.id ? "" : application.id
                )
              }
              onDelete={() => removeApplication(application.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ApplicationCard({
  application,
  copied,
  open,
  onCopy,
  onToggle,
  onDelete,
}: {
  application: TrackedApplication;
  copied: boolean;
  open: boolean;
  onCopy: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-3xl border border-line bg-elevated/55 p-5 transition hover:border-slate-600/40">
      <div className="flex flex-col gap-4 border-b border-line pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge status={application.status} />
          <p className="rounded-full bg-slate-950/50 px-3 py-1 text-xs font-semibold text-slate-400">
            Relance : {formatDate(application.nextFollowUpDate)}
          </p>
        </div>

        <div className="rounded-2xl border border-accent/20 bg-accent/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            Prochaine action
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-white">
            {getText(application.nextAction) || "Envoyer le message direct."}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
        <div>
          <h3 className="text-xl font-black text-white">
            {getText(application.company) || "Entreprise à confirmer"}
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            {getText(application.role) || "Poste à confirmer"}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-slate-950/50 px-4 py-3 text-left md:text-right">
          <p className="text-2xl font-black text-white">
            {application.matchScore}/100
          </p>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Match
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-slate-300">
        {getText(application.suggestedAngle)}
      </p>

      {open && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-line bg-slate-950/40 p-4 text-sm text-slate-300">
          <TrackerMiniSection
            title="Qui chercher"
            value={getText(application.contactToFind)}
          />
          <TrackerMiniSection
            title="Profils LinkedIn"
            value={safeList(application.linkedinProfilesToSearch).join(" · ")}
          />
          <TrackerMiniSection
            title="Formats d'emails probables"
            value={safeList(application.likelyEmailPatterns).join(" · ")}
          />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-2 rounded-2xl border border-line px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-accent hover:text-white"
        >
          <Copy size={15} />
          {copied ? "Copié" : "Copier email"}
        </button>
        <button
          onClick={onToggle}
          className="inline-flex items-center gap-2 rounded-2xl border border-line px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-accent hover:text-white"
        >
          <Eye size={15} />
          {open ? "Masquer" : "Voir détails"}
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-2 rounded-2xl border border-line px-3 py-2 text-sm font-semibold text-slate-400 transition hover:border-danger/40 hover:bg-danger/10 hover:text-red-300"
        >
          <Trash2 size={15} />
          Supprimer
        </button>
      </div>
    </article>
  );
}

function TrackerMiniSection({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      <p className="mt-1 leading-6">{value || "À compléter."}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const displayStatus = formatStatus(status);
  const className = getStatusClass(displayStatus);

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {displayStatus}
    </span>
  );
}

function getStatusClass(status: string) {
  if (status.includes("Relance")) {
    return "border-warning/30 bg-warning/10 text-yellow-200";
  }

  if (status.includes("Réponse") || status.includes("Entretien")) {
    return "border-success/30 bg-success/10 text-lime-200";
  }

  if (status.includes("Archivé") || status.includes("Refus")) {
    return "border-slate-500/30 bg-slate-700/30 text-slate-300";
  }

  return "border-accent/30 bg-accent/10 text-sky-100";
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    "A contacter": "À contacter",
    "Message envoye": "Message envoyé",
    "Reponse recue": "Réponse reçue",
    Archive: "Archivé",
  };

  return labels[status] || status;
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
