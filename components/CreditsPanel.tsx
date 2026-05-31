"use client";

import { useEffect, useState } from "react";
import {
  loadSession,
  SESSION_UPDATED_EVENT,
  type FirstReplySession,
} from "@/lib/session";

export default function CreditsPanel() {
  const [session, setSession] = useState<FirstReplySession | null>(null);

  useEffect(() => {
    setSession(loadSession());

    function handleSessionUpdated(event: Event) {
      const customEvent = event as CustomEvent<FirstReplySession>;
      setSession(customEvent.detail);
    }

    window.addEventListener(SESSION_UPDATED_EVENT, handleSessionUpdated);

    return () => {
      window.removeEventListener(SESSION_UPDATED_EVENT, handleSessionUpdated);
    };
  }, []);

  if (!session) return null;

  return (
    <section className="card p-5">
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-acid">
        Crédits
      </p>
      <h2 className="mt-3 text-3xl font-black">
        {session.creditsRemaining} restants
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Chaque analyse consomme 1 crédit. Un crédit = score, angle, email, DM
        LinkedIn et relances.
      </p>
    </section>
  );
}
