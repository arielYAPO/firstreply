import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { paymentRequestId } = await request.json();
    if (!paymentRequestId || typeof paymentRequestId !== "string") {
      return NextResponse.json({ error: "paymentRequestId requis." }, { status: 400 });
    }

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
      return NextResponse.json({ error: "Non authentifi\u00e9." }, { status: 401 });
    }

    const admin = createSupabaseAdmin();
    const { data: paymentRequest, error: readError } = await admin
      .from("payment_requests")
      .select("id, status, verification_requested_at")
      .eq("id", paymentRequestId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError || !paymentRequest) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }
    if (paymentRequest.status === "paid") {
      return NextResponse.json({ paid: true, alreadyReported: true });
    }
    if (paymentRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Cette demande ne peut plus \u00eatre signal\u00e9e." },
        { status: 409 },
      );
    }
    if (paymentRequest.verification_requested_at) {
      return NextResponse.json({ paid: false, alreadyReported: true });
    }

    const { data: updated, error: updateError } = await admin
      .from("payment_requests")
      .update({ verification_requested_at: new Date().toISOString() })
      .eq("id", paymentRequestId)
      .eq("user_id", user.id)
      .is("verification_requested_at", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Payment report update error", updateError);
      return NextResponse.json(
        { error: "Impossible de signaler le paiement." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      paid: false,
      alreadyReported: !updated,
      reported: Boolean(updated),
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
