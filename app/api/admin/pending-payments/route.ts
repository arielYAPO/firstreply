import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret =
      request.headers.get("x-admin-secret") ?? searchParams.get("secret");
    const requestedId = searchParams.get("request");

    if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const admin = createSupabaseAdmin();

    let query = admin
      .from("payment_requests")
      .select(`
        id,
        user_id,
        amount_cents,
        currency,
        credits_requested,
        status,
        created_at,
        paid_at,
        paypal_reference,
        verification_requested_at,
        admin_note
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (requestedId) {
      query = query.eq("id", requestedId);
    }

    const { data: requests, error } = await query;

    if (error) {
      return NextResponse.json({ error: "Erreur de lecture." }, { status: 500 });
    }

    // Enrich with user emails
    const userIds = [...new Set((requests ?? []).map((r) => r.user_id))];
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, { email: p.email, name: p.full_name }])
    );

    const enriched = (requests ?? []).map((r) => ({
      ...r,
      userEmail: profileMap.get(r.user_id)?.email ?? "unknown",
      userName: profileMap.get(r.user_id)?.name ?? "",
    }));

    return NextResponse.json({ requests: enriched });
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
