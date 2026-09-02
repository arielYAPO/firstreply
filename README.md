# FirstReply

**Obtiens ta première réponse plus vite.**

FirstReply est une application web conçue pour les étudiants et jeunes diplômés qui cherchent un stage, une alternance ou un premier emploi.

L’objectif n’est pas d’envoyer davantage de candidatures génériques. FirstReply aide l’utilisateur à comprendre une offre, adapter son approche, identifier la bonne personne à contacter et relancer au bon moment.

> Trouve le bon contact. Génère le bon message. Relance au bon moment.

**Application en production :** [firstreply-gamma.vercel.app](https://firstreply-gamma.vercel.app)

## Ce que fait FirstReply

À partir du texte d’une offre et du CV ou profil du candidat, FirstReply prépare un dossier de candidature ciblé comprenant :

- une analyse de la correspondance entre l’offre et le profil ;
- un score de compatibilité expliqué critère par critère ;
- les points forts, les écarts et l’angle de candidature recommandé ;
- une lettre de motivation courte et personnalisée ;
- un email général de candidature ;
- les rôles pertinents à rechercher dans l’entreprise ;
- des requêtes de recherche pour trouver un contact sur LinkedIn ;
- après saisie d’un contact réel : un email direct, un message LinkedIn et deux relances à J+3 et J+7 ;
- une carte automatiquement ajoutée au tracker de candidatures.

FirstReply ne scrape pas LinkedIn et n’envoie pas de messages en masse. La recherche du contact et l’envoi restent sous le contrôle de l’utilisateur.

## Parcours utilisateur

1. L’utilisateur se connecte avec Google.
2. Un nouveau compte reçoit **3 crédits gratuits**.
3. Il colle une offre d’emploi et son CV, ou un résumé de son profil.
4. FirstReply analyse la candidature et crée son dossier complet.
5. Une analyse réussie consomme **1 crédit**.
6. L’utilisateur recherche un contact réel dans l’entreprise et renseigne son nom ainsi que le domaine de l’entreprise.
7. FirstReply génère l’approche directe et les relances personnalisées.
8. La candidature est suivie dans le tracker jusqu’à la réponse, au refus ou à l’entretien.

Une démonstration intégrée permet également de découvrir le résultat sans consommer de crédit et sans enregistrer de candidature.

## Crédits et paiement

- Essai : **3 analyses gratuites** à la création du compte.
- Coût : **1 crédit par analyse réussie**.
- Pack : **100 crédits pour 10 €**.
- Paiement unique, sans abonnement.
- Paiement traité avec PayPal Checkout.
- Les crédits sont attribués automatiquement après une capture PayPal confirmée.
- Une procédure de vérification manuelle reste disponible comme solution de secours.

L’attribution du paiement est idempotente : une même capture PayPal ne peut pas créditer deux fois le compte.

## Fonctionnalités principales

### Analyse de candidature

L’API compare les exigences explicites de l’offre avec les éléments réellement présents dans le profil. Elle évite d’inventer des compétences, des expériences ou des informations sur l’entreprise.

### Approche personnalisée

Après que l’utilisateur a trouvé un contact réel, FirstReply génère des messages distincts pour chaque canal :

- email direct ;
- message LinkedIn court ;
- relance J+3 ;
- relance J+7.

### Tracker

Chaque analyse réussie crée une candidature persistante dans Supabase. L’utilisateur peut :

- rechercher et filtrer ses candidatures ;
- faire évoluer leur statut ;
- voir la prochaine action recommandée ;
- suivre les candidatures envoyées, les relances, les refus et les entretiens ;
- supprimer une candidature.

### Onboarding

Le premier parcours explique le produit, affiche le coût avant l’analyse et guide l’utilisateur jusqu’à sa première candidature réussie. L’onboarding n’est considéré comme terminé qu’après une analyse effective.

### Notifications

Des webhooks Supabase et Resend permettent d’envoyer à l’administrateur des notifications lors :

- d’une nouvelle inscription ;
- d’une demande de vérification de paiement manuel.

## Stack technique

- [Next.js](https://nextjs.org/) avec App Router
- React et TypeScript
- Tailwind CSS
- [Supabase](https://supabase.com/) pour l’authentification, PostgreSQL, le Row Level Security et la persistance
- API OpenAI côté serveur pour l’analyse et la génération
- PayPal REST Checkout pour les paiements
- Resend pour les notifications email
- Vercel pour l’hébergement

## Architecture simplifiée

```text
Navigateur
  ├─ Auth Google ────────────────> Supabase Auth
  ├─ Dashboard / Tracker ────────> Supabase PostgreSQL + RLS
  ├─ Analyse offre + CV ─────────> API Next.js ──> OpenAI
  ├─ Messages pour le contact ───> API Next.js ──> OpenAI
  └─ Achat de crédits ───────────> API Next.js ──> PayPal
                                                └─> attribution atomique des crédits

Supabase Database Webhooks ──────> API Next.js ──> Resend ──> administrateur
```

Les clés OpenAI, PayPal, Resend et Supabase Service Role ne sont jamais exposées au navigateur.

## Routes importantes

| Route | Rôle |
| --- | --- |
| `/` | Landing page, connexion Google et accès historique par clé |
| `/dashboard` | Analyse, résultats, personnalisation du contact et tracker |
| `/buy` | Achat du pack de crédits |
| `/admin/payments` | Vérification administrative des paiements manuels |
| `/api/analyze-application` | Analyse de l’offre et génération du dossier |
| `/api/outreach` | Génération de l’email direct, du DM et des relances |
| `/api/paypal/*` | Création, capture et contrôle des paiements PayPal |
| `/api/webhooks/signup` | Notification d’une nouvelle inscription |
| `/api/webhooks/payment-request` | Notification d’une demande de vérification |

## Installation locale

### Prérequis

- Node.js 20 ou supérieur ;
- un projet Supabase ;
- une clé API OpenAI ;
- une application PayPal REST en mode Sandbox pour tester le paiement ;
- un compte Resend si les notifications email sont activées.

### 1. Installer le projet

```bash
git clone https://github.com/arielYAPO/firstreply.git
cd firstreply
npm install
```

### 2. Configurer l’environnement

Copier `.env.example` vers `.env.local`, puis renseigner les variables nécessaires :

```bash
cp .env.example .env.local
```

| Variable | Utilisation |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL publique du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase utilisée avec le RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Opérations serveur privilégiées — ne jamais exposer au client |
| `OPENAI_API_KEY` | Analyse et génération des contenus |
| `OPENAI_MODEL` | Modèle optionnel ; `gpt-5-nano` par défaut |
| `PAYPAL_ENV` | `sandbox` pour les tests, `live` pour les paiements réels |
| `PAYPAL_CLIENT_ID` | Identifiant de l’application PayPal REST |
| `PAYPAL_CLIENT_SECRET` | Secret PayPal, utilisé uniquement côté serveur |
| `RESEND_API_KEY` | Envoi des notifications email |
| `SIGNUP_WEBHOOK_SECRET` | Secret partagé avec les webhooks Supabase |
| `ADMIN_NOTIFICATION_EMAIL` | Adresse qui reçoit les notifications |
| `RESEND_FROM_EMAIL` | Expéditeur Resend ; domaine vérifié recommandé |
| `RESEND_REPLY_TO_EMAIL` | Adresse de réponse facultative |
| `ADMIN_SECRET` | Protection des routes d’administration |

Ne jamais committer `.env.local` ni afficher les secrets dans les logs.

### 3. Préparer Supabase

Exécuter les fichiers SQL dans l’ordre :

1. `supabase/schema.sql` — ancien système de clés d’accès encore compatible ;
2. `supabase/migration_v2.sql` — comptes, crédits, paiements et tracker ;
3. `supabase/migration_v3_payment_requests.sql` ;
4. `supabase/migration_v4_payment_notifications.sql` ;
5. `supabase/migration_v5_automatic_trial_credits.sql` ;
6. `supabase/migration_v6_paypal_checkout.sql` ;
7. `supabase/migration_v7_trial_credits_3.sql` — fixe l’essai actuel à 3 crédits.

Activer ensuite Google dans **Supabase Authentication > Providers** et ajouter les URL de redirection locale et de production vers `/auth/callback`.

Les tables utilisateur sont protégées par des politiques RLS : un utilisateur ne peut consulter et modifier que ses propres données.

### 4. Configurer PayPal

Créer une application REST **Sandbox Merchant**, puis renseigner :

```env
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
```

En Sandbox, aucun argent réel n’est débité. Passer à `PAYPAL_ENV=live` uniquement avec les identifiants Live correspondants.

### 5. Lancer l’application

```bash
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

## Vérifications avant déploiement

```bash
npm run build
npm start
```

Parcours minimum à contrôler :

1. connexion Google ;
2. attribution de 3 crédits à un nouveau compte ;
3. analyse d’une offre et consommation d’un seul crédit ;
4. présence de la candidature dans le tracker ;
5. génération des messages après saisie d’un contact ;
6. paiement PayPal Sandbox et attribution unique de 100 crédits ;
7. refus des webhooks appelés sans `x-webhook-secret` valide ;
8. affichage mobile sans débordement horizontal.

## Structure du projet

```text
app/
  api/                    Routes serveur : IA, paiement, webhooks et admin
  auth/callback/          Retour OAuth Supabase
  dashboard/              Espace principal
  buy/                    Achat de crédits
components/               Interface, onboarding, analyse et tracker
lib/                      Supabase, PayPal, session et logique métier
supabase/                 Schéma et migrations SQL
```

## Périmètre et principes

FirstReply est un outil d’aide à la candidature, pas un job board ni un bot de prospection.

- aucune promesse d’emploi ou de réponse garantie ;
- aucun scraping automatisé ;
- aucun envoi massif de messages ;
- aucune invention de faits sur le candidat, le contact ou l’entreprise ;
- l’utilisateur relit et envoie lui-même chaque message.

Le produit privilégie une candidature mieux ciblée et une relance utile plutôt qu’un volume de candidatures plus élevé.
