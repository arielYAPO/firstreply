import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getPayPalEnvironment, paypalRequest } from "@/lib/paypal";

type PayPalCapture = {
  id: string;
  status: string;
  amount: { value: string; currency_code: string };
};
type FulfillmentResult = { credits_granted: number; total_credits: number; already_processed: boolean };
type PayPalCapturedOrder = {
  id: string;
  status: string;
  purchase_units?: Array<{ payments?: { captures?: PayPalCapture[] } }>;
};

async function getUser() {
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

export async function POST(request: Request) {
  let reportedRequestId = "";

  try {
    const body = await request.json();
    const paymentRequestId = typeof body.paymentRequestId === "string" ? body.paymentRequestId : "";
    const orderId = typeof body.orderId === "string" ? body.orderId : "";
    reportedRequestId = paymentRequestId;
    if (!paymentRequestId) return NextResponse.json({ error: "paymentRequestId requis." }, { status: 400 });

    const { supabase, user } = await getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

    if (!orderId) {
      const { data: manualRequest } = await supabase.from("payment_requests")
        .select("status").eq("id", paymentRequestId).eq("user_id", user.id).single();
      if (!manualRequest) return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
      return NextResponse.json({ status: manualRequest.status, paid: manualRequest.status === "paid" });
    }

    const admin = createSupabaseAdmin();
    const { data: paymentRequest, error: requestError } = await admin.from("payment_requests")
      .select("id,user_id,status,paypal_order_id,paypal_capture_id,paypal_environment")
      .eq("id", paymentRequestId).eq("user_id", user.id).single();
    if (requestError || !paymentRequest || paymentRequest.paypal_order_id !== orderId) {
      return NextResponse.json({ error: "Commande PayPal introuvable." }, { status: 404 });
    }
    if (paymentRequest.paypal_environment !== getPayPalEnvironment()) {
      return NextResponse.json({ error: "Environnement PayPal incorrect." }, { status: 409 });
    }
    if (paymentRequest.status === "paid") {
      const { data: balance } = await admin.from("credit_balances").select("credits")
        .eq("user_id", user.id).single();
      return NextResponse.json({ paid: true, alreadyProcessed: true, totalCredits: balance?.credits ?? 0 });
    }

    const capturedOrder = await paypalRequest<PayPalCapturedOrder>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      { method: "POST", requestId: `capture-${paymentRequestId}`, body: {} },
    );
    const capture = capturedOrder.purchase_units?.[0]?.payments?.captures?.[0];
    const amountCents = capture ? Math.round(Number(capture.amount.value) * 100) : 0;
    if (
      capturedOrder.id !== orderId ||
      capturedOrder.status !== "COMPLETED" ||
      !capture ||
      capture.status !== "COMPLETED" ||
      amountCents !== 1000 ||
      capture.amount.currency_code !== "EUR"
    ) {
      throw new Error("Captured PayPal payment did not match the FirstReply pack.");
    }

    const { data: result, error: fulfillmentError } = await admin.rpc("complete_paypal_payment", {
      p_payment_request_id: paymentRequestId,
      p_paypal_order_id: orderId,
      p_paypal_capture_id: capture.id,
      p_amount_cents: amountCents,
      p_currency: capture.amount.currency_code,
    }).single();
    if (fulfillmentError || !result) throw fulfillmentError ?? new Error("Credit fulfillment failed.");
    const fulfillment = result as unknown as FulfillmentResult;

    return NextResponse.json({
      paid: true,
      captureId: capture.id,
      creditsGranted: fulfillment.credits_granted,
      totalCredits: fulfillment.total_credits,
      alreadyProcessed: fulfillment.already_processed,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error.";
    console.error("Capture PayPal order failed.", reason);

    // Consigne la cause reelle sur la demande, sans toucher au statut :
    // `complete_paypal_payment` exige `status = 'pending'` pour crediter,
    // donc la demande doit rester recuperable.
    if (reportedRequestId) {
      try {
        await createSupabaseAdmin()
          .from("payment_requests")
          .update({
            admin_note: `[${new Date().toISOString()}] Echec de capture PayPal — ${reason.slice(0, 300)}`,
          })
          .eq("id", reportedRequestId)
          .eq("status", "pending");
      } catch (noteError) {
        console.error("Capture failure note not saved.", noteError);
      }
    }

    return NextResponse.json({ error: "Le paiement PayPal n’a pas pu être finalisé." }, { status: 502 });
  }
}