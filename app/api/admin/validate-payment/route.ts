import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "firstreply-admin-2024";
const CREDITS_PER_PACK = 100;

/**
 * Admin endpoint to validate a payment request after manual PayPal verification.
 *
 * Manual admin validation checklist:
 * 1. Open PayPal
 * 2. Verify that a payment was received from the expected user/email if available
 * 3. Verify that the amount received is exactly 10 EUR
 * 4. Verify that the currency is EUR
 * 5. Verify that this PayPal payment has not already been used to validate another payment_request
 * 6. Only then call this endpoint to set status = paid, paid_at = now()
 * 7. This endpoint adds 100 credits to the user
 *
 * IMPORTANT: PayPal.Me pre-fills the amount, but the user can still modify it before paying.
 * Admin must manually verify that the received PayPal payment amount is exactly 10 EUR
 * before granting credits. If the user paid less than 10 EUR, do not validate.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { secret, paymentRequestId, paypalReference, adminNote } = body;

    if (secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    if (!paymentRequestId) {
      return NextResponse.json({ error: "paymentRequestId requis." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    // Get the payment request
    const { data: pr, error: prError } = await admin
      .from("payment_requests")
      .select("*")
      .eq("id", paymentRequestId)
      .single();

    if (prError || !pr) {
      return NextResponse.json({ error: "Demande introuvable." }, { status: 404 });
    }

    if (pr.status === "paid") {
      return NextResponse.json({ error: "Déjà validé.", alreadyPaid: true }, { status: 400 });
    }

    // Mark as paid
    const { error: updateError } = await admin
      .from("payment_requests")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paypal_reference: paypalReference || null,
        admin_note: adminNote || null,
        validated_by: "admin",
      })
      .eq("id", paymentRequestId);

    if (updateError) {
      console.error("Payment request update error", updateError);
      return NextResponse.json({ error: "Erreur de mise à jour." }, { status: 500 });
    }

    // Grant credits
    const { data: currentBalance } = await admin
      .from("credit_balances")
      .select("credits")
      .eq("user_id", pr.user_id)
      .single();

    const currentCredits = currentBalance?.credits ?? 0;
    const newCredits = currentCredits + CREDITS_PER_PACK;

    await admin
      .from("credit_balances")
      .upsert({
        user_id: pr.user_id,
        credits: newCredits,
        updated_at: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      userId: pr.user_id,
      creditsGranted: CREDITS_PER_PACK,
      totalCredits: newCredits,
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
