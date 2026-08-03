import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type PaymentWebhookPayload = {
  type?: unknown;
  table?: unknown;
  schema?: unknown;
  record?: {
    id?: unknown;
    user_id?: unknown;
    amount_cents?: unknown;
    currency?: unknown;
    credits_requested?: unknown;
    verification_requested_at?: unknown;
  } | null;
  old_record?: { verification_requested_at?: unknown } | null;
};

function secretsMatch(received: string | null, expected: string) {
  if (!received) return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.SIGNUP_WEBHOOK_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;

  if (!webhookSecret || !resendApiKey || !adminEmail) {
    console.error("Payment notification environment variables are missing.");
    return NextResponse.json(
      { error: "Configuration serveur incompl\u00e8te." },
      { status: 500 },
    );
  }

  if (!secretsMatch(request.headers.get("x-webhook-secret"), webhookSecret)) {
    return NextResponse.json({ error: "Non autoris\u00e9." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | PaymentWebhookPayload
    | null;
  const record = payload?.record;

  if (
    !payload || payload.type !== "UPDATE" || payload.schema !== "public" ||
    payload.table !== "payment_requests" || !record ||
    typeof record.id !== "string" || typeof record.user_id !== "string" ||
    typeof record.verification_requested_at !== "string" ||
    payload.old_record?.verification_requested_at
  ) {
    return NextResponse.json(
      { error: "\u00c9v\u00e9nement webhook invalide." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("email, full_name")
    .eq("id", record.user_id)
    .maybeSingle();

  const amount = typeof record.amount_cents === "number"
    ? (record.amount_cents / 100).toFixed(2) : "10.00";
  const currency = typeof record.currency === "string" ? record.currency : "EUR";
  const credits = typeof record.credits_requested === "number"
    ? record.credits_requested : 100;
  const fullName = profile?.full_name?.trim() || "Utilisateur FirstReply";
  const email = profile?.email?.trim() || "Email non renseign\u00e9";
  const requestedAt = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris",
  }).format(new Date(record.verification_requested_at));
  const reviewUrl = new URL("/admin/payments", request.url);
  reviewUrl.searchParams.set("request", record.id);

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `firstreply-payment-review-${record.id}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL ?? "FirstReply <onboarding@resend.dev>",
      to: [adminEmail],
      subject: `Paiement FirstReply \u00e0 v\u00e9rifier \u2014 ${fullName}`,
      text: [
        "Un utilisateur indique avoir effectu\u00e9 son paiement FirstReply.", "",
        `Nom : ${fullName}`, `Email : ${email}`,
        `Montant attendu : ${amount} ${currency}`,
        `Cr\u00e9dits demand\u00e9s : ${credits}`, `Signal\u00e9 le : ${requestedAt}`, "",
        "V\u00e9rifie la transaction dans PayPal avant d\u2019accorder les cr\u00e9dits.",
        `Examiner la demande : ${reviewUrl.toString()}`,
      ].join("\n"),
    }),
  });

  if (!resendResponse.ok) {
    console.error(`Resend rejected payment notification: ${resendResponse.status}.`);
    return NextResponse.json(
      { error: "\u00c9chec de l\u2019envoi de la notification." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true });
}
