"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

type Payment = {
  id: string;
  amount_cents: number;
  currency: string;
  credits_requested: number;
  status: string;
  userEmail: string;
  userName: string;
};

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#f5f7f3]" />}>
      <AdminPaymentsContent />
    </Suspense>
  );
}

function AdminPaymentsContent() {
  const requestId = useSearchParams().get("request");
  const [secret, setSecret] = useState("");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paypalReference, setPaypalReference] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadPayment(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (requestId) params.set("request", requestId);
      const response = await fetch(`/api/admin/pending-payments?${params}`, {
        headers: { "x-admin-secret": secret },
      });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error || "Acc\u00e8s refus\u00e9.");
      const selected = data.requests?.[0] ?? null;
      setPayment(selected);
      if (!selected) setMessage("Aucune demande \u00e0 examiner.");
    } catch {
      setMessage("Impossible de charger la demande.");
    } finally {
      setLoading(false);
    }
  }

  async function approvePayment() {
    if (!payment) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/validate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          paymentRequestId: payment.id,
          paypalReference,
        }),
      });
      const data = await response.json();
      if (!response.ok) return setMessage(data.error || "Validation impossible.");
      setPayment({ ...payment, status: "paid" });
      setMessage(`${data.creditsGranted} cr\u00e9dits accord\u00e9s avec succ\u00e8s.`);
    } catch {
      setMessage("Impossible de valider le paiement.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f3] px-5 py-12 text-slate-950">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-black">V&eacute;rification du paiement</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          V&eacute;rifie la transaction et le montant dans PayPal avant d&apos;accepter.
        </p>

        {!payment ? (
          <form onSubmit={loadPayment} className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label htmlFor="admin-secret" className="text-sm font-black">
              Secret administrateur
            </label>
            <input
              id="admin-secret"
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
            />
            <button disabled={loading} className="mt-4 w-full rounded-xl bg-slate-950 py-3 text-sm font-black text-white disabled:opacity-60">
              {loading ? "Chargement\u2026" : "Ouvrir la demande"}
            </button>
          </form>
        ) : (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-lg font-black">{payment.userName || "Nom non renseign\u00e9"}</p>
            <p className="text-sm text-slate-600">{payment.userEmail}</p>
            <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
              <p><span className="block text-slate-400">Montant attendu</span><strong>{(payment.amount_cents / 100).toFixed(2)} {payment.currency}</strong></p>
              <p><span className="block text-slate-400">Cr&eacute;dits</span><strong>{payment.credits_requested}</strong></p>
            </div>
            <p className="mt-4 text-sm"><span className="text-slate-400">Statut : </span><strong>{payment.status}</strong></p>
            {payment.status === "pending" && <>
              <input
                value={paypalReference}
                onChange={(event) => setPaypalReference(event.target.value)}
                placeholder={"R\u00e9f\u00e9rence PayPal (recommand\u00e9e)"}
                className="mt-6 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm"
              />
              <button onClick={approvePayment} disabled={loading} className="mt-4 w-full rounded-xl bg-[#0d9488] py-3 text-sm font-black text-white disabled:opacity-60">
                {loading ? "Validation\u2026" : "J\u2019ai v\u00e9rifi\u00e9 PayPal \u2014 accepter"}
              </button>
            </>}
          </section>
        )}
        {message && <p className="mt-4 text-center text-sm font-bold">{message}</p>}
      </div>
    </main>
  );
}
