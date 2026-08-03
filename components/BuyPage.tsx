"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";
import PayPalCheckoutButton from "./PayPalCheckoutButton";

const PAYPAL_ME_LINK = "https://www.paypal.com/ncp/payment/TJ3FSUERJ7PKE";

type FlowState = "idle" | "loading" | "waiting";

export default function BuyPage() {
  const router = useRouter();
  const { user, credits, loading, refreshCredits } = useAuthContext();
  const [state, setState] = useState<FlowState>("idle");
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [paypalMode, setPayPalMode] = useState<"loading" | "manual" | "sandbox" | "live">("loading");

  const [reported, setReported] = useState(false);
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user && credits > 0) {
      router.push("/dashboard");
    }
  }, [loading, user, credits, router]);

  // Restore pending request from localStorage on mount
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem("firstreply_pending_payment");
    if (stored) {
      try {
        const { id, timestamp, reported: wasReported } = JSON.parse(stored);
        const thirtyMinutes = 30 * 60 * 1000;
        if (Date.now() - timestamp < thirtyMinutes) {
          setRequestId(id);
          setState("waiting");
          setReported(Boolean(wasReported));
        } else {
          localStorage.removeItem("firstreply_pending_payment");
        }
      } catch {
        localStorage.removeItem("firstreply_pending_payment");
      }
    }
  }, [user]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7f3]">
        <p className="text-sm font-black text-slate-400">Chargement...</p>
      </main>
    );
  }

  async function handlePay() {
    setState("loading");
    setError("");

    try {
      const res = await fetch("/api/paypal/create-order", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Impossible de créer la demande.");
        setState("idle");
        return;
      }

      setRequestId(data.paymentRequestId);
      localStorage.setItem(
        "firstreply_pending_payment",
        JSON.stringify({ id: data.paymentRequestId, timestamp: Date.now() })
      );
      window.open(PAYPAL_ME_LINK, "_blank");
      setState("waiting");
    } catch {
      setError("Erreur lors de la demande.");
      setState("idle");
    }
  }

  async function handleCheck() {
    if (!requestId) return;
    setChecking(true);
    setError("");

    try {
      if (!reported) {
        const reportResponse = await fetch("/api/paypal/report-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentRequestId: requestId }),
        });
        const reportData = await reportResponse.json();

        if (!reportResponse.ok) {
          setError(reportData.error || "Impossible de signaler le paiement.");
          return;
        }
        if (reportData.paid) {
          localStorage.removeItem("firstreply_pending_payment");
          await refreshCredits();
          router.push("/dashboard");
          return;
        }

        setReported(true);
        localStorage.setItem(
          "firstreply_pending_payment",
          JSON.stringify({ id: requestId, timestamp: Date.now(), reported: true })
        );
        setError(
          "C\u2019est envoy\u00e9. Ton paiement va \u00eatre v\u00e9rifi\u00e9 manuellement dans quelques minutes."
        );
        return;
      }

      const res = await fetch("/api/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentRequestId: requestId }),
      });
      const data = await res.json();

      if (data.paid) {
        localStorage.removeItem("firstreply_pending_payment");
        await refreshCredits();
        router.push("/dashboard");
      } else {
        setError("Paiement pas encore validé. Réessaie dans quelques minutes.");
      }
    } catch {
      setError("Impossible de vérifier.");
    } finally {
      setChecking(false);
    }
  }

  const handlePayPalMode = useCallback(
    (mode: "manual" | "sandbox" | "live") => setPayPalMode(mode),
    [],
  );

  const handleAutomatedPayment = useCallback(async () => {
    localStorage.removeItem("firstreply_pending_payment");
    await refreshCredits();
    router.push("/dashboard");
  }, [refreshCredits, router]);
  if (state === "waiting") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#f5f7f3] px-5">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-sm font-bold text-white">
            F
          </span>
          <span className="text-lg font-black text-slate-950">FirstReply</span>
        </div>

        <div className="w-full max-w-[440px] rounded-[22px] border border-slate-200 bg-white px-6 py-8 shadow-xl shadow-slate-900/[0.06] sm:px-8 sm:py-10">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
            <span className="text-2xl">⏳</span>
          </div>

          <h1 className="text-center text-xl font-black text-slate-950">
            Paiement en attente
          </h1>
          <p className="mx-auto mt-3 max-w-[340px] text-center text-sm font-medium leading-relaxed text-slate-500">
            Si tu as payé via PayPal, tes crédits seront activés sous quelques
            minutes après vérification.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <a
              href={PAYPAL_ME_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 py-3 text-sm font-black text-amber-800 transition hover:bg-amber-100"
            >
              Rouvrir PayPal
            </a>
            <button
              onClick={handleCheck}
              disabled={checking}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0d9488] py-3 text-sm font-black text-white transition hover:bg-[#0f766e] disabled:opacity-60"
            >
              {checking ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Vérification...
                </>
              ) : (
                "Vérifier mon paiement"
              )}
            </button>
          </div>

          {error && (
            <p className="mt-4 text-center text-[12px] font-bold text-red-600">
              {error}
            </p>
          )}

          <p className="mt-5 text-center font-mono text-[10px] text-slate-400">
            Référence : {requestId?.slice(0, 8)}...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f5f7f3] px-5">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-sm font-bold text-white">
          F
        </span>
        <span className="text-lg font-black text-slate-950">FirstReply</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[440px] rounded-[22px] border border-slate-200 bg-white px-6 py-8 shadow-xl shadow-slate-900/[0.06] sm:px-8 sm:py-10">
        <h1 className="text-center text-xl font-black text-slate-950 sm:text-2xl">
          Débloque ton pack FirstReply
        </h1>
        <p className="mt-1.5 text-center text-sm font-medium text-slate-500">
          Paiement unique — pas d'abonnement
        </p>

        {/* Price */}
        <div className="mx-auto mt-6 w-full max-w-[280px] rounded-2xl border border-slate-200 bg-[#f5f7f3] py-5 text-center">
          <p className="text-4xl font-black text-[#0d9488]">10 €</p>
          <p className="mt-1 text-sm font-black text-slate-700">100 crédits</p>
        </div>

        {/* Features */}
        <div className="mt-6 space-y-3.5">
          <Feature icon="check" text="100 analyses" />
          <Feature icon="chart" text="1 crédit consommé par analyse réussie" />
          <Feature icon="shield" text="Aucun abonnement" />
          <Feature icon="lock" text="Paiement sécurisé" />
        </div>

        {/* PayPal button */}
        {error && (
          <p className="mt-4 text-center text-[12px] font-bold text-red-600">
            {error}
          </p>
        )}

        <PayPalCheckoutButton
          onMode={handlePayPalMode}
          onPaid={handleAutomatedPayment}
        />

        {paypalMode === "loading" && (
          <div className="mt-2 flex justify-center">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#0070ba]" />
          </div>
        )}

        {paypalMode === "manual" && (
          <button
            onClick={handlePay}
            disabled={state === "loading"}
            className="mt-2 flex w-full items-center justify-center gap-3 rounded-xl bg-[#0070ba] py-3.5 text-sm font-black text-white shadow-lg transition hover:bg-[#005ea6] disabled:opacity-60"
          >
            {state === "loading" ? "Préparation..." : "Payer avec PayPal"}
          </button>
        )}

        <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
          {paypalMode === "sandbox" ? "Mode Sandbox — aucun argent réel" : "Paiement traité via PayPal"}
        </p>

        {/* Bottom note */}
        <div className="mt-5 flex items-center justify-center gap-2 text-[12px] font-bold text-[#0d9488]">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {paypalMode === "manual" ? "Crédits activés après vérification" : "Crédits activés automatiquement après paiement"}
        </div>
      </div>
    </main>
  );
}

function Feature({ icon, text }: { icon: "check" | "chart" | "shield" | "lock"; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f0fdf9] text-[#0d9488]">
        {icon === "check" && (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {icon === "chart" && (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        )}
        {icon === "shield" && (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        )}
        {icon === "lock" && (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
      </div>
      <span className="text-sm font-bold text-slate-700">{text}</span>
    </div>
  );
}
