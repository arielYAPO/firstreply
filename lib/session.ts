export type FirstReplySession = {
  key: string;
  creditsLimit: number;
  creditsUsed: number;
  creditsRemaining: number;
};

export const SESSION_UPDATED_EVENT = "firstreply:session-updated";

const STORAGE_KEY = "firstreply_session";

export function saveSession(session: FirstReplySession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(
    new CustomEvent(SESSION_UPDATED_EVENT, { detail: session })
  );
}

export function loadSession(): FirstReplySession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as FirstReplySession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
