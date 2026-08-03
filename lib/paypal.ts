type PayPalEnvironment = "sandbox" | "live";

/**
 * Erreur PayPal qui conserve la cause réelle renvoyée par l'API.
 * Sans ça, les logs ne contiennent que le code HTTP et un échec de
 * paiement est indiagnosticable après coup.
 */
export class PayPalApiError extends Error {
  readonly status: number;
  readonly issues: string[];
  readonly debugId: string;

  constructor(status: number, issues: string[], debugId: string) {
    const summary = issues.length > 0 ? issues.join(", ") : "cause non précisée";
    super(
      `PayPal API returned status ${status} (${summary})${
        debugId ? ` [debug_id: ${debugId}]` : ""
      }`,
    );
    this.name = "PayPalApiError";
    this.status = status;
    this.issues = issues;
    this.debugId = debugId;
  }
}

/**
 * N'extrait que les codes d'erreur et le debug_id.
 * Le corps complet est volontairement ignoré : il peut contenir le nom
 * et l'email du payeur, qui n'ont rien à faire dans des logs.
 */
function extractPayPalIssues(raw: string) {
  const empty = { issues: [] as string[], debugId: "" };
  if (!raw) return empty;

  try {
    const parsed = JSON.parse(raw) as {
      name?: unknown;
      debug_id?: unknown;
      details?: Array<{ issue?: unknown }>;
    };
    const issues: string[] = [];

    if (typeof parsed.name === "string" && parsed.name) {
      issues.push(parsed.name);
    }
    if (Array.isArray(parsed.details)) {
      for (const detail of parsed.details) {
        if (typeof detail?.issue === "string" && detail.issue) {
          issues.push(detail.issue);
        }
      }
    }

    return {
      issues: Array.from(new Set(issues)).slice(0, 5),
      debugId: typeof parsed.debug_id === "string" ? parsed.debug_id : "",
    };
  } catch {
    return empty;
  }
}

type PayPalRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  requestId?: string;
};

function getEnvironment(): PayPalEnvironment {
  return process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
}

export function isPayPalConfigured() {
  return Boolean(
    process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET,
  );
}

export function getPayPalPublicConfig() {
  return {
    clientId: process.env.PAYPAL_CLIENT_ID ?? "",
    environment: getEnvironment(),
  };
}

function getBaseUrl() {
  return getEnvironment() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are missing.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );
  const response = await fetch(`${getBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const raw = await response.text().catch(() => "");
  let data: { access_token?: string } | null = null;

  try {
    data = raw ? (JSON.parse(raw) as { access_token?: string }) : null;
  } catch {
    data = null;
  }

  if (!response.ok || !data?.access_token) {
    const { issues, debugId } = extractPayPalIssues(raw);
    throw new PayPalApiError(response.status, ["AUTH_FAILED", ...issues], debugId);
  }

  return data.access_token;
}

export async function paypalRequest<T>(
  path: string,
  options: PayPalRequestOptions = {},
) {
  const accessToken = await getAccessToken();
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.requestId
        ? { "PayPal-Request-Id": options.requestId }
        : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
  });
  const raw = await response.text().catch(() => "");
  let data: T | null = null;

  try {
    data = raw ? (JSON.parse(raw) as T) : null;
  } catch {
    data = null;
  }

  if (!response.ok || !data) {
    const { issues, debugId } = extractPayPalIssues(raw);
    throw new PayPalApiError(response.status, issues, debugId);
  }

  return data;
}

export function getPayPalEnvironment() {
  return getEnvironment();
}
