"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  APPLICATIONS_STORAGE_KEY,
  type ApplicationStatus,
  type TrackedApplication,
} from "@/lib/applications";

/**
 * Temporary page — visit /seed-tracker to populate the real dashboard
 * with the 100 demo applications. Delete this route before production.
 */

/* ── Data pools (same as demo-tracker) ── */

const COMPANIES = [
  "Mistral AI","Hugging Face","LightOn","Dust","Poolside AI","Kyutai","Nabla","Giskard","Pollen Robotics",
  "Dataiku","Contentsquare","Criteo","Algolia","Alan","Doctolib","Qonto","PayFit","Spendesk","Pennylane",
  "Pigment","Ankorstore","Back Market","Mirakl","Swile","Ledger","Yousign","Sézane Tech",
  "BNP Paribas CIB","Société Générale","AXA Data Innovation","Renault Software Labs","L'Oréal Research",
  "Airbus Defence & Space","Thales DIS","Safran Analytics","Stellantis Digital","TotalEnergies Digital",
  "Orange Innovation","SNCF Réseau","EDF Lab","Dassault Systèmes","Capgemini Invent","Sopra Steria Next",
  "Preligens","Shift Technology","Craft AI","Heuritech","Zelros","Descartes Underwriting","InstaDeep",
  "Lunit","Joko","Alma","Legalstart","ManoMano","Meero","Platform.sh","Scaleway","CleverCloud","OVHcloud",
  "Meilisearch","Deepki","Kayrros","Carbonfact","Greenly","Believe","Lemonade","Treatwell","PhotoRoom",
  "Pretto","Lydia","Heetch","Getaround","BlaBlaCar","Vestiaire Collective","Veepee","Deezer","Ubisoft",
  "Voodoo","Sorare","Ledgity","Artefact","Ekimetrics","Quantmetry","Sia Partners","eleven strategy",
  "McKinsey QuantumBlack","BCG Gamma","Wavestone","Devoteam","Xebia","Octo Technology","Theodo","Sicara","Stack Labs",
];

const ROLES = [
  "AI Engineer — LLM & RAG","ML Engineer Intern","Data Scientist — Alternance","Data Engineer — Alternance",
  "NLP Research Intern","MLOps Engineer — Alternance","Computer Vision Intern","Software Engineer — AI Platform",
  "Backend Engineer Python","Data Analyst — Alternance","Applied Scientist Intern","ML Infrastructure Intern",
  "Prompt Engineer — Stage","Recherche & Développement IA","Deep Learning Intern","Fullstack Engineer — Data Tools",
  "Platform Engineer — ML Serving","Data Engineer — ETL & dbt","DevOps / MLOps — Alternance","Quantitative Analyst Intern",
];

const LOCATIONS = [
  "Paris 2e","Paris 8e","Paris 9e","Paris 11e","Paris 13e","La Défense","Boulogne-Billancourt",
  "Issy-les-Moulineaux","Montrouge","Saint-Denis","Clichy","Lyon 3e","Remote","Hybride — Paris","Hybride — Lyon",
];

const CONTRACTS = [
  "Alternance 24 mois","Alternance 12 mois","Stage 6 mois","Stage fin d'études","CDI junior","Graduate program",
];

const ANGLES = [
  "Tu as un profil technique solide. Mets en avant tes projets concrets dès la première ligne.",
  "Ton parcours montre une vraie progression. Insiste sur ta capacité à monter en compétence rapidement.",
  "Tu coches les fondamentaux. L'angle, c'est de montrer que tu connais déjà leur stack.",
  "Ton profil est atypique, et c'est un atout. Joue la carte de la diversité de compétences.",
  "Tu as l'expérience projet qui manque à beaucoup de candidats. Mets ça en avant.",
];

const STRENGTHS_POOL = [
  "Maîtrise de Python et des frameworks ML","Expérience en production avec des modèles NLP",
  "Projets personnels démontrant l'autonomie","Formation technique solide et récente",
  "Connaissance de l'écosystème cloud (AWS/GCP)","Expérience en pipeline de données",
  "Capacité démontrée à travailler en équipe","Stage pertinent dans le secteur",
  "Bonne compréhension des enjeux business","Maîtrise de Git et des pratiques DevOps",
];

const WEAKNESSES_POOL = [
  "Ils cherchent une expérience en prod — tu peux compenser avec tes projets perso déployés.",
  "Pas d'expérience directe dans leur secteur — mets en avant ta capacité d'adaptation.",
  "Ils demandent du Kubernetes — montre que tu apprends vite avec un exemple concret.",
  "Le niveau d'anglais n'est pas démontré — mentionne un projet ou une lecture en anglais.",
  "Manque d'expérience en gestion de projet — parle de tes projets de groupe.",
];

/* ── Status mapping: demo → real ── */

type DemoStatus = "Refusé" | "Ghosté" | "À relancer" | "En attente" | "Entretien" | "Offre reçue";

function mapStatus(demoStatus: DemoStatus): ApplicationStatus {
  const map: Record<DemoStatus, ApplicationStatus> = {
    "Refusé": "Refus",
    "Ghosté": "No response",
    "À relancer": "Relance J+3",
    "En attente": "Message envoye",
    "Entretien": "Entretien",
    "Offre reçue": "Won",
  };
  return map[demoStatus];
}

function getDemoStatus(index: number): DemoStatus {
  if (index < 62) return "Refusé";
  if (index < 78) return "Ghosté";
  if (index < 86) return "À relancer";
  if (index < 92) return "En attente";
  if (index < 96) return "Entretien";
  return (["Ghosté", "Refusé", "Refusé", "Refusé"] as DemoStatus[])[index - 96];
}

function getDemoScore(index: number, role: string, status: DemoStatus) {
  if (status === "Refusé") return [24, 31, 42, 56, 61, 68][index % 6];
  if (status === "Ghosté") return [52, 64, 71, 76, 83, 88][index % 6];
  if (status === "À relancer") return [55, 67, 72, 78, 82, 86][index % 6];
  if (status === "Offre reçue") return [86, 91, 94][index % 3];
  if (status === "Entretien") return [72, 79, 84, 89, 67, 81][index % 6];
  const isTech = /AI|Data|ML|Engineer|Developer|Cloud|DevOps/i.test(role);
  if (isTech) return [66, 73, 78, 82, 87][index % 5];
  return [35, 44, 58, 62, 69][index % 5];
}

function getNextAction(status: ApplicationStatus): string {
  const actions: Record<string, string> = {
    "A contacter": "Chercher le bon contact et envoyer la candidature.",
    "Message envoye": "Attendre une réponse, relancer dans 3 jours si silence.",
    "Relance J+3": "Envoyer la relance J+3.",
    "Relance J+7": "Envoyer la dernière relance J+7.",
    "Reponse recue": "Répondre au message reçu.",
    "Entretien": "Préparer l'entretien.",
    "Refus": "Passer à la prochaine candidature.",
    "Archive": "Terminé.",
    "Won": "Candidature décrochée !",
    "No response": "Aucune réponse — passer à la suite.",
  };
  return actions[status] ?? "";
}

function getActionType(status: ApplicationStatus): TrackedApplication["nextActionType"] {
  const map: Partial<Record<ApplicationStatus, TrackedApplication["nextActionType"]>> = {
    "A contacter": "send_application",
    "Message envoye": "followup_j3",
    "Relance J+3": "followup_j3",
    "Relance J+7": "followup_j7",
    "Entretien": "interview_prep",
  };
  return map[status] ?? "none";
}

function buildTrackedApplication(index: number): TrackedApplication {
  const demoStatus = getDemoStatus(index);
  const role = ROLES[(index * 7) % ROLES.length];
  const company = COMPANIES[(index * 11) % COMPANIES.length];
  const contract = CONTRACTS[(index * 5) % CONTRACTS.length];
  const location = LOCATIONS[(index * 13) % LOCATIONS.length];
  const score = getDemoScore(index, role, demoStatus);
  const status = mapStatus(demoStatus);

  const createdDate = new Date();
  createdDate.setDate(createdDate.getDate() - Math.floor(index * 1.2 + 5));

  const sentDate = new Date(createdDate);
  sentDate.setDate(sentDate.getDate() + 1);

  const isSent = ["Message envoye", "Relance J+3", "Relance J+7", "Entretien", "Refus", "Won", "No response"].includes(status);

  return {
    id: `seed-${index + 1}`,
    company,
    role,
    contractType: contract,
    location,
    matchScore: score,
    scoreBreakdown: `${score}/100 — évaluation basée sur ${4 + (index % 4)} critères.`,
    requiredSkills: [
      ROLES[(index * 3) % ROLES.length].split("—")[0].trim(),
      "Python",
      index % 2 === 0 ? "SQL" : "Docker",
    ],
    candidateStrengths: [
      STRENGTHS_POOL[index % STRENGTHS_POOL.length],
      STRENGTHS_POOL[(index + 3) % STRENGTHS_POOL.length],
      STRENGTHS_POOL[(index + 6) % STRENGTHS_POOL.length],
    ],
    candidateWeaknesses: [
      WEAKNESSES_POOL[index % WEAKNESSES_POOL.length],
      WEAKNESSES_POOL[(index + 2) % WEAKNESSES_POOL.length],
    ],
    status,
    nextAction: getNextAction(status),
    nextFollowUpDate: "",
    contactToFind: "Talent Acquisition, Engineering Manager",
    suggestedAngle: ANGLES[index % ANGLES.length],
    shortCoverLetter: `Madame, Monsieur,\n\nJe candidate au poste de ${role} chez ${company}. [Contenu généré par l'analyse IA — lancer l'analyse pour personnaliser.]`,
    directEmail: `Objet : Candidature ${role} — ${company}\n\n[Contenu généré par l'analyse IA.]`,
    linkedInDM: "",
    followUpJ3: "",
    followUpJ7: "",
    linkedinProfilesToSearch: ["Talent Acquisition", "Engineering Manager", "CTO"],
    searchQueries: [
      `${company} recrutement LinkedIn`,
      `${company} ${role.split("—")[0].trim()} LinkedIn`,
    ],
    likelyEmailPatterns: ["prenom.nom@domaine", "p.nom@domaine"],
    createdAt: createdDate.toISOString(),
    nextActionType: getActionType(status),
    sentAt: isSent ? sentDate.toISOString() : undefined,
    followupStep: status === "Relance J+3" ? "j3" : status === "Relance J+7" ? "j7" : isSent ? "none" : undefined,
    wonAt: status === "Won" ? new Date().toISOString() : undefined,
  };
}

/* ── Hero application (Dust) ── */

const HERO_APPLICATION: TrackedApplication = {
  id: "seed-hero-dust",
  company: "Dust",
  role: "Software Engineer — AI Platform",
  contractType: "Alternance 24 mois",
  location: "Paris",
  matchScore: 72,
  scoreBreakdown: "72/100 — évaluation basée sur 6 critères : 3 oui, 2 partiel, 1 non.",
  requiredSkills: ["TypeScript", "React", "LLM APIs", "Python", "SQL", "Autonomie"],
  candidateStrengths: [
    "Maîtrise de TypeScript et React démontrée par des projets",
    "Bonne compréhension des APIs LLM",
    "Capacité d'apprentissage rapide prouvée par le parcours",
  ],
  candidateWeaknesses: [
    "Ils cherchent de l'expérience en production — mets en avant tes déploiements perso.",
    "Pas encore d'expérience directe avec leur stack — montre que tu apprends vite.",
  ],
  status: "Entretien",
  nextAction: "Préparer l'entretien technique avec Dust.",
  nextFollowUpDate: "",
  contactToFind: "CTO, Engineering Manager",
  suggestedAngle: "Dust construit des outils d'IA pour les entreprises. Tu as exactement le profil technique qu'ils cherchent pour leur équipe plateforme. Mets en avant tes projets avec des LLMs.",
  shortCoverLetter: "Madame, Monsieur,\n\nJe candidate au poste de Software Engineer — AI Platform chez Dust.",
  directEmail: "Objet : Candidature Software Engineer — AI Platform\n\nBonjour, je candidate au poste...",
  linkedInDM: "",
  followUpJ3: "",
  followUpJ7: "",
  linkedinProfilesToSearch: ["CTO", "VP Engineering", "Engineering Manager"],
  searchQueries: ["Dust AI engineering LinkedIn", "Dust CTO LinkedIn"],
  likelyEmailPatterns: ["prenom@dust.tt", "prenom.nom@dust.tt"],
  createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  nextActionType: "interview_prep",
  sentAt: new Date(Date.now() - 28 * 86400000).toISOString(),
  followupStep: "done",
};

/* ── Page component ── */

export default function SeedTrackerPage() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const applications: TrackedApplication[] = [
      HERO_APPLICATION,
      ...Array.from({ length: 99 }, (_, i) => buildTrackedApplication(i)),
    ];

    localStorage.setItem(APPLICATIONS_STORAGE_KEY, JSON.stringify(applications));
    setCount(applications.length);
    setDone(true);

    const timer = window.setTimeout(() => {
      router.push("/dashboard");
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f5f7f3] px-6 text-center">
      <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#0d9488]">
        FirstReply
      </p>
      {done ? (
        <>
          <h1 className="text-2xl font-black tracking-[-0.03em] text-slate-950">
            {count} candidatures importées
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Redirection vers le dashboard...
          </p>
        </>
      ) : (
        <h1 className="text-2xl font-black tracking-[-0.03em] text-slate-950">
          Import en cours...
        </h1>
      )}
    </main>
  );
}
