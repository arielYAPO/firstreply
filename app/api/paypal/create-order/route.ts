import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPayPalEnvironment, isPayPalConfigured, paypalRequest } from "@/lib/paypal";

type PayPalOrder = { id: string; status: string };

async function getAuthenticatedContext() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
    } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function createManualRequest(
  supabase: Awaited<ReturnType<typeof getAuthenticatedContext>>["supabase"],
  userId: string,
) {
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: existing } = await supabase.from("payment_requests").select("id")
    .eq("user_id", userId).eq("status", "pending").gte("created_at", since)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing) return { paymentRequestId: existing.id, status: "pending", reused: true, automated: false };

  const { data, error } = await supabase.from("payment_requests").insert({
    user_id: userId, amount_cents: 1000, currency: "EUR", credits_requested: 100, status: "pending",
  }).select("id").single();
  if (error || !data) throw new Error("Manual payment request failed.");
  return { paymentRequestId: data.id, status: "pending", reused: false, automated: false };
}

export async function POST() {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    if (!isPayPalConfigured()) return NextResponse.json(await createManualRequest(supabase, user.id));

    const admin = createSupabaseAdmin();
    const environment = getPayPalEnvironment();
    const { data: request, error: insertError } = await admin.from("payment_requests").insert({
      user_id: user.id,
      amount_cents: 1000,
      currency: "EUR",
      credits_requested: 100,
      status: "pending",
      payment_provider: "paypal_checkout",
      paypal_environment: environment,
    }).select("id").single();
    if (insertError || !request) throw new Error("Automated payment request insert failed.");

    try {
      const order = await paypalRequest<PayPalOrder>("/v2/checkout/orders", {
        method: "POST",
        requestId: request.id,
        body: {
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: request.id,
            custom_id: user.id,
            description: "Pack FirstReply — 100 crédits",
            amount: { currency_code: "EUR", value: "10.00" },
          }],
          payment_source: { paypal: { experience_context: {
            brand_name: "FirstReply", user_action: "PAY_NOW", shipping_preference: "NO_SHIPPING",
          } } },
        },
      });
      const { error: updateError } = await admin.from("payment_requests")
        .update({ paypal_order_id: order.id }).eq("id", request.id).eq("status", "pending");
      if (updateError) throw updateError;
      return NextResponse.json({
        orderId: order.id,
        paymentRequestId: request.id,
        status: order.status,
        automated: true,
        environment,
      });
    } catch (error) {
      await admin.from("payment_requests").update({
        status: "rejected", admin_note: "PayPal order creation failed.",
      }).eq("id", request.id).eq("status", "pending");
      throw error;
    }
  } catch (error) {
    console.error("Create PayPal order failed.", error instanceof Error ? error.message : "Unknown error.");
    return NextResponse.json({ error: "Impossible de créer la commande PayPal." }, { status: 502 });
  }
}