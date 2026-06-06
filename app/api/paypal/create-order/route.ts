import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export async function POST() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    // Idempotency: check for existing pending request within last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - THIRTY_MINUTES_MS).toISOString();

    const { data: existingRequest } = await supabase
      .from("payment_requests")
      .select("id, created_at, status")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gte("created_at", thirtyMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (existingRequest) {
      return NextResponse.json({
        paymentRequestId: existingRequest.id,
        status: "pending",
        reused: true,
      });
    }

    // Create new payment request
    const { data: newRequest, error } = await supabase
      .from("payment_requests")
      .insert({
        user_id: user.id,
        amount_cents: 1000,
        currency: "EUR",
        credits_requested: 100,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !newRequest) {
      console.error("Payment request insert error", error);
      return NextResponse.json(
        { error: "Impossible de créer la demande de paiement." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      paymentRequestId: newRequest.id,
      status: "pending",
      reused: false,
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
