import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// This route checks the status of a payment request (polling by the frontend)
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
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const { data: paymentRequest } = await supabase
      .from("payment_requests")
      .select("id, status, credits_requested, paid_at")
      .eq("id", paymentRequestId)
      .eq("user_id", user.id)
      .single();

    if (!paymentRequest) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    return NextResponse.json({
      status: paymentRequest.status,
      paid: paymentRequest.status === "paid",
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
