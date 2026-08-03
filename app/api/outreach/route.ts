import { NextResponse } from "next/server";
import OpenAI from "openai";

import { createSupabaseAdmin } from "@/lib/supabaseAdmin";

type JsonShape = "object";
type OutreachContent = {
  email_direct: string;
  linkedin_dm: string;
  relance_j3: string;
  relance_j7: string;
};

class InvalidLlmJsonError extends Error {
  constructor(message = "Invalid outreach JSON after retry") {
    super(message);
    this.name = "InvalidLlmJsonError";
  }
}

class OpenAIRequestError extends Error {
  constructor(message = "OpenAI outreach request failed") {
    super(message);
    this.name = "OpenAIRequestError";
  }
}

class OpenAIQuotaError extends Error {
  constructor(message = "OpenAI quota or billing error") {
    super(message);
    this.name = "OpenAIQuotaError";
  }
}

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5-nano";
const EMAIL_FORMATS_DISCLAIMER = "Formats probables, non vérifiés.";

const OUTREACH_PROMPT = `PROMPT SYSTÈME — APPEL /OUTREACH
Tu es un conseiller expert en outreach professionnel. Tu génères des messages personnalisés pour un candidat qui a trouvé un contact réel chez une entreprise cible.

Tu reçois :
1. Le texte de l'offre originale
2. Le CV du candidat
3. Le contenu de candidature déjà généré (lettre, email général, angle)
4. Le nom complet du contact trouvé
5. Le domaine email confirmé par l'utilisateur (entré manuellement)

Ta tâche est de générer le JSON suivant :

{
  "email_direct": "...",
  "linkedin_dm": "...",
  "relance_j3": "...",
  "relance_j7": "..."
}

RÈGLE ZÉRO COPIER-COLLER :
L'email direct ne doit JAMAIS être identique ou quasi-identique à l'email général de candidature. Il a une structure différente :
- Ligne 1 : Objet court et accrocheur (pas le titre du poste recopié)
- Ouverture : "Bonjour [Prénom du contact]," (utilise uniquement le prénom)
- Phrase 1 : une accroche spécifique liant le candidat à l'entreprise ou au contact (pourquoi LUI, pas un autre)
- Phrase 2-3 : la preuve la plus pertinente du CV pour ce poste précis
- Phrase 4 : une demande claire d'échange court (15 minutes, café, appel)
- Signature : Prénom Nom uniquement, pas de coordonnées

L'email direct fait 80 à 130 mots. Pas plus.

RÈGLE D'ANCRAGE — ZÉRO INVENTION :
- N'invente aucun fait sur le contact, l'entreprise, ses valeurs, ses projets ou sa façon de travailler.
- Le nom et le domaine ne prouvent rien sur le contact. Ne prétends jamais avoir suivi son travail ou connaître son approche sans preuve explicite dans l'offre.
- Si aucune information vérifiable sur le contact n'est fournie, personnalise l'accroche à partir du poste, des missions et de l'entreprise mentionnés dans l'offre.
- Chaque affirmation factuelle doit venir de l'offre, du CV ou du contenu de candidature fourni.

RÈGLE DM LINKEDIN :
Le DM LinkedIn fait 2 à 4 phrases maximum. Style conversationnel, jamais corporate.
INTERDIT : copier le champ "angle" tel quel, utiliser "je me positionne comme", "je suis convaincu", "mon profil semble aligné"
AUTORISÉ : "Bonjour [Prénom], j'ai vu l'offre [poste] chez [entreprise]. J'ai [preuve courte du CV]. Seriez-vous ouvert à un échange rapide ?"

Le DM ne doit JAMAIS contenir des fragments tronqués du champ angle ou de la lettre de motivation. Il est rédigé de zéro pour LinkedIn.

RÈGLE RELANCES :
- Relance J+3 : 3 à 4 phrases. Référence brève au premier message, reformulation de l'intérêt, ne pas répéter l'argumentaire complet
- Relance J+7 : 3 phrases maximum. Ton humble, accepter le non, laisser la porte ouverte
- Les deux relances commencent par "Bonjour [Prénom],"
- Ne jamais utiliser "je me permets de revenir vers vous" — préfère "Je reviens vers vous"

RÈGLES GLOBALES :
- Tout en français
- Utiliser le prénom du contact uniquement, jamais le nom de famille
- Ne pas mentionner d'email dans le contenu des messages — l'email est généré par le code à côté
- Réponds uniquement avec le JSON. Pas de texte autour.`;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const contactName = normalizeText(body?.contactName ?? body?.contactFullName);
    const domain = normalizeDomain(body?.domain ?? body?.companyDomain);
    const accessKey = normalizeText(body?.accessKey);
    const application = isObject(body?.application) ? body.application : {};
    const contenu = isObject(body?.contenu) ? body.contenu : {};
    const jobOfferText = normalizeText(body?.jobOfferText);
    const profileText = normalizeText(body?.profileText);

    if (!isValidFullName(contactName)) {
      return NextResponse.json(
        { error: "Entre un nom complet, par exemple : François Dupont." },
        { status: 400 },
      );
    }

    if (!isValidDomain(domain)) {
      return NextResponse.json(
        { error: "Entre un domaine valide, par exemple : mindlapse.ai." },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY est manquante côté serveur." },
        { status: 500 },
      );
    }

    const emailFormats = buildEmailFormats(contactName, domain);
    const generated = await generateOutreach({
      openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      jobOfferText,
      profileText,
      application,
      contenu,
      contactName,
      domain,
    });

    const responseBody = {
      emailFormats,
      emailFormatsDisclaimer: EMAIL_FORMATS_DISCLAIMER,
      email_direct: generated.email_direct,
      linkedin_dm: generated.linkedin_dm,
      relance_j3: generated.relance_j3,
      relance_j7: generated.relance_j7,
      personalizedDirectEmail: generated.email_direct,
      personalizedLinkedInDM: generated.linkedin_dm,
      followUpJ3: generated.relance_j3,
      followUpJ7: generated.relance_j7,
    };

    if (accessKey) {
      await saveOutreach(accessKey, application, responseBody);
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    if (error instanceof InvalidLlmJsonError) {
      console.error(error);
      return NextResponse.json(
        { error: "Réponse IA invalide pour l'approche directe." },
        { status: 500 },
      );
    }

    if (error instanceof OpenAIQuotaError) {
      console.error(error);
      return NextResponse.json(
        { error: "Erreur OpenAI: quota ou facturation indisponible." },
        { status: 500 },
      );
    }

    if (error instanceof OpenAIRequestError) {
      console.error(error);
      return NextResponse.json(
        { error: "Erreur OpenAI pendant la génération outreach." },
        { status: 500 },
      );
    }

    console.error("Outreach generation error", error);
    return NextResponse.json(
      { error: "Impossible de préparer l'approche directe pour le moment." },
      { status: 500 },
    );
  }
}

async function generateOutreach({
  openai,
  jobOfferText,
  profileText,
  application,
  contenu,
  contactName,
  domain,
}: {
  openai: OpenAI;
  jobOfferText: string;
  profileText: string;
  application: Record<string, unknown>;
  contenu: Record<string, unknown>;
  contactName: string;
  domain: string;
}) {
  const contentContext = {
    entreprise: normalizeText(contenu.entreprise) || normalizeText(application.company),
    poste: normalizeText(contenu.poste) || normalizeText(application.role),
    angle: normalizeText(contenu.angle) || normalizeText(application.suggestedAngle),
    lettre_motivation:
      normalizeText(contenu.lettre_motivation) || normalizeText(application.shortCoverLetter),
    email_candidature:
      normalizeText(contenu.email_candidature) || normalizeText(application.directEmail),
    forces: normalizeArray(contenu.forces).length
      ? normalizeArray(contenu.forces)
      : normalizeArray(application.candidateStrengths),
  };

  return requestJsonWithRetry<OutreachContent>({
    openai,
    messages: [
      { role: "system", content: OUTREACH_PROMPT },
      {
        role: "user",
        content: [
          `Offre originale :\n${jobOfferText || "Non disponible dans cette session."}`,
          `CV ou profil candidat :\n${profileText || "Non disponible dans cette session."}`,
          `Contenu de candidature déjà généré :\n${JSON.stringify(contentContext, null, 2)}`,
          `Contact trouvé : ${contactName}`,
          `Domaine confirmé manuellement : ${domain}`,
        ].join("\n\n---\n\n"),
      },
    ],
    expectedShape: "object",
    temperature: 0.3,
    normalize: normalizeOutreachContent,
  });
}

async function saveOutreach(
  accessKey: string,
  application: Record<string, unknown>,
  output: Record<string, unknown>,
) {
  try {
    const supabase = createSupabaseAdmin();
    const { error } = await supabase.from("generations").insert({
      access_key: accessKey,
      company: normalizeText(application.company),
      role: normalizeText(application.role),
      output: JSON.stringify({
        type: "outreach",
        output,
        createdAt: new Date().toISOString(),
      }),
    });

    if (error) {
      console.error("Supabase outreach save error", error);
    }
  } catch (error) {
    console.error("Outreach save skipped", error);
  }
}

async function requestJsonWithRetry<T>({
  openai,
  messages,
  expectedShape,
  temperature,
  normalize,
}: {
  openai: OpenAI;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  expectedShape: JsonShape;
  temperature: number;
  normalize: (value: unknown) => T | null;
}) {
  const retryMessage =
    "La réponse précédente n'était pas un objet JSON valide. Réponds uniquement avec l'objet JSON attendu, sans texte autour.";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await createChatCompletion(openai, {
      messages:
        attempt === 0
          ? messages
          : [
              ...messages,
              { role: "user", content: retryMessage },
            ],
      expectedShape,
      temperature,
    });

    const parsed = extractJson(response, expectedShape);
    const normalized = parsed ? normalize(parsed) : null;

    if (normalized) {
      return normalized;
    }
  }

  throw new InvalidLlmJsonError();
}

async function createChatCompletion(
  openai: OpenAI,
  {
    messages,
    temperature,
  }: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    expectedShape: JsonShape;
    temperature: number;
  },
) {
  const request: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: OPENAI_MODEL,
    messages,
    response_format: { type: "json_object" },
  };

  try {
    const completion = await openai.chat.completions.create({
      ...request,
      temperature,
    });

    return completion.choices[0]?.message?.content ?? "";
  } catch (error) {
    if (isUnsupportedTemperatureError(error)) {
      const completion = await openai.chat.completions.create(request);
      return completion.choices[0]?.message?.content ?? "";
    }

    if (isQuotaError(error)) {
      throw new OpenAIQuotaError(getErrorMessage(error));
    }

    throw new OpenAIRequestError(getErrorMessage(error));
  }
}

function extractJson(raw: string, expectedShape: JsonShape) {
  const text = raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    const startToken = expectedShape === "object" ? "{" : "[";
    const endToken = expectedShape === "object" ? "}" : "]";
    const start = text.indexOf(startToken);
    const end = text.lastIndexOf(endToken);

    if (start < 0 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(text.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

function normalizeOutreachContent(value: unknown): OutreachContent | null {
  if (!isObject(value)) {
    return null;
  }

  const emailDirect = normalizeText(value.email_direct);
  const linkedinDm = normalizeText(value.linkedin_dm);
  const relanceJ3 = normalizeText(value.relance_j3);
  const relanceJ7 = normalizeText(value.relance_j7);

  if (!emailDirect || !linkedinDm || !relanceJ3 || !relanceJ7) {
    return null;
  }

  return {
    email_direct: emailDirect,
    linkedin_dm: linkedinDm,
    relance_j3: relanceJ3,
    relance_j7: relanceJ7,
  };
}

function buildEmailFormats(contactName: string, domain: string) {
  const parts = normalizeNameParts(contactName);
  const first = parts[0];
  const last = parts.slice(1).join("");

  if (!first || !last) {
    return [];
  }

  return [
    `${first}.${last}@${domain}`,
    `${first[0]}.${last}@${domain}`,
    `${first}${last}@${domain}`,
    `${first}_${last}@${domain}`,
  ];
}

function normalizeNameParts(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
}

function isValidFullName(value: string) {
  const namePartPattern = /^[A-Za-zÀ-ÖØ-öø-ÿ]{2,}(?:[-'][A-Za-zÀ-ÖØ-öø-ÿ]{2,})*$/;
  const parts = value.trim().split(/\s+/).filter(Boolean);

  return parts.length >= 2 && parts.every((part) => namePartPattern.test(part));
}

function normalizeDomain(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function isValidDomain(value: string) {
  if (!value || value.includes("@") || value.includes("/") || value.includes(":")) {
    return false;
  }

  const labels = value.split(".");

  if (labels.length < 2) {
    return false;
  }

  return labels.every((label, index) => {
    if (!label || label.startsWith("-") || label.endsWith("-")) {
      return false;
    }

    if (!/^[a-z0-9-]+$/.test(label)) {
      return false;
    }

    return index < labels.length - 1 || /^[a-z]{2,}$/.test(label);
  });
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeText).filter(Boolean);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnsupportedTemperatureError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const code = isObject(error) ? normalizeText(error.code) : "";

  return (
    code === "unsupported_parameter" ||
    (message.includes("temperature") && (message.includes("unsupported") || message.includes("does not support")))
  );
}

function isQuotaError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  const status = isObject(error) && typeof error.status === "number" ? error.status : null;
  const code = isObject(error) ? normalizeText(error.code).toLowerCase() : "";

  return status === 429 || code.includes("quota") || message.includes("quota") || message.includes("billing");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (isObject(error) && typeof error.message === "string") {
    return error.message;
  }

  return "Unknown error";
}
