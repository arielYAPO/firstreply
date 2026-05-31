import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createHash } from "crypto";

import { createSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { ApplicationStatus, TrackedApplication } from "@/lib/applications";

type CriteriaLevel = "indispensable" | "souhaité";
type Verdict = "oui" | "partiel" | "non";
type ContractType = "stage" | "alternance" | "CDI" | "CDD" | "autre";

type Criterion = {
  critere: string;
  niveau: CriteriaLevel;
};

type EvaluationItem = Criterion & {
  verdict: Verdict;
  justification: string;
};

type FinalContent = {
  entreprise: string;
  poste: string;
  type_contrat: ContractType;
  localisation: string | null;
  forces: string[];
  faiblesses: string[];
  angle: string;
  lettre_motivation: string;
  email_candidature: string;
  roles_a_chercher: string[];
  requetes_recherche: string[];
};

type ApplicationResponse = TrackedApplication & {
  criteres: Criterion[];
  evaluation: EvaluationItem[];
  score: number;
  entreprise: string;
  poste: string;
  type_contrat: ContractType;
  localisation: string | null;
  forces: string[];
  faiblesses: string[];
  angle: string;
  lettre_motivation: string;
  email_candidature: string;
  roles_a_chercher: string[];
  requetes_recherche: string[];
};

type JsonShape = "array" | "object";
type SupabaseAdminClient = ReturnType<typeof createSupabaseAdmin>;
type TokenUsage = {
  input: number | null;
  output: number | null;
};

type TimedLlmResult<T> = {
  data: T;
  durationMs: number;
  usage: TokenUsage;
};

class InvalidLlmJsonError extends Error {
  constructor(message = "Invalid LLM JSON after retry") {
    super(message);
    this.name = "InvalidLlmJsonError";
  }
}

class OpenAIRequestError extends Error {
  constructor(message = "OpenAI request failed") {
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
const ANALYSIS_CACHE_VERSION = "2026-05-13-final-prompts-v2";

const CRITERIA_EXTRACTION_PROMPT = `PROMPT SYSTÈME — APPEL 1a : Extraction des critères
Tu es un analyste de recrutement. Ta seule tâche est d'extraire les prérequis d'une offre d'emploi.

Lis attentivement l'offre fournie par l'utilisateur. Identifie chaque compétence, qualification, expérience ou condition demandée.

Pour chaque prérequis, détermine son niveau :
- "indispensable" : le prérequis est explicitement requis, présenté comme obligatoire, ou structurellement nécessaire pour le poste (ex : diplôme exigé, langue de travail, compétence cœur du poste)
- "souhaité" : le prérequis est mentionné comme un plus, un bonus, une préférence, ou utilise des termes comme "idéalement", "un plus", "serait apprécié", "de préférence", "c'est un plus si"

ACTIVATION DE LA RÈGLE DÉBUTANT — STRICTE :

Étape 1 : avant d'extraire, cherche dans l'offre si elle contient mot pour mot une de ces expressions appliquées au POSTE ENTIER (pas à un critère isolé) :
- "débutant accepté"
- "sans expérience requise"
- "premier emploi"
- "junior bienvenu"
- "formation assurée" (quand cette mention concerne l'ensemble du poste)
- équivalents évidents

Étape 2 :
- Si AUCUNE de ces expressions n'est présente au niveau du poste entier → règle débutant DÉSACTIVÉE. Extraction normale et exigeante.
- Si une expression est présente → règle débutant ACTIVÉE : les critères d'expérience professionnelle dans le secteur exact deviennent "souhaité" au lieu de "indispensable".

Une offre qui exige "étudiant en master", "autonome et rigoureux", "capable de porter un sujet sur 2 ans" est une offre EXIGEANTE, même si elle accepte des alternants. La règle débutant NE s'applique PAS à ces offres.

Si l'offre dit "X n'est pas requis, on te formera" pour un critère X spécifique, ce critère X est marqué "souhaité", mais les autres critères restent évalués normalement.

Règles strictes :
- Extrais entre 4 et 8 critères. Pas moins de 4, pas plus de 8.
- Chaque critère doit être une compétence, qualification ou condition distincte. Ne dédouble pas.
- Formule chaque critère de manière concise (maximum 8 mots).
- Si l'offre est vague, extrais uniquement les critères raisonnablement déductibles du titre du poste et marque-les "souhaité", sauf si l'offre les exige explicitement.
- N'invente pas de critères qui ne sont pas dans l'offre.
- Ne commente pas. Ne rajoute pas de texte. Réponds uniquement avec le JSON.

Format de réponse (JSON strict) :
[
  {"critere": "...", "niveau": "indispensable"},
  {"critere": "...", "niveau": "souhaité"}
]`;

const PROFILE_EVALUATION_PROMPT = `PROMPT SYSTÈME — APPEL 1b : Évaluation du profil
Tu es un évaluateur de candidatures. Ta seule tâche est de vérifier si un profil candidat correspond à une liste de critères.

Tu reçois :
1. Une liste de critères au format JSON (extraits d'une offre d'emploi)
2. Le texte du CV ou profil du candidat
3. Le texte original de l'offre d'emploi (pour contexte)

Pour chaque critère, donne un verdict :
- "oui" : le candidat a clairement cette compétence, qualification ou expérience. Il y a une preuve concrète dans son profil (projet, poste, formation, certification, stage).
- "partiel" : le candidat a quelque chose de lié mais pas exactement ce qui est demandé. Expérience similaire, compétence adjacente, formation théorique sans pratique, ou contexte différent.
- "non" : rien dans le profil ne correspond à ce critère, même indirectement.

ACTIVATION DE LA RÈGLE DÉBUTANT — STRICTE :

Étape 1 : avant d'évaluer, cherche dans l'offre originale si elle contient mot pour mot une de ces expressions appliquées au POSTE ENTIER (pas à un critère isolé) :
- "débutant accepté"
- "sans expérience requise"
- "premier emploi"
- "junior bienvenu"
- "formation assurée" (quand cette mention concerne l'ensemble du poste)
- équivalents évidents

Étape 2 :
- Si AUCUNE de ces expressions n'est présente au niveau du poste entier → règle débutant DÉSACTIVÉE. Évaluation normale et exigeante.
- Si une expression est présente → règle débutant ACTIVÉE :
  * Un stage dans le secteur concerné vaut "oui" sur les compétences sectorielles de base
  * Une formation théorique récente dans le domaine vaut "oui" sur les fondamentaux
  * L'absence d'années d'expérience cumulées ne pénalise pas le score
  * Les qualités humaines explicitement demandées (motivation, dynamisme, ambition) sont "oui" si démontrées par les choix de carrière

Une offre qui exige "étudiant en master", "autonome et rigoureux", "capable de porter un sujet sur 2 ans" est une offre EXIGEANTE, même si elle accepte des alternants. La règle débutant NE s'applique PAS à ces offres. Évalue-les normalement.

Si l'offre dit "X n'est pas requis, on te formera" pour UN critère X spécifique : ce critère X précis est évalué avec tolérance ("partiel" minimum si rien dans le profil), mais les autres critères restent évalués normalement.

Règles strictes d'évaluation :
- Sois exigeant sans être injuste. "partiel" n'est pas un "oui" timide. Mais ne sous-évalue pas un candidat qui coche ce que l'offre demande vraiment.
- Si le candidat a un projet personnel, un stage, ou une expérience transférable démontrant la compétence, c'est un "oui", pas un "partiel".
- Un score parfait (100/100) est rare et suspect. Si tous tes verdicts sont "oui", relis le CV et l'offre — il y a probablement au moins un critère où le candidat n'a pas exactement ce qui est demandé.
- La justification doit faire une seule phrase, factuelle, sans encouragement ni jugement.
- Ne calcule aucun score. Ne fais aucune recommandation. Tu donnes uniquement des verdicts.
- Ne commente pas. Réponds uniquement avec le JSON.

Format de réponse (JSON strict) :
[
  {"critere": "...", "niveau": "...", "verdict": "oui|partiel|non", "justification": "..."}
]`;

const CONTENT_GENERATION_PROMPT = `PROMPT SYSTÈME — APPEL 2 : Génération de contenu
Tu es un conseiller expert en candidature. Tu aides des étudiants et jeunes professionnels à préparer des candidatures ciblées pour des stages, alternances et postes juniors.

Tu reçois :
1. Le texte complet de l'offre d'emploi
2. Le texte complet du CV ou profil du candidat
3. L'évaluation structurée du match (JSON avec critères, verdicts et justifications)
4. Le score de correspondance calculé (sur 100)

Ta tâche est de générer un dossier de candidature complet au format JSON, avec exactement les sections suivantes dans cet ordre :

{
  "entreprise": "nom de l'entreprise détecté dans l'offre",
  "poste": "intitulé du poste",
  "type_contrat": "stage|alternance|CDI|CDD|autre",
  "localisation": "lieu si mentionné, sinon null",
  "forces": ["3 à 5 points forts du candidat pour CE poste, basés sur les verdicts 'oui'"],
  "faiblesses": ["2 à 3 points faibles formulés comme conseils actionnables"],
  "angle": "Un paragraphe de 3-5 phrases tutoyant le candidat, expliquant comment se positionner.",
  "lettre_motivation": "Lettre courte (150-250 mots) — voir règles ci-dessous",
  "email_candidature": "Email général court (60-100 mots) — voir règles ci-dessous",
  "roles_a_chercher": ["3 à 4 intitulés de postes de décideurs à contacter"],
  "requetes_recherche": ["3 requêtes Google ou LinkedIn prêtes à copier-coller"]
}

RÈGLE DOMAINE — ZÉRO HALLUCINATION :
Ne génère JAMAIS et ne devine JAMAIS le domaine email de l'entreprise. Le domaine sera demandé manuellement à l'utilisateur dans l'étape contact ultérieure. Aucun champ de ton JSON ne doit contenir un domaine deviné.

RÈGLE COHÉRENCE FAIBLESSES / VERDICTS :
Les faiblesses que tu listes doivent être cohérentes avec les verdicts. Si tu listes "manque d'expérience en X" comme faiblesse, alors le critère X doit avoir un verdict "partiel" ou "non" dans l'évaluation. Ne liste jamais une faiblesse sur un critère évalué "oui".

RÈGLES DE TON ET FORMAT :
- Tutoie le candidat dans le champ "angle" et "faiblesses"
- Le candidat est étudiant ou jeune actif. Le ton doit être direct, professionnel mais naturel.
- INTERDITS : "je serais ravi", "je suis convaincu que", "dans l'attente de votre retour", "mes salutations distinguées", "n'hésitez pas", "je me permets de vous contacter par la présente"
- AUTORISÉS : "je candidate à", "je cherche", "je suis disponible pour un échange", "cordialement"

RÈGLE LETTRE DE MOTIVATION :
- 150 à 250 mots maximum
- Commence par "Madame, Monsieur," sur une ligne, puis une ligne vide, puis le contenu
- Structure : (1) candidature directe et poste, (2) une preuve concrète tirée du CV, (3) lien avec ce que fait l'entreprise, (4) honnêteté sur un manque transformé en force si pertinent, (5) clôture courte avec "Cordialement," et le prénom nom
- Pas de blabla générique sur les "valeurs de l'entreprise"

RÈGLE EMAIL DE CANDIDATURE GÉNÉRAL :
- 60 à 100 mots maximum, JAMAIS plus
- Objet inclus en première ligne, format "Objet : ..."
- L'email N'EST PAS une mini-lettre. C'est un ping qui dit : (1) qui je suis en 1 phrase, (2) ce que je veux, (3) une preuve, (4) la dispo
- Pas de répétition de la lettre. Si la lettre dit X en détail, l'email mentionne X en 5 mots.
- Pas de signature complète avec téléphone et email — juste le prénom nom

RÈGLE FAIBLESSES :
- Maximum 3 faiblesses, pas plus
- Format : "Ils cherchent X — tu peux compenser en mettant en avant Y"
- Pas d'invention : ne mentionne pas de faiblesses sur des critères que l'offre ne demande pas
- Si le score est de 100, tu DOIS quand même identifier 1 ou 2 axes d'amélioration réalistes du profil pour ce poste

RÈGLES GLOBALES :
- Tout le contenu est en français
- Ne mens jamais sur le profil du candidat. N'invente pas d'expériences.
- Ne génère PAS d'email direct personnalisé ni de DM LinkedIn. Ces contenus sont générés dans l'appel /outreach ultérieur.
- Réponds uniquement avec le JSON. Pas de texte autour.`;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const accessKey = normalizeText(body?.accessKey);
    const jobOfferText = normalizeText(body?.jobOfferText);
    const profileText = normalizeText(body?.profileText);

    if (!accessKey) {
      return NextResponse.json({ error: "Code d'accès requis." }, { status: 400 });
    }

    if (!jobOfferText || !profileText) {
      return NextResponse.json(
        { error: "L'offre et le profil sont requis pour lancer l'analyse." },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY est manquante côté serveur." },
        { status: 500 },
      );
    }

    const supabase = createSupabaseAdmin();
    const { data: keyData, error: keyError } = await supabase
      .from("access_keys")
      .select("*")
      .eq("key", accessKey)
      .eq("active", true)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json({ error: "Code d'accès invalide." }, { status: 401 });
    }

    const creditsLimit = Number(keyData.credits_limit ?? 0);
    const creditsUsed = Number(keyData.credits_used ?? 0);
    const creditsRemaining = creditsLimit - creditsUsed;
    const normalizedOffer = normalizeInputForCache(jobOfferText);
    const normalizedProfile = normalizeInputForCache(profileText);

    const cachedOutput = await findCachedAnalysis(
      supabase,
      keyData.key,
      normalizedOffer,
      normalizedProfile,
    );

    if (cachedOutput) {
      return NextResponse.json({
        ...cachedOutput,
        fromCache: true,
        creditsRemaining,
      });
    }

    if (creditsRemaining < 1) {
      return NextResponse.json({ error: "Aucun crédit disponible." }, { status: 403 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const criteriaResult = await extractCriteria(openai, jobOfferText);
    const criteria = criteriaResult.data;
    const evaluationResult = await evaluateProfile(openai, criteria, profileText, jobOfferText);
    const evaluation = evaluationResult.data;
    const score = calculateScore(evaluation);
    const contentResult = await generateFinalContent(openai, jobOfferText, profileText, evaluation, score);
    const content = contentResult.data;
    const application = buildApplication(content, criteria, evaluation, score);
    const scoringMetadata = buildScoringMetadata({
      offerText: jobOfferText,
      profileText,
      criteria,
      evaluation,
      score,
      criteriaResult,
      evaluationResult,
      contentResult,
    });

    const output = {
      application,
      criteria,
      criteres: criteria,
      evaluation,
      score,
      contenu: content,
      scoringMetadata,
      normalizedInput: {
        offer: normalizedOffer,
        profile: normalizedProfile,
      },
      cacheVersion: ANALYSIS_CACHE_VERSION,
      fromCache: false,
    };

    const { error: insertError } = await supabase.from("generations").insert({
      access_key: keyData.key,
      company: application.company,
      role: application.role,
      output: JSON.stringify(output),
    });

    if (insertError) {
      console.error("Supabase generation insert error", insertError);
      return NextResponse.json(
        { error: "L'analyse a réussi, mais l'enregistrement a échoué. Aucun crédit n'a été consommé." },
        { status: 500 },
      );
    }

    const { error: updateError } = await supabase
      .from("access_keys")
      .update({ credits_used: creditsUsed + 1 })
      .eq("key", keyData.key);

    if (updateError) {
      console.error("Supabase credit update error", updateError);
      return NextResponse.json(
        { error: "L'analyse a été enregistrée, mais le crédit n'a pas pu être consommé." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ...output,
      creditsRemaining: creditsRemaining - 1,
    });
  } catch (error) {
    if (error instanceof InvalidLlmJsonError) {
      console.error(error);
      return NextResponse.json(
        { error: "Réponse IA invalide après nouvelle tentative." },
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
        { error: "Erreur OpenAI pendant l'analyse." },
        { status: 500 },
      );
    }

    console.error("Analyze application error", error);
    return NextResponse.json(
      { error: "Impossible d'analyser cette candidature pour le moment." },
      { status: 500 },
    );
  }
}

async function extractCriteria(openai: OpenAI, jobOfferText: string) {
  return measureDuration(() =>
    requestJsonWithRetry<Criterion[]>({
      openai,
      messages: [
        { role: "system", content: CRITERIA_EXTRACTION_PROMPT },
        { role: "user", content: `Offre d'emploi :\n\n${jobOfferText}` },
      ],
      expectedShape: "array",
      temperature: 0,
      normalize: normalizeCriteria,
    }),
  );
}

async function evaluateProfile(
  openai: OpenAI,
  criteria: Criterion[],
  profileText: string,
  jobOfferText: string,
) {
  return measureDuration(() =>
    requestJsonWithRetry<EvaluationItem[]>({
      openai,
      messages: [
        { role: "system", content: PROFILE_EVALUATION_PROMPT },
        {
          role: "user",
          content: [
            `Critères JSON :\n${JSON.stringify(criteria, null, 2)}`,
            `Profil candidat :\n${profileText}`,
            `Offre originale :\n${jobOfferText}`,
          ].join("\n\n---\n\n"),
        },
      ],
      expectedShape: "array",
      temperature: 0,
      normalize: (value) => normalizeEvaluation(value, criteria),
    }),
  );
}

async function generateFinalContent(
  openai: OpenAI,
  jobOfferText: string,
  profileText: string,
  evaluation: EvaluationItem[],
  score: number,
) {
  return measureDuration(() =>
    requestJsonWithRetry<FinalContent>({
      openai,
      messages: [
        { role: "system", content: CONTENT_GENERATION_PROMPT },
        {
          role: "user",
          content: [
            `Offre d'emploi :\n${jobOfferText}`,
            `CV ou profil candidat :\n${profileText}`,
            `Évaluation structurée :\n${JSON.stringify(evaluation, null, 2)}`,
            `Score de correspondance calculé : ${score}/100`,
          ].join("\n\n---\n\n"),
        },
      ],
      expectedShape: "object",
      temperature: 0.3,
      normalize: normalizeFinalContent,
    }),
  );
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
    expectedShape === "array"
      ? "La réponse précédente n'était pas un tableau JSON valide. Réponds uniquement avec le tableau JSON attendu, sans texte autour."
      : "La réponse précédente n'était pas un objet JSON valide. Réponds uniquement avec l'objet JSON attendu, sans texte autour.";
  let latestUsage: TokenUsage = { input: null, output: null };

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
    latestUsage = response.usage;

    const parsed = extractJson(response.content, expectedShape);
    const normalized = parsed ? normalize(parsed) : null;

    if (normalized) {
      return {
        data: normalized,
        usage: latestUsage,
      };
    }
  }

  throw new InvalidLlmJsonError();
}

async function createChatCompletion(
  openai: OpenAI,
  {
    messages,
    expectedShape,
    temperature,
  }: {
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
    expectedShape: JsonShape;
    temperature: number;
  },
) {
  const baseRequest: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: OPENAI_MODEL,
    messages,
  };

  const withJsonObject =
    expectedShape === "object"
      ? {
          ...baseRequest,
          response_format: { type: "json_object" as const },
        }
      : baseRequest;

  try {
    const completion = await openai.chat.completions.create({
      ...withJsonObject,
      temperature,
    });

    return {
      content: completion.choices[0]?.message?.content ?? "",
      usage: getTokenUsage(completion.usage),
    };
  } catch (error) {
    if (isUnsupportedTemperatureError(error)) {
      const completion = await openai.chat.completions.create(withJsonObject);
      return {
        content: completion.choices[0]?.message?.content ?? "",
        usage: getTokenUsage(completion.usage),
      };
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
    const startToken = expectedShape === "array" ? "[" : "{";
    const endToken = expectedShape === "array" ? "]" : "}";
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

function calculateScore(evaluation: EvaluationItem[]) {
  const pointsByVerdict: Record<Verdict, number> = {
    oui: 3,
    partiel: 1,
    non: 0,
  };

  const totals = evaluation.reduce(
    (acc, item) => {
      const weight = item.niveau === "indispensable" ? 2 : 1;
      acc.total += pointsByVerdict[item.verdict] * weight;
      acc.maxTotal += 3 * weight;
      return acc;
    },
    { total: 0, maxTotal: 0 },
  );

  if (totals.maxTotal === 0) {
    return 0;
  }

  return Math.round((totals.total / totals.maxTotal) * 100);
}

function normalizeCriteria(value: unknown): Criterion[] | null {
  const source = unwrapArray(value, ["criteres", "criteria", "prerequis"]);

  if (!source) {
    return null;
  }

  const criteria = source
    .map((item) => {
      if (!isObject(item)) {
        return null;
      }

      const critere = normalizeText(item.critere);
      const niveau = normalizeLevel(item.niveau);

      if (!critere || !niveau) {
        return null;
      }

      return { critere, niveau };
    })
    .filter((item): item is Criterion => Boolean(item))
    .slice(0, 8);

  return criteria.length >= 4 ? criteria : null;
}

function normalizeEvaluation(value: unknown, criteria: Criterion[]): EvaluationItem[] | null {
  const source = unwrapArray(value, ["evaluation", "evaluations", "resultats"]);

  if (!source) {
    return null;
  }

  const sourceItems = source.filter(isObject);

  if (sourceItems.length === 0) {
    return null;
  }

  const evaluation = criteria.map((criterion, index) => {
    const source =
      sourceItems.find(
        (item) => normalizeText(item.critere).toLowerCase() === criterion.critere.toLowerCase(),
      ) ?? sourceItems[index];

    const verdict = normalizeVerdict(source?.verdict);
    const justification = normalizeText(source?.justification);

    return {
      critere: criterion.critere,
      niveau: criterion.niveau,
      verdict: verdict ?? "non",
      justification: justification || "Aucune preuve explicite dans le profil.",
    };
  });

  return evaluation.length === criteria.length ? evaluation : null;
}

function normalizeFinalContent(value: unknown): FinalContent | null {
  if (!isObject(value)) {
    return null;
  }

  const entreprise = normalizeText(value.entreprise) || "Entreprise à confirmer";
  const poste = normalizeText(value.poste) || "Poste à confirmer";
  const typeContrat = normalizeContractType(value.type_contrat);
  const localisation = normalizeText(value.localisation) || null;
  const forces = normalizeStringArray(value.forces, 5);
  const faiblesses = normalizeStringArray(value.faiblesses, 4);
  const angle = normalizeText(value.angle);
  const lettreMotivation = normalizeText(value.lettre_motivation);
  const emailCandidature = normalizeText(value.email_candidature);
  const rolesAChercher = normalizeStringArray(value.roles_a_chercher, 4);
  const requetesRecherche = normalizeStringArray(value.requetes_recherche, 3);

  if (!angle || !lettreMotivation || !emailCandidature) {
    return null;
  }

  return {
    entreprise,
    poste,
    type_contrat: typeContrat,
    localisation,
    forces: forces.length > 0 ? forces : ["Point fort à préciser à partir du profil."],
    faiblesses: faiblesses.length > 0 ? faiblesses.slice(0, 3) : ["Ils cherchent un point précis — tu peux compenser en le clarifiant avant l'envoi."],
    angle,
    lettre_motivation: lettreMotivation,
    email_candidature: emailCandidature,
    roles_a_chercher:
      rolesAChercher.length > 0
        ? rolesAChercher
        : ["Talent Acquisition", "Responsable recrutement", "Manager de l'équipe"],
    requetes_recherche:
      requetesRecherche.length > 0
        ? requetesRecherche
        : [
            `${entreprise} Talent Acquisition LinkedIn`,
            `${entreprise} responsable recrutement LinkedIn`,
            `${entreprise} ${poste} LinkedIn`,
          ],
  };
}

function unwrapArray(value: unknown, keys: string[]) {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isObject(value)) {
    return null;
  }

  for (const key of keys) {
    const nested = value[key];

    if (Array.isArray(nested)) {
      return nested;
    }
  }

  return null;
}

function buildApplication(
  content: FinalContent,
  criteria: Criterion[],
  evaluation: EvaluationItem[],
  score: number,
): ApplicationResponse {
  const createdAt = new Date();
  const status: ApplicationStatus = "A contacter";
  const company = content.entreprise;
  const role = content.poste;
  const nextAction = `Cherche un contact pertinent chez ${company}, puis personnalise l'approche directe.`;

  return {
    id: crypto.randomUUID(),
    company,
    role,
    contractType: content.type_contrat,
    location: content.localisation ?? "",
    matchScore: score,
    scoreBreakdown: buildScoreBreakdown(score, evaluation),
    requiredSkills: criteria.map((criterion) => criterion.critere),
    candidateStrengths: content.forces,
    candidateWeaknesses: content.faiblesses,
    status,
    nextAction,
    nextFollowUpDate: formatDate(addDays(createdAt, 3)),
    contactToFind: content.roles_a_chercher.join(", "),
    suggestedAngle: content.angle,
    shortCoverLetter: content.lettre_motivation,
    directEmail: content.email_candidature,
    linkedInDM: "",
    followUpJ3: "",
    followUpJ7: "",
    linkedinProfilesToSearch: content.roles_a_chercher,
    searchQueries: content.requetes_recherche,
    likelyEmailPatterns: ["prenom.nom@domaine", "p.nom@domaine", "prenom_nom@domaine"],
    createdAt: createdAt.toISOString(),
    criteres: criteria,
    evaluation,
    score,
    entreprise: content.entreprise,
    poste: content.poste,
    type_contrat: content.type_contrat,
    localisation: content.localisation,
    forces: content.forces,
    faiblesses: content.faiblesses,
    angle: content.angle,
    lettre_motivation: content.lettre_motivation,
    email_candidature: content.email_candidature,
    roles_a_chercher: content.roles_a_chercher,
    requetes_recherche: content.requetes_recherche,
  };
}

function buildScoreBreakdown(score: number, evaluation: EvaluationItem[]) {
  const oui = evaluation.filter((item) => item.verdict === "oui").length;
  const partiel = evaluation.filter((item) => item.verdict === "partiel").length;
  const non = evaluation.filter((item) => item.verdict === "non").length;

  return `${score}/100 calculé à partir de ${evaluation.length} critères: ${oui} oui, ${partiel} partiel, ${non} non.`;
}

function buildScoringMetadata({
  offerText,
  profileText,
  criteria,
  evaluation,
  score,
  criteriaResult,
  evaluationResult,
  contentResult,
}: {
  offerText: string;
  profileText: string;
  criteria: Criterion[];
  evaluation: EvaluationItem[];
  score: number;
  criteriaResult: TimedLlmResult<Criterion[]>;
  evaluationResult: TimedLlmResult<EvaluationItem[]>;
  contentResult: TimedLlmResult<FinalContent>;
}) {
  const summary = summarizeEvaluation(evaluation);
  const totalInputTokens = sumNullable([
    criteriaResult.usage.input,
    evaluationResult.usage.input,
    contentResult.usage.input,
  ]);
  const totalOutputTokens = sumNullable([
    criteriaResult.usage.output,
    evaluationResult.usage.output,
    contentResult.usage.output,
  ]);

  return {
    timestamp: new Date().toISOString(),
    offer_hash: hashText(offerText),
    profile_hash: hashText(profileText),
    nb_criteres_extraits: criteria.length,
    nb_oui: summary.oui,
    nb_partiel: summary.partiel,
    nb_non: summary.non,
    score_calcule: score,
    evaluation_json: evaluation,
    criteria_json: criteria,
    model_1a: OPENAI_MODEL,
    model_1b: OPENAI_MODEL,
    model_2: OPENAI_MODEL,
    temperature_1a: 0,
    temperature_1b: 0,
    temperature_2: 0.3,
    duration_1a_ms: criteriaResult.durationMs,
    duration_1b_ms: evaluationResult.durationMs,
    duration_2_ms: contentResult.durationMs,
    estimated_input_tokens: totalInputTokens,
    estimated_output_tokens: totalOutputTokens,
    estimated_cost_centimes: null,
  };
}

async function measureDuration<T>(
  fn: () => Promise<{ data: T; usage: TokenUsage }>,
): Promise<TimedLlmResult<T>> {
  const start = performance.now();
  const result = await fn();

  return {
    data: result.data,
    usage: result.usage,
    durationMs: Math.round(performance.now() - start),
  };
}

function summarizeEvaluation(evaluation: EvaluationItem[]) {
  return evaluation.reduce(
    (summary, item) => {
      summary[item.verdict] += 1;
      return summary;
    },
    { oui: 0, partiel: 0, non: 0 } satisfies Record<Verdict, number>,
  );
}

function normalizeTextForHash(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function hashText(value: string) {
  return createHash("sha256").update(normalizeTextForHash(value)).digest("hex");
}

function sumNullable(values: Array<number | null>) {
  const numbers = values.filter((value): value is number => typeof value === "number");

  if (numbers.length === 0) {
    return null;
  }

  return numbers.reduce((total, value) => total + value, 0);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInputForCache(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

async function findCachedAnalysis(
  supabase: SupabaseAdminClient,
  accessKey: string,
  normalizedOffer: string,
  normalizedProfile: string,
) {
  const { data, error } = await supabase
    .from("generations")
    .select("output")
    .eq("access_key", accessKey)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error || !data) {
    if (error) {
      console.error("Supabase cache lookup error", error);
    }

    return null;
  }

  for (const row of data) {
    const output = parseSavedOutput(row.output);

    if (
      output &&
      isObject(output.normalizedInput) &&
      output.cacheVersion === ANALYSIS_CACHE_VERSION &&
      output.normalizedInput.offer === normalizedOffer &&
      output.normalizedInput.profile === normalizedProfile
    ) {
      return output;
    }
  }

  return null;
}

function parseSavedOutput(value: unknown) {
  if (isObject(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeStringArray(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(normalizeText).filter(Boolean).slice(0, maxItems);
}

function normalizeLevel(value: unknown): CriteriaLevel | null {
  const text = normalizeText(value).toLowerCase();

  if (text.includes("indispensable")) {
    return "indispensable";
  }

  if (text.includes("souhait")) {
    return "souhaité";
  }

  return null;
}

function normalizeVerdict(value: unknown): Verdict | null {
  const text = normalizeText(value).toLowerCase();

  if (text === "oui") {
    return "oui";
  }

  if (text === "partiel") {
    return "partiel";
  }

  if (text === "non") {
    return "non";
  }

  return null;
}

function normalizeContractType(value: unknown): ContractType {
  const text = normalizeText(value).toLowerCase();

  if (text === "stage") {
    return "stage";
  }

  if (text === "alternance") {
    return "alternance";
  }

  if (text === "cdi") {
    return "CDI";
  }

  if (text === "cdd") {
    return "CDD";
  }

  return "autre";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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

  return (
    status === 429 ||
    code.includes("quota") ||
    message.includes("quota") ||
    message.includes("billing")
  );
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

function getTokenUsage(
  usage: OpenAI.Chat.Completions.ChatCompletion["usage"] | undefined,
): TokenUsage {
  return {
    input: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : null,
    output: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : null,
  };
}
