# Contexte FirstReply

## Resume Executif

FirstReply est un SaaS early-stage pour etudiants, alternants, jeunes diplomes et profils juniors francophones qui veulent obtenir plus de reponses a leurs candidatures.

Le produit transforme une offre d'emploi et un CV/profil candidat en un plan de candidature actionnable :

- score de correspondance offre/profil ;
- criteres extraits de l'offre ;
- evaluation du candidat sur chaque critere ;
- forces et points a adresser ;
- angle d'approche recommande ;
- lettre de motivation courte ;
- email de candidature general ;
- roles de contacts a chercher ;
- requetes LinkedIn/Google ;
- formats d'emails probables apres saisie manuelle d'un contact et d'un domaine ;
- email direct personnalise, DM LinkedIn et relances J+3/J+7 ;
- tracker dynamique et persistant des candidatures.

Promesse centrale :

> Obtiens ta premiere reponse plus vite.

FirstReply n'est pas un job board et ne promet pas un emploi. C'est un systeme tactique pour arreter d'envoyer des candidatures dans le vide.

---

## Produit

### Positionnement

FirstReply est un copilote de candidature pour etudiants et profils juniors.

Formule simple :

> Colle une offre et ton profil. FirstReply prepare ta candidature, t'aide a trouver le bon contact et te rappelle quand relancer.

Le produit doit etre percu comme : concret, tactique, credible, rapide a utiliser, oriente action et utile pendant une periode de recherche intense.

Il ne doit pas etre percu comme un generateur de lettres generique, un outil magique qui garantit un job, un outil de spam, un scraper LinkedIn, un ATS checker classique ou un coach carriere long et theorique.

---

## Utilisation du Produit

### Parcours Principal

1. L'utilisateur arrive sur la landing page.
2. Il se connecte avec Google ou utilise un code d'acces legacy.
3. S'il n'a pas de credits, il est invite a acheter le pack FirstReply.
4. Il colle une offre d'emploi complete.
5. Il colle son CV, son profil LinkedIn ou un resume de son parcours.
6. FirstReply analyse l'offre et le profil.
7. Le produit genere le dossier de candidature.
8. La candidature est ajoutee au tracker.
9. L'utilisateur cherche un contact recommande.
10. Il entre un nom complet et le domaine de l'entreprise.
11. FirstReply genere les formats d'emails probables et l'approche personnalisee.
12. L'utilisateur suit ses relances et statuts dans le tracker.

### Analyse de Candidature

L'analyse produit : entreprise, poste, type de contrat, localisation, score de correspondance, criteres extraits de l'offre, evaluation par critere, forces du candidat, faiblesses actionnables, angle d'approche, lettre de motivation courte, email de candidature general, roles a chercher et requetes de recherche.

### Etape Contact

FirstReply ne doit jamais pretendre trouver un email verifie.

Workflow correct :

1. FirstReply indique qui chercher.
2. L'utilisateur trouve une vraie personne.
3. L'utilisateur saisit le nom complet du contact.
4. L'utilisateur saisit manuellement le domaine de l'entreprise.
5. FirstReply genere des formats d'emails probables.
6. FirstReply genere l'email direct, le DM LinkedIn et deux relances.

Message produit a garder :

> FirstReply t'aide a identifier qui chercher, puis a generer les formats d'emails probables.

Messages a eviter :

- "FirstReply trouve l'email."
- "Email verifie."
- "Contact garanti."
- "Candidature automatique."
- "Postule automatiquement."

---

## Persona

### Persona Principal

Etudiants et jeunes profils francophones qui cherchent un stage, une alternance, un premier CDI junior ou un poste d'entree de carriere.

### Profil Type

- 18 a 27 ans.
- Ecole de commerce, ecole d'ingenieur, universite, BTS, BUT, licence, master ou formation specialisee.
- Utilise LinkedIn, Welcome to the Jungle, Indeed, sites carrieres et candidatures spontanees.
- A un CV correct mais ne sait pas toujours quoi mettre en avant.
- Envoie beaucoup de candidatures et recoit peu de reponses.
- A besoin d'un systeme concret, pas d'un coaching abstrait.

### Douleurs

- "Je postule mais personne ne repond."
- "Je ne sais pas quoi ecrire."
- "Je ne sais pas qui contacter."
- "Je ne sais pas si mon profil colle a l'offre."
- "J'oublie de relancer."
- "J'ai l'impression d'envoyer dans le vide."
- "Je perds confiance apres trop de refus."

---

## Value Proposition

FirstReply aide l'utilisateur a comprendre rapidement son niveau de match avec une offre, envoyer une candidature plus ciblee, eviter les lettres generiques, savoir quel angle mettre en avant, identifier les bons contacts a chercher, relancer au bon moment et garder une vision claire de toutes ses candidatures.

Differenciation : ce n'est pas seulement une lettre de motivation, pas seulement un tracker et pas seulement ChatGPT dans une interface. C'est un workflow complet : offre + profil -> plan -> messages -> contact -> relances -> suivi.

---

## Modele Economique

### Offre Actuelle

Pack FirstReply :

- prix : 10 EUR ;
- contenu : 100 credits ;
- logique : 1 credit = 1 analyse reussie ;
- paiement unique ;
- aucun abonnement.

La page d'achat presente :

- "Debloque ton pack FirstReply" ;
- "Paiement unique - pas d'abonnement" ;
- "10 EUR" ;
- "100 credits" ;
- "100 analyses" ;
- "1 credit consomme par analyse reussie".

### Paiement

Le paiement actuel est un flow beta manuel avec PayPal :

1. L'utilisateur clique pour acheter le pack.
2. L'app cree une demande de paiement `payment_requests`.
3. L'utilisateur est redirige vers PayPal.Me.
4. Le paiement est verifie manuellement cote admin.
5. L'admin valide la demande.
6. L'utilisateur recoit 100 credits.

Important : PayPal.Me peut pre-remplir le montant, mais l'utilisateur peut le modifier. L'admin doit verifier manuellement que le paiement recu est exactement 10 EUR avant d'accorder les credits.

### Logique de Credits

- Les utilisateurs connectes avec Google ont un solde dans `credit_balances`.
- Les anciens codes d'acces restent supportes en fallback.
- Une analyse reussie consomme exactement 1 credit.
- Un echec d'analyse ne doit pas consommer de credit.
- L'outreach apres contact ne consomme pas de credit additionnel dans la logique actuelle.

---

## Fonctionnalites Actuelles

### Deja Implemente

- Landing page FirstReply.
- Connexion Google via Supabase Auth.
- Fallback code d'acces legacy.
- AuthProvider global.
- Page dashboard.
- Page achat `/buy`.
- Flow PayPal.Me manuel.
- Table `payment_requests`.
- Endpoints admin de validation paiement.
- Solde credits par utilisateur.
- Analyse OpenAI cote serveur.
- Scoring deterministe base sur criteres.
- Cache d'analyse pour eviter de repayer le meme run.
- Metadata de scoring pour observabilite.
- Generation de contenu de candidature.
- Tracker persistant en base Supabase pour utilisateurs authentifies.
- Fallback localStorage pour anciens codes d'acces.
- Actions de tracker : envoyer, relancer J+3, relancer J+7, archiver, supprimer, marquer gagne.
- Etape contact trouve.
- Validation nom complet.
- Validation domaine manuel.
- Formats d'emails probables generes en code.
- Outreach personnalise via `/api/outreach`.
- Demo marketing `/demo-tracker`.
- Page utilitaire `/seed-tracker` pour injecter des donnees demo locales.
- Script `scripts/test-reproducibility.ts` pour tester stabilite/cache/scoring.

### A Verifier / Durcir

- Verifier que les migrations Supabase v2/v3 sont bien appliquees en production.
- Verifier que le tracker persistant fonctionne sur plusieurs appareils pour le meme compte.
- Remplacer ou retirer les vieux composants legacy si inutilises.
- Nettoyer les routes de demo avant une mise en production publique.
- Eviter que `ADMIN_SECRET` ait une valeur par defaut en production.
- Documenter le process admin PayPal pour ne pas valider un paiement incorrect.
- Clarifier dans l'UI la difference entre email probable et email verifie.

---

## Architecture Produit Actuelle

### Stack

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Supabase Auth.
- Supabase Database.
- OpenAI cote serveur.
- PayPal.Me pour paiement beta manuel.

### Tables Supabase Principales

Ancien systeme :

- `access_keys` : codes d'acces legacy, limites et usage credits.
- `generations` : generations IA, cache, metadata scoring.

Nouveau systeme auth :

- `profiles` : profil utilisateur cree apres login Google.
- `credit_balances` : solde de credits par utilisateur.
- `applications` : tracker persistant des candidatures.
- `payment_requests` : demandes de paiement PayPal manuel.
- `payments` : ancienne table payment prevue dans migration v2, moins centrale que `payment_requests`.

### Routes Importantes

- `/` : landing page + connexion Google + acces legacy.
- `/dashboard` : workspace FirstReply.
- `/buy` : achat du pack 10 EUR / 100 credits.
- `/demo-tracker` : demo marketing hardcodee pour videos.
- `/seed-tracker` : outil temporaire de seed local.

API :

- `/api/access` : validation code d'acces legacy.
- `/api/analyze-application` : analyse offre/profil, scoring, contenu, credit.
- `/api/outreach` : approche personnalisee apres contact trouve.
- `/api/paypal/create-order` : creation de demande de paiement.
- `/api/paypal/capture-order` : verification du statut de demande.
- `/api/admin/pending-payments` : liste admin des demandes.
- `/api/admin/validate-payment` : validation admin et ajout de 100 credits.

---

## Tracker

### Role

Le tracker doit repondre a :

> Qu'est-ce que je dois faire maintenant ?

Chaque candidature doit montrer : entreprise, poste, score, statut, prochaine action, date/urgence de relance, messages generes, contact si disponible et historique d'avancement implicite.

### Statuts Produit

Statuts utilises dans le tracker reel :

- A contacter ;
- Message envoye ;
- Relance J+3 ;
- Relance J+7 ;
- Reponse recue ;
- Entretien ;
- Refus ;
- Archive ;
- Won ;
- No response.

### Transitions Produit

- `A contacter` -> marquer envoye -> prochaine action J+3.
- `Relance J+3` -> relance envoyee -> prochaine action J+7.
- `Relance J+7` -> relance envoyee -> archive/no response.
- `Won` -> celebration et candidature decrochee.

---

## Intelligence Artificielle

### Analyse

La route d'analyse doit valider l'utilisateur ou le code d'acces, verifier les credits, refuser une offre ou un profil vide, extraire/evaluer les criteres, calculer le score deterministe, generer le contenu final, sauvegarder la generation et consommer 1 credit uniquement apres succes.

### Scoring

Score deterministe :

- oui = 3 ;
- partiel = 1 ;
- non = 0 ;
- indispensable = poids 2 ;
- souhaite = poids 1 ;
- score = round((total / maxTotal) * 100).

Le but est de reduire la variance des scores et d'eviter les 100/100 trop faciles.

### Observabilite

Les generations peuvent stocker : hash offre/profil, nombre de criteres, nombre de oui/partiel/non, score calcule, evaluation JSON, criteria JSON, modeles utilises, temperatures, durees, estimations tokens/cout si disponibles.

---

## Marketing

### Direction TikTok / Reels / Shorts

Une direction forte existe autour du tracker : montrer beaucoup de candidatures, montrer les refus, montrer les ghostings, montrer l'organisation, faire passer une carte vers "Offre recue" ou "Job obtenu", puis declencher une celebration.

Angle emotionnel :

> La guerre est finie.

Sequence possible :

1. "La guerre est finie."
2. "Elle a dit OUI."
3. "Non... tu nous quittes deja ?"
4. "Bravo. Va signer ton contrat."

### Message Marketing

FirstReply ne vend pas une IA magique. FirstReply vend de la clarte dans une periode de stress.

Angles utiles :

- "La galere, mais rangee proprement."
- "Chaque candidature devient une prochaine action."
- "Arrete d'envoyer dans le vide."
- "Trouve le bon contact. Envoie le bon message. Relance au bon moment."

---

## Concurrence et Alternatives

Alternatives principales : ChatGPT utilise manuellement, generateurs de lettres de motivation, Notion ou Google Sheets pour tracker, Huntr, Teal, Simplify, LinkedIn Premium, modeles Notion de recherche d'emploi, coachs carriere etudiants, resume/ATS checkers.

Difference FirstReply : francophone, cible etudiants/juniors, combine analyse/messages/contacts/tracker, prix simple et accessible, workflow plus concret qu'un prompt ChatGPT, moins lourd qu'un CRM ou un outil RH.

---

## Objectifs Growth

### Objectifs Court Terme

- Valider que la promesse est comprise en moins de 5 secondes.
- Obtenir les premiers utilisateurs payants ou beta.
- Mesurer combien d'analyses sont lancees par utilisateur.
- Voir si les utilisateurs reviennent dans le tracker.
- Tester si le pack 10 EUR / 100 credits est percu comme evident.
- Obtenir des retours qualitatifs sur les messages generes.
- Tester une boucle TikTok -> landing -> Google login -> achat.

### Metriques a Suivre

- visiteurs landing ;
- clics "Commencer avec Google" ;
- utilisateurs connectes ;
- utilisateurs avec 0 credit qui voient `/buy` ;
- demandes de paiement creees ;
- paiements valides ;
- credits consommes ;
- analyses par utilisateur ;
- candidatures creees ;
- retours au tracker ;
- contacts saisis ;
- outreach generes ;
- candidatures marquees `Won` ;
- utilisateurs qui declarent avoir recu une reponse.

---

## Style de Communication

FirstReply parle comme un allie tactique : direct, utile, concret, un peu emotionnel, credible, francais naturel, pas corporate et pas fake guru.

Phrases utiles :

- "Obtiens ta premiere reponse plus vite."
- "Arrete d'envoyer dans le vide."
- "Colle l'offre. Colle ton profil. On prepare le plan."
- "Trouve le bon contact. Envoie le bon message. Relance au bon moment."
- "La galere, mais rangee proprement."
- "Chaque candidature devient une prochaine action claire."

Phrases a eviter :

- "On garantit ton stage."
- "On trouve l'email du recruteur."
- "Email verifie."
- "Candidature automatique."
- "Spam intelligent."
- "Hack LinkedIn ultime."
- "Taux de reponse garanti."

---

## Contraintes Produit et Ethiques

FirstReply doit rester propre : pas de scraping, pas d'envoi automatique massif, pas de promesse de resultat garanti, pas d'email presente comme verifie, pas d'invention d'experience candidat, pas d'exposition de cle API cote client et pas de manipulation abusive des recruteurs.

Le produit aide a mieux candidater. Il ne doit pas aider a spammer.

---

## Risques Actuels

### Risques Produit

- Confusion entre ancien flow code d'acces et nouveau flow Google Auth.
- Paiement PayPal manuel plus lent qu'un checkout automatise.
- Validation admin sensible aux erreurs si le process n'est pas documente.
- Demo routes a ne pas confondre avec le produit reel.
- Messages IA a surveiller pour eviter hallucinations ou ton trop generique.
- Scores a continuer de calibrer sur des cas reels.

### Risques Marketing

- Le produit peut etre percu comme un simple generateur de lettre.
- Le marche etudiant est sensible au prix.
- Les promesses trop fortes peuvent reduire la confiance.
- Les videos doivent montrer le probleme en 2 secondes, sinon le message se perd.

---

## Recommandations Strategiques

### Priorite 1 : Verifier le Nouveau Flow Auth + Paiement

Le flow a evolue vers : Google Auth -> credit balance -> pack 10 EUR -> validation PayPal -> dashboard.

Il faut le tester de bout en bout avec un vrai utilisateur beta.

### Priorite 2 : Confirmer le Tracker Persistant

Le code supporte un tracker Supabase via `applications`.

A verifier : migrations appliquees, cartes visibles apres deconnexion/reconnexion, tracker fonctionnel sur un autre navigateur/appareil, actions de statut bien persistees.

### Priorite 3 : Tester la Promesse Payante

Question cle :

> Est-ce que 10 EUR pour 100 analyses est percu comme une evidence par un etudiant en recherche active ?

### Priorite 4 : Produire des Demos Video

Utiliser `/demo-tracker` pour creer des videos courtes : beaucoup de refus/ghostings, tracker propre, une carte passe en "Offre recue", celebration.

---

## Idees Precedentes

Cette section sert a coller les brainstormings deja faits avec ChatGPT, Gemini, Claude Opus ou d'autres outils.

A ajouter ici : idees TikTok, hooks video, scripts Reels, angles de positionnement, idees de features, idees de pricing, retours utilisateurs, prompts marketing, observations concurrentielles.

### Brainstorming 1

A completer.

### Brainstorming 2

A completer.

### Brainstorming 3

A completer.

---

## Questions Ouvertes

- Le pack 10 EUR / 100 credits convertit-il mieux qu'une offre moins chere avec moins de credits ?
- Faut-il garder le fallback code d'acces ou passer completement a Google Auth ?
- Faut-il automatiser le paiement plus tard avec Stripe ou PayPal Checkout ?
- Quelle promesse TikTok convertit le mieux : score, tracker, relances ou "offre recue" ?
- Le tracker doit-il etre mis en avant des le debut ou rester le resultat naturel de l'analyse ?
- Quel niveau de personnalisation rend les messages assez bons pour que l'utilisateur les envoie vraiment ?
- Quand supprimer ou cacher les routes de demo avant une vraie mise en prod ?

---

## Resume pour Modele IA

FirstReply est un SaaS early-stage francophone pour etudiants, alternants, jeunes diplomes et profils juniors qui cherchent un stage, une alternance ou un premier poste. Le produit analyse une offre et un profil, calcule un score deterministe, recommande un angle, genere une lettre courte, un email general, des roles a chercher et des requetes de recherche, puis aide a generer un outreach personnalise apres saisie manuelle d'un contact et d'un domaine.

Le modele economique actuel est un pack unique : 10 EUR pour 100 credits, sans abonnement. Une analyse reussie consomme 1 credit. Le paiement actuel est un flow beta PayPal.Me avec validation admin manuelle.

L'architecture actuelle combine Supabase Auth Google, credit balances, applications persistantes, OpenAI cote serveur et routes admin/paiement. Le tracker est une partie centrale de l'experience : il transforme chaque candidature en prochaine action.

Le positionnement a privilegier : un systeme tactique pour arreter d'envoyer des candidatures dans le vide. Le marketing doit etre direct, emotionnel, credible, oriente etudiant, avec un fort potentiel TikTok/Reels autour de la galere des candidatures, des refus, des ghostings et du moment ou une offre arrive enfin.
