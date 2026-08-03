import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

type SignupWebhookPayload = {
  type?: unknown;
  table?: unknown;
  schema?: unknown;
  record?: {
    id?: unknown;
    email?: unknown;
    full_name?: unknown;
    created_at?: unknown;
  } | null;
};

type ResendEmail = {
  from: string;
  to: string[];
  subject: string;
  text: string;
  reply_to?: string;
};

function secretsMatch(received: string | null, expected: string) {
  if (!received) return false;

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;

  const text = value.trim();
  return text || fallback;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendEmail(
  resendApiKey: string,
  idempotencyKey: string,
  email: ResendEmail,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(email),
  });

  if (!response.ok) {
    throw new Error(`Resend returned status ${response.status}.`);
  }
}

async function getSignupCount() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return null;
  const key = serviceRoleKey;

  async function countProfiles(orFilter?: string) {
    const url = new URL(`${supabaseUrl}/rest/v1/profiles`);
    url.searchParams.set("select", "id");
    if (orFilter) url.searchParams.set("or", orFilter);

    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
      cache: "no-store",
    }).catch(() => null);

    if (!response?.ok) return null;

    const total = response.headers.get("content-range")?.split("/").at(-1);
    const count = total ? Number.parseInt(total, 10) : Number.NaN;
    return Number.isFinite(count) ? count : null;
  }

  const [allProfiles, technicalProfiles] = await Promise.all([
    countProfiles(),
    countProfiles(
      "(email.ilike.*test*,email.like.*@example.com,full_name.ilike.*test*)",
    ),
  ]);

  if (allProfiles === null) return null;
  return Math.max(0, allProfiles - (technicalProfiles ?? 0));
}

function formatSignupNumber(count: number | null) {
  if (count === null) return "Nouvelle inscription FirstReply";
  return `${count}${count === 1 ? "re" : "e"} personne inscrite sur FirstReply`;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.SIGNUP_WEBHOOK_SECRET;
  const resendApiKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? "FirstReply <onboarding@resend.dev>";
  const replyToEmail = process.env.RESEND_REPLY_TO_EMAIL ?? adminEmail;

  if (!webhookSecret) {
    console.error("Signup webhook secret is missing.");
    return NextResponse.json(
      { error: "Configuration serveur incomplète." },
      { status: 500 },
    );
  }

  if (!secretsMatch(request.headers.get("x-webhook-secret"), webhookSecret)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | SignupWebhookPayload
    | null;

  if (
    !payload ||
    payload.type !== "INSERT" ||
    payload.schema !== "public" ||
    payload.table !== "profiles" ||
    !payload.record
  ) {
    return NextResponse.json(
      { error: "Événement webhook invalide." },
      { status: 400 },
    );
  }

  const userId = cleanText(payload.record.id, "");
  const email = cleanText(payload.record.email, "");
  const fullName = cleanText(payload.record.full_name, "Nouvel utilisateur");
  const createdAt = cleanText(
    payload.record.created_at,
    new Date().toISOString(),
  );

  if (!userId || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Profil d’inscription incomplet." },
      { status: 400 },
    );
  }

  if (!resendApiKey || !adminEmail) {
    console.error("Signup email environment variables are missing.");
    return NextResponse.json(
      { error: "Configuration serveur incomplète." },
      { status: 500 },
    );
  }

  const signupCount = await getSignupCount();
  const signupLabel = formatSignupNumber(signupCount);
  const signupDate = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(new Date(createdAt));

  try {
    await sendEmail(resendApiKey, `firstreply-signup-admin-${userId}`, {
      from: fromEmail,
      to: [adminEmail],
      reply_to: replyToEmail,
      subject: signupLabel,
      text: [
        signupLabel,
        "",
        "Une nouvelle personne vient de créer un compte FirstReply.",
        "",
        `Nom : ${fullName}`,
        `Email : ${email}`,
        `Inscription : ${signupDate}`,
        "Crédits initiaux : 10",
      ].join("\n"),
    });
  } catch (error) {
    console.error(
      "Resend rejected the signup notification email.",
      error instanceof Error ? error.message : "Unknown error.",
    );
    return NextResponse.json(
      { error: "Échec de l’envoi de la notification d’inscription." },
      { status: 502 },
    );
  }

  return NextResponse.json({ success: true, signupCount });
}