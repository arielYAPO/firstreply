import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * Enregistre l'issue d'un tunnel PayPal Checkout qui n'aboutit pas
 * (annulation acheteur ou erreur SDK).
 *
 * IMPORTANT : cette route n'écrit jamais dans `status`. Le RPC
 * `complete_paypal_payment` exige `status = 'pending'` pour créditer le
 * compte. Marquer la demande "cancelled" ici bloquerait définitivement
 * un paiement qui aboutirait ensuite par un autre chemin (webhook,
 * capture tardive). L'issue est donc consignée dans `admin_note` seule.
 */

type Outcome = "cancelled" | "error";

const OUTCOME_LABELS: Record<Outcome, string> = {
  cancelled: "Tunnel PayPal Checkout abandonne par l'acheteur",
  error: "Tunnel PayPal Checkout interrompu par une erreur SDK",
};

function normalizeOutcome(value: unknown): Outcome | null {
  return value === "cancelled" || value === "error" ? value : null;
}

function normalizeDetail(value: unknown) {
  if (typeof value !== "string") return "";
  // Entree client : on tronque et on neutralise les sauts de ligne.
  return value.trim().replace(/\s+/g, " ").slice(0, 300);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const paymentRequestId =
      typeof body?.paymentRequestId === "string" ? body.paymentRequestId : "";
    const outcome = normalizeOutcome(body?.outcome);
    const detail = normalizeDetail(body?.detail);

    if (!paymentRequestId || !outcome) {
      return NextResponse.json(
        { error: "paymentRequestId et outcome requis." },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    const note = [
      `[${new Date().toISOString()}]`,
      OUTCOME_LABELS[outcome],
      detail ? `— ${detail}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    // Le filtre sur `status = 'pending'` garantit qu'on n'ecrase jamais
    // la note d'une demande deja payee ou rejetee.
    const { error: updateError } = await admin
      .from("payment_requests")
      .update({ admin_note: note })
      .eq("id", paymentRequestId)
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (updateError) {
      console.error("PayPal outcome report failed.", updateError);
      return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
    }

    return NextResponse.json({ recorded: true });
  } catch (error) {
    console.error(
      "PayPal outcome report failed.",
      error instanceof Error ? error.message : "Unknown error.",
    );
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
