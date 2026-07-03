/**
 * FirstReply scoring reproducibility helper.
 *
 * This script calls a running local Next.js API multiple times with the same
 * offer/profile pair and prints score/evaluation stability diagnostics.
 *
 * Warning: each uncached successful analysis consumes 1 credit. Current backend
 * cache should prevent repeated identical calls from consuming credits after the
 * first successful run, but use a test access key.
 *
 * Example:
 *   FIRSTREPLY_ACCESS_KEY=your_key npx tsx scripts/test-reproducibility.ts --runs=5
 *
 * Optional args:
 *   --access-key=your_key
 *   --url=http://127.0.0.1:3000
 *   --runs=5
 */

type EvaluationItem = {
  critere?: string;
  verdict?: "oui" | "partiel" | "non";
};

type AnalyzeResponse = {
  score?: number;
  fromCache?: boolean;
  criteria?: Array<{ critere?: string }>;
  criteres?: Array<{ critere?: string }>;
  evaluation?: EvaluationItem[];
  application?: {
    matchScore?: number;
  };
  error?: string;
};

type RunResult = {
  run: number;
  ok: boolean;
  score: number | null;
  fromCache: boolean;
  nbOui: number;
  nbPartiel: number;
  nbNon: number;
  criteriaNames: string[];
  error?: string;
};

const TEST_OFFER = `
AI Engineer Intern - RAG Systems

Mindlapse recherche un stagiaire ou alternant pour contribuer à des systèmes RAG.
Missions : améliorer les pipelines de retrieval, tester des embeddings, travailler avec Python,
LangChain, PostgreSQL/pgvector et aider à mettre en production des prototypes.
Profil recherché : étudiant en master ou école d'ingénieur, solide base Python, compréhension des LLM,
rigueur, autonomie et capacité à documenter clairement.
Une première expérience avec les modèles open-source est un plus.
`;

const TEST_PROFILE = `
Étudiant en Big Data & Machine Learning. J'ai construit Scope, un projet RAG avec FastAPI,
LangChain, pgvector et une interface TypeScript. J'ai utilisé les APIs OpenAI et Gemini,
déployé un prototype complet et travaillé sur le scoring sémantique. Je maîtrise Python,
SQL et les bases du machine learning. Je cherche une alternance ou un stage orienté LLM/RAG.
`;

async function main() {
  const accessKey = getArg("access-key") || process.env.FIRSTREPLY_ACCESS_KEY || process.env.ACCESS_KEY;
  const baseUrl = getArg("url") || process.env.FIRSTREPLY_BASE_URL || "http://127.0.0.1:3000";
  const runs = parsePositiveInt(getArg("runs"), 5);

  if (!accessKey) {
    console.error("Missing access key. Use FIRSTREPLY_ACCESS_KEY=... or --access-key=...");
    process.exit(1);
  }

  console.warn("Warning: this can consume credits unless the backend cache returns fromCache=true.");
  console.log(`Calling ${baseUrl}/api/analyze-application ${runs} time(s)\n`);

  const results: RunResult[] = [];

  for (let index = 0; index < runs; index += 1) {
    const run = index + 1;
    const result = await runAnalysis({ baseUrl, accessKey, run });
    results.push(result);
    printRun(result);
  }

  printSummary(results);
}

async function runAnalysis({
  baseUrl,
  accessKey,
  run,
}: {
  baseUrl: string;
  accessKey: string;
  run: number;
}): Promise<RunResult> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/analyze-application`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessKey,
        jobOfferText: TEST_OFFER,
        profileText: TEST_PROFILE,
      }),
    });
    const data = (await response.json()) as AnalyzeResponse;

    if (!response.ok) {
      return {
        run,
        ok: false,
        score: null,
        fromCache: Boolean(data.fromCache),
        nbOui: 0,
        nbPartiel: 0,
        nbNon: 0,
        criteriaNames: [],
        error: data.error || `HTTP ${response.status}`,
      };
    }

    const evaluation = Array.isArray(data.evaluation) ? data.evaluation : [];
    const criteria = Array.isArray(data.criteres) ? data.criteres : data.criteria || [];
    const summary = summarizeEvaluation(evaluation);

    return {
      run,
      ok: true,
      score: typeof data.score === "number" ? data.score : data.application?.matchScore ?? null,
      fromCache: Boolean(data.fromCache),
      ...summary,
      criteriaNames: criteria.map((item) => item.critere || "(critere manquant)"),
    };
  } catch (error) {
    return {
      run,
      ok: false,
      score: null,
      fromCache: false,
      nbOui: 0,
      nbPartiel: 0,
      nbNon: 0,
      criteriaNames: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function summarizeEvaluation(evaluation: EvaluationItem[]) {
  return evaluation.reduce(
    (summary, item) => {
      if (item.verdict === "oui") summary.nbOui += 1;
      if (item.verdict === "partiel") summary.nbPartiel += 1;
      if (item.verdict === "non") summary.nbNon += 1;
      return summary;
    },
    { nbOui: 0, nbPartiel: 0, nbNon: 0 },
  );
}

function printRun(result: RunResult) {
  console.log(`Run ${result.run}: ${result.ok ? "success" : "failed"}`);

  if (!result.ok) {
    console.log(`  error: ${result.error}`);
    return;
  }

  console.log(`  score: ${result.score}`);
  console.log(`  fromCache: ${result.fromCache}`);
  console.log(`  oui/partiel/non: ${result.nbOui}/${result.nbPartiel}/${result.nbNon}`);
  console.log(`  criteria: ${result.criteriaNames.join(" | ")}`);
}

function printSummary(results: RunResult[]) {
  const successful = results.filter((result) => result.ok && typeof result.score === "number");
  const scores = successful.map((result) => result.score as number);
  const uniqueCriteriaSets = new Set(successful.map((result) => result.criteriaNames.join("||")));

  console.log("\nSummary");

  if (scores.length === 0) {
    console.log("  No successful runs.");
    return;
  }

  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const average = scores.reduce((total, score) => total + score, 0) / scores.length;

  console.log(`  successful runs: ${successful.length}/${results.length}`);
  console.log(`  min score: ${min}`);
  console.log(`  max score: ${max}`);
  console.log(`  score range: ${max - min}`);
  console.log(`  average score: ${average.toFixed(1)}`);
  console.log(`  unique criteria sets count: ${uniqueCriteriaSets.size}`);
}

function getArg(name: string) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : "";
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

main();

export {};
