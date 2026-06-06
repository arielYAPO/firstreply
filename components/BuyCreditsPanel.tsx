"use client";

import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";

export default function BuyCreditsPanel() {
  const router = useRouter();
  const { user, credits } = useAuthContext();

  if (!user) return null;
  if (credits > 0) return null;

  return (
    <section className="mx-auto mt-6 max-w-[720px] rounded-[18px] border border-amber-200 bg-amber-50/50 px-6 py-6 text-center">
      <p className="text-lg font-black text-slate-950">
        Tu n'as pas encore de crédits
      </p>
      <p className="mt-1 text-sm font-medium text-slate-600">
        Achète le pack FirstReply pour commencer à analyser tes candidatures.
      </p>
      <button
        onClick={() => router.push("/buy")}
        className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[#0d9488] px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-teal-900/10 transition hover:bg-[#0f766e]"
      >
        Acheter le pack — 10 €
      </button>
    </section>
  );
}
