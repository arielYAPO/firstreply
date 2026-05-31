"use client";

import { useEffect, useState } from "react";
import {
  APPLICATIONS_STORAGE_KEY,
  APPLICATIONS_UPDATED_EVENT,
  WORKFLOW_STATE_EVENT,
  type TrackedApplication,
  type WorkflowState,
} from "@/lib/applications";

const steps: Array<{
  id: WorkflowState;
  label: string;
  description: string;
}> = [
  {
    id: "prepare",
    label: "Préparer",
    description: "Offre + profil",
  },
  {
    id: "analyze",
    label: "Analyser",
    description: "Score + angle",
  },
  {
    id: "send",
    label: "Envoyer",
    description: "Messages prêts",
  },
  {
    id: "follow",
    label: "Relancer",
    description: "Tracker actif",
  },
];

export default function WorkflowStepper() {
  const [state, setState] = useState<WorkflowState>("prepare");
  const activeIndex = steps.findIndex((step) => step.id === state);

  useEffect(() => {
    const storedApplications = loadApplications();
    if (storedApplications.length > 0) setState("follow");

    function handleWorkflowState(event: Event) {
      const customEvent = event as CustomEvent<WorkflowState>;
      setState(customEvent.detail);
    }

    function handleApplicationsUpdated(event: Event) {
      const customEvent = event as CustomEvent<TrackedApplication[]>;
      if (customEvent.detail.length > 0) setState("send");
    }

    window.addEventListener(WORKFLOW_STATE_EVENT, handleWorkflowState);
    window.addEventListener(
      APPLICATIONS_UPDATED_EVENT,
      handleApplicationsUpdated
    );

    return () => {
      window.removeEventListener(WORKFLOW_STATE_EVENT, handleWorkflowState);
      window.removeEventListener(
        APPLICATIONS_UPDATED_EVENT,
        handleApplicationsUpdated
      );
    };
  }, []);

  return (
    <section className="rounded-3xl border border-line bg-elevated/70 p-3 shadow-xl shadow-black/10">
      <div className="grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;

          return (
            <div
              key={step.id}
              className={`rounded-2xl px-4 py-3 transition ${
                isActive
                  ? "bg-accent/10 text-white ring-1 ring-accent/25"
                  : "text-slate-400"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    isComplete
                      ? "border-success/40 bg-success/10 text-success"
                      : isActive
                        ? "border-accent/50 bg-accent text-slate-950"
                        : "border-line bg-slate-950/60 text-slate-500"
                  }`}
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold">{step.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
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
