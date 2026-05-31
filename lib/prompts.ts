type PromptInput = {
  company: string;
  role: string;
  recruiter?: string;
  background: string;
  reason?: string;
  tone?: string;
};

export function buildOutreachPrompt(input: PromptInput) {
  return `
Génère un pack FirstReply pour contacter une entreprise.

Contexte:
- Entreprise: ${input.company}
- Poste/stage visé: ${input.role}
- Recruteur/contact: ${input.recruiter || "non renseigné"}
- Profil étudiant: ${input.background}
- Raison d'intérêt: ${input.reason || "non renseignée"}
- Ton souhaité: ${input.tone || "direct, pro, humain"}

Règles:
- Pas de fausse expérience.
- Pas de lettre de motivation longue.
- Pas de ton robotique.
- Pas de promesse exagérée.
- Français naturel.
- Court, concret, humain.

Retourne exactement ce format:

## Email d'approche
[80-130 mots]

## DM LinkedIn
[moins de 500 caractères]

## Relance J+3
[message court]

## Relance J+7
[message court]

## Conseil tactique
[1 conseil concret pour augmenter les chances de réponse]
`;
}
