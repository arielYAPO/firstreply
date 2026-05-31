export const APPLICATIONS_STORAGE_KEY = "firstreply_applications";
export const APPLICATIONS_UPDATED_EVENT = "firstreply:applications-updated";
export const WORKFLOW_STATE_EVENT = "firstreply:workflow-state";

export type WorkflowState = "prepare" | "analyze" | "send" | "follow";

export const APPLICATION_STATUSES = [
  "A contacter",
  "Message envoye",
  "Relance J+3",
  "Relance J+7",
  "Reponse recue",
  "Entretien",
  "Refus",
  "Archive",
  "Won",
  "No response",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type TrackedApplication = {
  id: string;
  company: string;
  role: string;
  contractType: string;
  location: string;
  matchScore: number;
  scoreBreakdown: string;
  requiredSkills: string[];
  candidateStrengths: string[];
  candidateWeaknesses: string[];
  status: ApplicationStatus;
  nextAction: string;
  nextFollowUpDate: string;
  contactToFind: string;
  suggestedAngle: string;
  shortCoverLetter: string;
  directEmail: string;
  linkedInDM: string;
  followUpJ3: string;
  followUpJ7: string;
  linkedinProfilesToSearch: string[];
  searchQueries: string[];
  likelyEmailPatterns: string[];
  createdAt: string;
  nextActionType?:
    | "send_application"
    | "followup_j3"
    | "followup_j7"
    | "interview_prep"
    | "none";
  nextActionDueAt?: string;
  sentAt?: string;
  followupStep?: "none" | "j3" | "j7" | "done";
  wonAt?: string;
  contactName?: string;
  contactRole?: string;
  contactDomain?: string;
};
