"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearSession,
  loadSession,
  SESSION_UPDATED_EVENT,
  type FirstReplySession,
} from "@/lib/session";

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<FirstReplySession | null>(null);

  useEffect(() => {
    const loaded = loadSession();
    if (!loaded) {
      router.push("/");
      return;
    }
    setSession(loaded);

    function handleSessionUpdated(event: Event) {
      const customEvent = event as CustomEvent<FirstReplySession>;
      setSession(customEvent.detail);
    }

    window.addEventListener(SESSION_UPDATED_EVENT, handleSessionUpdated);

    return () => {
      window.removeEventListener(SESSION_UPDATED_EVENT, handleSessionUpdated);
    };
  }, [router]);

  function logout() {
    clearSession();
    router.push("/");
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-surface p-6 text-slate-300">
        Chargement...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_34%),#070A0F] px-4 py-6 sm:px-6 lg:py-8">
      <header className="mx-auto mb-6 grid max-w-7xl gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-accent">
            FirstReply
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-6xl">
            Obtiens ta première réponse plus vite.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
            Colle une offre et ton profil. FirstReply prépare ta candidature,
            ton message direct et tes relances.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-panel/80 p-5 shadow-2xl shadow-black/20 sm:min-w-80">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                Crédits
              </p>
              <p className="mt-2 text-4xl font-black text-white">
                {session.creditsRemaining}
                <span className="ml-2 text-sm font-semibold text-slate-400">
                  crédits
                </span>
              </p>
              <p className="mt-2 text-sm text-slate-400">
                1 crédit = 1 candidature préparée.
              </p>
            </div>

            <button
              onClick={logout}
              className="rounded-2xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-elevated hover:text-slate-200"
            >
              Sortir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl">{children}</div>
    </main>
  );
}
