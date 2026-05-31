import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(request: Request) {
  try {
    const { key } = await request.json();

    if (!key || typeof key !== "string") {
      return NextResponse.json({ error: "Clé invalide." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    const { data, error } = await supabase
      .from("access_keys")
      .select("key, active, credits_limit, credits_used")
      .eq("key", key.trim())
      .single();

    if (error || !data || !data.active) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 401 });
    }

    return NextResponse.json({
      key: data.key,
      creditsLimit: data.credits_limit,
      creditsUsed: data.credits_used,
      creditsRemaining: Math.max(data.credits_limit - data.credits_used, 0),
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
