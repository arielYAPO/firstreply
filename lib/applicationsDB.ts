import { createSupabaseBrowser } from "./supabaseBrowser";
import type { TrackedApplication } from "./applications";

type DbApplication = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  company: string | null;
  role: string | null;
  contract_type: string | null;
  location: string | null;
  match_score: number | null;
  score_breakdown: string | null;
  required_skills: string[] | null;
  candidate_strengths: string[] | null;
  candidate_weaknesses: string[] | null;
  status: string | null;
  next_action: string | null;
  next_follow_up_date: string | null;
  contact_to_find: string | null;
  suggested_angle: string | null;
  short_cover_letter: string | null;
  direct_email: string | null;
  linkedin_dm: string | null;
  follow_up_j3: string | null;
  follow_up_j7: string | null;
  linkedin_profiles_to_search: string[] | null;
  search_queries: string[] | null;
  likely_email_patterns: string[] | null;
  next_action_type: string | null;
  next_action_due_at: string | null;
  sent_at: string | null;
  followup_step: string | null;
  won_at: string | null;
  contact_name: string | null;
  contact_role: string | null;
  contact_domain: string | null;
};

function dbToApp(row: DbApplication): TrackedApplication {
  return {
    id: row.id,
    company: row.company ?? "",
    role: row.role ?? "",
    contractType: row.contract_type ?? "",
    location: row.location ?? "",
    matchScore: row.match_score ?? 0,
    scoreBreakdown: row.score_breakdown ?? "",
    requiredSkills: row.required_skills ?? [],
    candidateStrengths: row.candidate_strengths ?? [],
    candidateWeaknesses: row.candidate_weaknesses ?? [],
    status: (row.status as TrackedApplication["status"]) ?? "A contacter",
    nextAction: row.next_action ?? "",
    nextFollowUpDate: row.next_follow_up_date ?? "",
    contactToFind: row.contact_to_find ?? "",
    suggestedAngle: row.suggested_angle ?? "",
    shortCoverLetter: row.short_cover_letter ?? "",
    directEmail: row.direct_email ?? "",
    linkedInDM: row.linkedin_dm ?? "",
    followUpJ3: row.follow_up_j3 ?? "",
    followUpJ7: row.follow_up_j7 ?? "",
    linkedinProfilesToSearch: row.linkedin_profiles_to_search ?? [],
    searchQueries: row.search_queries ?? [],
    likelyEmailPatterns: row.likely_email_patterns ?? [],
    createdAt: row.created_at,
    nextActionType: (row.next_action_type as TrackedApplication["nextActionType"]) ?? undefined,
    nextActionDueAt: row.next_action_due_at ?? undefined,
    sentAt: row.sent_at ?? undefined,
    followupStep: (row.followup_step as TrackedApplication["followupStep"]) ?? undefined,
    wonAt: row.won_at ?? undefined,
    contactName: row.contact_name ?? undefined,
    contactRole: row.contact_role ?? undefined,
    contactDomain: row.contact_domain ?? undefined,
  };
}

function appToDb(app: TrackedApplication, userId: string) {
  return {
    id: app.id,
    user_id: userId,
    company: app.company || null,
    role: app.role || null,
    contract_type: app.contractType || null,
    location: app.location || null,
    match_score: app.matchScore || null,
    score_breakdown: app.scoreBreakdown || null,
    required_skills: app.requiredSkills ?? [],
    candidate_strengths: app.candidateStrengths ?? [],
    candidate_weaknesses: app.candidateWeaknesses ?? [],
    status: app.status || "A contacter",
    next_action: app.nextAction || null,
    next_follow_up_date: app.nextFollowUpDate || null,
    contact_to_find: app.contactToFind || null,
    suggested_angle: app.suggestedAngle || null,
    short_cover_letter: app.shortCoverLetter || null,
    direct_email: app.directEmail || null,
    linkedin_dm: app.linkedInDM || null,
    follow_up_j3: app.followUpJ3 || null,
    follow_up_j7: app.followUpJ7 || null,
    linkedin_profiles_to_search: app.linkedinProfilesToSearch ?? [],
    search_queries: app.searchQueries ?? [],
    likely_email_patterns: app.likelyEmailPatterns ?? [],
    next_action_type: app.nextActionType || null,
    next_action_due_at: app.nextActionDueAt || null,
    sent_at: app.sentAt || null,
    followup_step: app.followupStep || "none",
    won_at: app.wonAt || null,
    contact_name: app.contactName || null,
    contact_role: app.contactRole || null,
    contact_domain: app.contactDomain || null,
    updated_at: new Date().toISOString(),
  };
}

export async function fetchApplications(): Promise<TrackedApplication[]> {
  const supabase = createSupabaseBrowser();
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as DbApplication[]).map(dbToApp);
}

export async function upsertApplication(
  app: TrackedApplication,
  userId: string
): Promise<TrackedApplication | null> {
  const supabase = createSupabaseBrowser();
  const row = appToDb(app, userId);

  const { data, error } = await supabase
    .from("applications")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error || !data) return null;
  return dbToApp(data as DbApplication);
}

export async function updateApplication(
  appId: string,
  patch: Partial<TrackedApplication>
): Promise<boolean> {
  const supabase = createSupabaseBrowser();

  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.nextAction !== undefined) dbPatch.next_action = patch.nextAction;
  if (patch.nextFollowUpDate !== undefined) dbPatch.next_follow_up_date = patch.nextFollowUpDate;
  if (patch.nextActionType !== undefined) dbPatch.next_action_type = patch.nextActionType;
  if (patch.nextActionDueAt !== undefined) dbPatch.next_action_due_at = patch.nextActionDueAt || null;
  if (patch.sentAt !== undefined) dbPatch.sent_at = patch.sentAt || null;
  if (patch.followupStep !== undefined) dbPatch.followup_step = patch.followupStep;
  if (patch.wonAt !== undefined) dbPatch.won_at = patch.wonAt || null;
  if (patch.contactName !== undefined) dbPatch.contact_name = patch.contactName;
  if (patch.contactRole !== undefined) dbPatch.contact_role = patch.contactRole;
  if (patch.contactDomain !== undefined) dbPatch.contact_domain = patch.contactDomain;
  if (patch.directEmail !== undefined) dbPatch.direct_email = patch.directEmail;
  if (patch.linkedInDM !== undefined) dbPatch.linkedin_dm = patch.linkedInDM;
  if (patch.followUpJ3 !== undefined) dbPatch.follow_up_j3 = patch.followUpJ3;
  if (patch.followUpJ7 !== undefined) dbPatch.follow_up_j7 = patch.followUpJ7;

  const { error } = await supabase
    .from("applications")
    .update(dbPatch)
    .eq("id", appId);

  return !error;
}

export async function deleteApplication(appId: string): Promise<boolean> {
  const supabase = createSupabaseBrowser();
  const { error } = await supabase.from("applications").delete().eq("id", appId);
  return !error;
}
