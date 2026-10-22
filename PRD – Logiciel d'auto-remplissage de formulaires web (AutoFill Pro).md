# PRD – Logiciel d'auto-remplissage de formulaires web

**Nom de travail :** FormPilot\
**Version du document :** 1.0 (brouillon)\
**Date :** 13 octobre 2026\
**Statut :** À valider

---

## 1. Résumé exécutif

FormPilot est une extension de navigateur (avec une application compagnon en option) qui remplit automatiquement les formulaires web à partir de profils d'informations stockés de façon chiffrée par l'utilisateur. Contrairement aux autofills natifs des navigateurs, limités à l'adresse, la carte bancaire et le mot de passe, FormPilot gère **tous types de champs** (identité, parcours professionnel, documents, réponses récurrentes, champs personnalisés), les **formulaires complexes** (multi-étapes, menus dynamiques, frameworks React/Vue/Angular, iframes, Shadow DOM), et laisse toujours **l'utilisateur garder le contrôle** avant l'envoi.

**Proposition de valeur :** « Saisissez vos informations une fois, ne les retapez plus jamais, sur n'importe quel site, en toute sécurité. »

## 2. Problème à résoudre

- Les gens remplissent des dizaines de formulaires répétitifs : candidatures, inscriptions, démarches administratives, bons de commande, KYC, formulaires de contact, commandes B2B.
- L'autofill natif est incomplet : il rate les champs non standards, échoue sur les formulaires dynamiques, ne gère pas plusieurs identités ni les réponses spécifiques (ex. « Pourquoi voulez-vous ce poste ? »).
- Les gestionnaires de mots de passe remplissent surtout les identifiants et les cartes, peu les formulaires longs.
- Les formulaires mal conçus (noms de champs obscurs, listes déroulantes personnalisées, champs en plusieurs parties) cassent les autofills simples.
- Les alternatives basées sur du texte copié-collé sont lentes et sujettes aux erreurs.

## 3. Objectifs et non-objectifs

### Objectifs

1. Remplir correctement **au moins 90 %** des champs courants sur les 1 000 sites de formulaires les plus fréquents (mesuré par un jeu de tests automatisé).
2. Réduire de **70 %** le temps de remplissage moyen d'un formulaire de plus de 10 champs.
3. Garantir la **confidentialité par conception** : données chiffrées localement, aucune donnée en clair sur un serveur.
4. Offrir une expérience où l'utilisateur **voit, vérifie et valide** avant tout envoi.
5. Supporter plusieurs profils (perso, pro, entreprise, famille) et plusieurs langues (français, anglais, espagnol et portugais au lancement).

### Non-objectifs (v1)

- Contourner les CAPTCHA ou les protections anti-bot (explicitement exclu, pour des raisons éthiques et légales).
- Envoi automatique et massif de formulaires (spam, scraping, automatisation abusive).
- Gestionnaire de mots de passe complet (peut être une intégration future).
- Application mobile native (la v1 cible desktop ; mobile en v2).

## 4. Utilisateurs cibles (personas)

| Persona | Besoins | Frustrations |
| --- | --- | --- |
| **Awa, candidate à l'emploi** (28 ans) | Postuler à 20+ offres par semaine, mêmes CV, expériences et lettres types | Retaper le parcours professionnel sur chaque portail de recrutement |
| **Karim, freelance / PME** (35 ans) | Remplir des devis, des inscriptions fournisseurs, des formulaires de marchés publics | Informations d'entreprise (SIRET, TVA, IBAN) à resaisir sans cesse |
| **Mme Dupont, démarches administratives** (55 ans) | Formulaires administratifs, assurance, santé | Interfaces compliquées, peur de se tromper, besoin de simplicité |
| **Léo, testeur / professionnel QA** (30 ans) | Jeux de données de test sur des environnements de recette | Besoin de profils jetables et de données générées |
| **Responsable RH / back-office** (40 ans) | Saisir des données depuis des fiches vers des outils web | Doubles saisies entre systèmes |

## 5. Cas d'usage principaux (user stories)

1. **En tant qu'utilisateur**, je veux créer un profil avec mes informations pour ne plus les ressaisir.
2. **En tant qu'utilisateur**, je veux cliquer sur un bouton (ou un raccourci clavier) pour remplir le formulaire de la page ouverte.
3. **En tant qu'utilisateur**, je veux voir un aperçu de ce qui va être rempli, champ par champ, avec un indicateur de confiance, avant validation.
4. **En tant qu'utilisateur**, je veux que le logiciel apprenne quand je corrige un champ mal rempli (« Associer ce champ à Téléphone mobile »).
5. **En tant qu'utilisateur**, je veux enregistrer un formulaire comme « modèle » pour le re-remplir à l'identique (ex. déclaration mensuelle).
6. **En tant qu'utilisateur**, je veux gérer plusieurs profils et choisir lequel utiliser selon le site (règles par domaine).
7. **En tant qu'utilisateur**, je veux attacher des fichiers (CV, pièce d'identité, justificatifs) à mes profils et les joindre automatiquement aux champs d'upload.
8. **En tant qu'utilisateur**, je veux que mes données soient chiffrées, protégées par un mot de passe maître, et que je puisse les exporter ou les supprimer à tout moment.
9. **En tant qu'utilisateur avancé**, je veux définir des champs personnalisés et des réponses types avec variables (ex. « Bonjour {{entreprise}} »).
10. **En tant qu'équipe**, je veux partager des profils d'entreprise (version Équipe, v2).

## 6. Périmètre et phasage

### MVP (v0.1, \~3 mois)

- Extension Chrome et Edge (Manifest V3), puis Firefox.
- Création et gestion de profils (identité, adresse, contact, entreprise, professionnel).
- Détection de champs par attributs HTML et heuristiques sur libellés (FR/EN).
- Remplissage par clic + raccourci clavier, avec **aperçu et confirmation**.
- Stockage local chiffré, mot de passe maître.
- Compatibilité avec formulaires React/Vue/Angular standards.
- Export / import JSON chiffré.

### v1.0 (\~6 mois)

- Formulaires multi-étapes, listes déroulantes personnalisées, dates, cases à cocher, boutons radio, champs téléphone avec indicatif.
- Modèles de formulaires par site, règles par domaine.
- Upload de fichiers.
- Apprentissage des corrections utilisateur.
- Support iframes et Shadow DOM.
- Safari, mode sombre, accessibilité complète.
- Langues : FR, EN, ES, PT.

### v2.0

- Synchronisation chiffrée de bout en bout entre appareils.
- Application mobile (iOS/Android) et clavier d'autofill.
- Assistant IA optionnel pour les champs ouverts (voir section 8.4).
- Version Équipe : profils partagés, rôles et journal d'audit.
- API / SDK pour intégrateurs.

## 7. Exigences fonctionnelles détaillées

### 7.1 Gestion des profils et des données

- **FR-1** : Création de plusieurs profils, chacun composé de catégories : Identité, Contact, Adresses (domicile, travail, livraison, facturation), Entreprise, Emploi/CV (expériences, formations, compétences), Documents, Réponses types, Champs personnalisés.
- **FR-2** : Chaque donnée possède un **libellé**, une **valeur**, un **type sémantique** (prénom, e-mail, téléphone, etc.), des **alias** et une **sensibilité** (normale / sensible).
- **FR-3** : Données multi-valeurs (plusieurs e-mails, plusieurs adresses) avec valeur par défaut.
- **FR-4** : Champs répétables (ex. liste d'expériences professionnelles) pour les formulaires à sections dynamiques.
- **FR-5** : Import depuis CSV, vCard, JSON et exports de navigateurs (adresses uniquement). Export chiffré.
- **FR-6** : Génération de profils jetables/fictifs pour les tests (option).

### 7.2 Détection de formulaires et de champs

- **FR-7** : Détection automatique des formulaires à l'ouverture de la page (désactivable) et à la demande.
- **FR-8** : Détection des champs dynamiques ajoutés après chargement (MutationObserver), y compris dans les iframes de même origine ou autorisées, et le Shadow DOM ouvert.
- **FR-9** : Classification de chaque champ selon la taxonomie interne (≈ 150 types sémantiques) avec un **score de confiance** de 0 à 100.
- **FR-10** : Ignorer par défaut les champs sensibles hors périmètre : mots de passe, codes à usage unique (OTP), CVV (sauf activation explicite et mode sécurisé).
- **FR-11** : Détecter et ignorer les **champs pièges** (honeypots invisibles) pour ne jamais remplir un champ non visible par l'utilisateur.

### 7.3 Remplissage

- **FR-12** : Remplissage compatible avec les frameworks modernes : déclenchement des événements `input`, `change`, `blur`, utilisation du setter natif de la valeur, afin que React, Vue et Angular enregistrent bien la valeur.
- **FR-13** : Gestion des types d'entrée : texte, e-mail, téléphone, nombre, date (conversion de format selon la locale du site), `select`, listes personnalisées (ouverture, recherche, sélection), cases à cocher, radios, `textarea`, éditeurs riches simples.
- **FR-14** : Normalisation des valeurs selon le contexte : format de téléphone (indicatif, espaces), format de date (JJ/MM/AAAA vs MM/JJ/AAAA), pays (nom, code ISO-2, ISO-3), civilité.
- **FR-15** : Champs composés : numéro de téléphone en plusieurs cases, date en trois champs, adresse sur plusieurs lignes, autocomplétion d'adresse tierce (Google Places, etc.).
- **FR-16** : **Écran d'aperçu** avant remplissage : liste des champs reconnus, valeur proposée, confiance ; possibilité de décocher, modifier, ou changer d'association.
- **FR-17** : **Mode « remplir sans confirmation »** pour les champs à confiance élevée, activable par l'utilisateur et par domaine de confiance.
- **FR-18** : **Annulation en un clic** (undo) de tout le remplissage.
- **FR-19** : Jamais d'envoi automatique du formulaire dans la v1. L'utilisateur clique lui-même sur « Envoyer ».
- **FR-20** : Formulaires multi-étapes : proposer de continuer le remplissage à l'étape suivante, avec reprise de contexte.
- **FR-21** : Upload de fichiers : sélection du document du profil et injection dans le champ `input[type=file]` via l'API DataTransfer.

### 7.4 Apprentissage et modèles

- **FR-22** : Si l'utilisateur corrige l'association d'un champ, FormPilot propose de **mémoriser la règle** pour ce site (ou globalement).
- **FR-23** : Enregistrement d'un **modèle de formulaire** : association champ → donnée, valeurs fixes, ordre des étapes.
- **FR-24** : Règles par domaine : profil par défaut, champs interdits, mode de confirmation.
- **FR-25** : Partage anonyme optionnel (opt-in) des corrections de détection (sans aucune valeur personnelle, uniquement la structure du champ et le type) pour améliorer le moteur.

### 7.5 Interface utilisateur

- **FR-26** : Popup de l'extension : sélecteur de profil, bouton « Remplir », état de détection, réglages rapides.
- **FR-27** : Panneau latéral (side panel) pour la gestion détaillée et l'aperçu.
- **FR-28** : Icône flottante discrète dans les champs de formulaire (comme les gestionnaires de mots de passe), activable/désactivable.
- **FR-29** : Raccourcis clavier configurables (ex. `Alt+Maj+F` pour remplir).
- **FR-30** : Menu contextuel : « Remplir ce champ avec… ».
- **FR-31** : Page d'options : profils, règles par site, sécurité, import/export, langue, thème.
- **FR-32** : Onboarding guidé en 3 minutes maximum avec profil pré-structuré.

### 7.6 Sécurité et confidentialité (fonctionnel)

- **FR-33** : Mot de passe maître obligatoire ; déverrouillage biométrique/WebAuthn en option ; verrouillage automatique après inactivité (délai configurable).
- **FR-34** : Remplissage uniquement sur action de l'utilisateur (clic/raccourci) par défaut ; jamais de remplissage silencieux sur un nouveau domaine.
- **FR-35** : Avertissement si le formulaire envoie ses données vers un **domaine différent** de la page (cible d'action cross-origin) ou en HTTP non sécurisé.
- **FR-36** : Journal local des remplissages (domaine, date, profil, nombre de champs) consultable et effaçable ; aucune valeur enregistrée.
- **FR-37** : Suppression complète des données en un clic.

## 8. Architecture technique

### 8.1 Vue d'ensemble

| Composant | Rôle | Technologies suggérées |
| --- | --- | --- |
| **Content script** | Analyse du DOM, détection, remplissage | TypeScript, MutationObserver |
| **Service worker (MV3)** | Orchestration, stockage, messagerie, règles | TypeScript, `chrome.storage`, IndexedDB |
| **UI (popup, side panel, options)** | Interface utilisateur | React ou Svelte, Tailwind |
| **Moteur de classification** | Association champ → type sémantique | Règles + modèle ML léger (ONNX/TF.js) exécuté localement |
| **Coffre chiffré** | Stockage des profils | Web Crypto API (AES-256-GCM), Argon2id (WASM) |
| **Service de sync (v2)** | Synchronisation E2E | API Rust/Go ou Node, stockage de blobs chiffrés |
| **Application compagnon (option)** | Import de fichiers, intégrations OS | Tauri/Electron (v2) |

### 8.2 Pipeline de détection (par couches)

1. **Couche 1 – Standards** : attributs `autocomplete` (WHATWG), `type`, `name`, `id` → confiance haute.
2. **Couche 2 – Heuristiques sémantiques** : libellés (`<label>`, `aria-label`, `placeholder`, texte voisin), dictionnaire multilingue, expressions régulières, proximité visuelle.
3. **Couche 3 – Contexte de formulaire** : position dans le formulaire, champs voisins (ex. prénom → nom), titre de section, structure répétée.
4. **Couche 4 – Modèle ML local** : petit classifieur entraîné sur des caractéristiques de champs (jamais sur des valeurs utilisateur), fonctionne hors ligne.
5. **Couche 5 – Règles apprises** : règles personnalisées de l'utilisateur et modèles de sites (prioritaires).
6. **Couche 6 (optionnelle, opt-in) – LLM** : pour les champs ouverts et ambigus, envoi **uniquement de la structure anonymisée** du champ (libellé, type), jamais de données personnelles, ou exécution d'un petit modèle local. Désactivée par défaut.

Le score final combine les couches ; en dessous d'un seuil (ex. 60), le champ est proposé mais non coché par défaut.

### 8.3 Stratégie de compatibilité

- **Frameworks JS** : utiliser le setter natif de `HTMLInputElement.prototype.value` puis dispatcher les événements ; tester avec React 18/19, Vue 3, Angular, Svelte.
- **Listes personnalisées** (Select2, MUI, Ant Design, React-Select) : adaptateurs dédiés qui simulent l'ouverture, la saisie et la sélection.
- **iframes** : content script injecté avec `all_frames` ; gestion des iframes cross-origin via permissions explicites.
- **Shadow DOM** : parcours récursif des racines ouvertes ; support partiel du mode fermé (limite connue).
- **Sites à protection renforcée** : respecter les restrictions, jamais de contournement.

### 8.4 Intelligence artificielle (option)

- Génération de réponses aux champs ouverts (lettres de motivation, « Pourquoi nous rejoindre ? ») à partir du profil et du contexte de l'offre, **toujours soumise à relecture**.
- Fonctionnement : opt-in explicite, clé API fournie par l'utilisateur ou modèle local, transparence totale sur les données envoyées.

### 8.5 Modèle de données (simplifié)

```
Vault
 ├─ Profile (id, nom, langue, couleur, par défaut)
 │   ├─ Field (id, type_sémantique, libellé, valeur, alias[], sensible, répétable)
 │   ├─ Group (ex. Expérience #1, #2…) → Field[]
 │   └─ Document (id, nom, type MIME, blob chiffré)
 ├─ SiteRule (domaine, profil_par_défaut, mode_confirmation, champs_exclus[])
 ├─ FormTemplate (domaine, empreinte_formulaire, mappings[], étapes[])
 ├─ LearnedMapping (empreinte_champ → type_sémantique, portée)
 └─ Settings (verrouillage, langue, raccourcis, télémétrie opt-in)
```

## 9. Sécurité et vie privée (exigences non fonctionnelles)

- **Chiffrement** : AES-256-GCM pour le coffre ; clé dérivée du mot de passe maître via Argon2id (paramètres adaptés), sel unique, jamais stockée.
- **Zéro connaissance** : en v2, le serveur ne stocke que des blobs chiffrés ; il ne peut pas lire les données.
- **Moindre privilège** : permissions d'extension minimales ; `activeTab` et permissions d'hôte optionnelles demandées à la volée.
- **Isolation** : le contenu de la page ne peut jamais lire le coffre ; communication via messages signés entre content script et service worker ; valeurs injectées uniquement au moment du remplissage.
- **Protection contre le clickjacking et les iframes invisibles** : vérification de la visibilité et de l'origine avant remplissage.
- **Aucune télémétrie par défaut** ; télémétrie anonyme strictement opt-in, sans aucune valeur de champ.
- **Conformité** : RGPD (droit d'accès, effacement, portabilité, minimisation), politique de confidentialité claire, consentement explicite ; prise en compte de la loi togolaise sur la protection des données personnelles et des réglementations équivalentes selon les marchés.
- **Audit** : audit de sécurité externe avant la v1.0 ; programme de divulgation responsable (bug bounty) après lancement.
- **Sauvegarde / récupération** : clé de récupération générée à la création du coffre (affichée une fois) ; avertir clairement que sans mot de passe ni clé, les données sont irrécupérables.
- **Chaîne d'approvisionnement** : dépendances verrouillées, SBOM, builds reproductibles, signature des releases.

## 10. Exigences non fonctionnelles

| Catégorie | Exigence |
| --- | --- |
| **Performance** | Détection < 200 ms sur une page standard ; remplissage < 500 ms pour 30 champs ; impact mémoire < 50 Mo |
| **Fiabilité** | Taux de crash < 0,1 % des sessions ; aucune perte de données du coffre (écriture atomique, sauvegardes versionnées) |
| **Compatibilité** | Chrome, Edge, Brave, Firefox, Safari (v1.0) ; dernières 2 versions majeures |
| **Accessibilité** | WCAG 2.2 AA ; navigation clavier complète ; lecteurs d'écran |
| **Internationalisation** | UI traduisible ; formats de date, téléphone et adresse par pays |
| **Hors ligne** | Fonctionnement complet sans connexion (hors sync et IA cloud) |
| **Maintenabilité** | Couverture de tests > 80 % sur le moteur ; adaptateurs de sites isolés et mis à jour sans republier l'extension quand c'est autorisé |

## 11. Expérience utilisateur (parcours clés)

**Parcours 1 – Premier usage**\
Installation → création du mot de passe maître → assistant de profil (nom, e-mail, téléphone, adresse) → page de test guidée « Essayez sur ce formulaire » → succès en moins de 3 minutes.

**Parcours 2 – Remplissage quotidien**\
L'utilisateur ouvre un formulaire → une icône discrète indique « Formulaire détecté (14 champs) » → clic ou raccourci → aperçu → « Remplir » → vérification visuelle (champs surlignés) → l'utilisateur clique sur « Envoyer ».

**Parcours 3 – Correction et apprentissage**\
Champ mal rempli → clic sur l'icône du champ → « Utiliser autre chose » → choix de la donnée → « Toujours faire ça sur ce site ? ».

**Parcours 4 – Candidature**\
Profil Awa → portail de recrutement → remplissage de l'identité → section « Expériences » dynamique → FormPilot ajoute les blocs nécessaires et les remplit → upload du CV → relecture → envoi.

**Principes UX** : transparence (toujours montrer ce qui sera rempli), contrôle (annuler, corriger), sobriété (pas de notifications envahissantes), langage simple pour les non-techniciens.

## 12. Indicateurs de succès (KPIs)

| Indicateur | Cible à 6 mois après lancement |
| --- | --- |
| Taux de champs correctement remplis (sans correction) | ≥ 90 % |
| Taux de formulaires entièrement remplis sans intervention | ≥ 60 % |
| Temps moyen de remplissage d'un formulaire | -70 % vs. saisie manuelle |
| Activation (a rempli ≥ 1 formulaire dans les 24 h) | ≥ 60 % |
| Rétention à 30 jours | ≥ 40 % |
| NPS | ≥ 40 |
| Note moyenne sur les stores | ≥ 4,5 / 5 |
| Incidents de sécurité majeurs | 0 |

## 13. Stratégie de test et qualité

- **Jeu de référence** : corpus d'au moins 1 000 formulaires réels et synthétiques (captures HTML) avec vérité terrain, rejoué à chaque version (tests de non-régression).
- **Tests automatisés** : unitaires (classification), intégration (Playwright/Puppeteer sur navigateurs réels), E2E sur sites de démonstration (React, Vue, Angular, WordPress, Shopify, Salesforce, Workday, etc.).
- **Tests de sécurité** : revue de code, tests d'intrusion, fuzzing du parseur de formulaires, tests XSS/clickjacking.
- **Tests utilisateurs** : sessions avec chaque persona, notamment les moins technophiles.
- **Bêta fermée** puis bêta publique avant le lancement général.

## 14. Modèle économique (hypothèses)

| Offre | Contenu | Prix indicatif |
| --- | --- | --- |
| **Gratuit** | 1 profil, remplissage de base, stockage local | 0 |
| **Pro** | Profils illimités, modèles, upload de fichiers, sync chiffrée, IA | 3–5 €/mois |
| **Équipe** | Profils partagés, rôles, audit, SSO | 6–10 €/utilisateur/mois |

Principe éthique : **aucune vente de données, aucune publicité**.

## 15. Risques et mitigations

| Risque | Probabilité | Impact | Mitigation |
| --- | --- | --- | --- |
| Fuite ou vol de données du coffre | Faible | Critique | Chiffrement fort, audit externe, zéro connaissance, programme de bug bounty |
| Remplissage erroné (mauvais champ) causant une erreur de démarche | Moyenne | Élevé | Aperçu obligatoire, scores de confiance, annulation, mode prudent par défaut |
| Sites qui bloquent ou cassent l'autofill | Moyenne | Moyen | Adaptateurs de sites, retours utilisateurs, mises à jour rapides |
| Changements des règles des stores (Manifest V3, politiques) | Moyenne | Élevé | Veille, architecture portable, packaging par navigateur |
| Détournement pour du spam ou de la fraude | Moyenne | Élevé | Pas d'envoi automatique, limites de débit, pas de contournement de CAPTCHA, CGU strictes |
| Concurrence (navigateurs, gestionnaires de mots de passe) | Élevée | Moyen | Se différencier sur les formulaires complexes, modèles, documents et profils multiples |
| Complexité de maintenance de la détection | Élevée | Moyen | Corpus de tests, architecture en couches, apprentissage communautaire anonyme |

## 16. Feuille de route indicative

| Phase | Durée | Livrables |
| --- | --- | --- |
| **0. Cadrage** | 3–4 semaines | Recherche utilisateurs, validation du PRD, maquettes, choix techniques |
| **1. Prototype** | 6 semaines | Détection + remplissage sur 20 sites, coffre chiffré minimal |
| **2. MVP / bêta fermée** | 8 semaines | Fonctions MVP, 100 bêta-testeurs |
| **3. v1.0** | 10 semaines | Multi-étapes, modèles, upload, Firefox/Safari, audit sécurité |
| **4. v2.0** | 4–6 mois | Sync E2E, mobile, IA, offre Équipe |

**Équipe minimale suggérée** : 1 chef de produit, 2 développeurs front/extension, 1 développeur sécurité/crypto (partiel), 1 designer UX, 1 QA, 1 data/ML (partiel).

## 17. Questions ouvertes

1. Quel public prioriser pour le lancement : candidatures, démarches administratives, ou professionnels/PME ?
2. Extension seule ou aussi application de bureau dès la v1 ?
3. Faut-il une synchronisation cloud dès le MVP, ou la garder en v2 ?
4. Quel niveau d'IA accepter (cloud, local, aucun) vis-à-vis de la promesse de confidentialité ?
5. Marchés prioritaires (Afrique francophone, Europe, international) et langues associées ?
6. Politique concernant les sites sensibles (banque, santé) : exclusion par défaut ou mode renforcé ?
7. Open source (cœur du moteur) pour gagner la confiance, ou code fermé ?

## 18. Annexes

### A. Taxonomie initiale des champs (extrait)

- **Identité** : civilité, prénom, deuxième prénom, nom, nom de naissance, date de naissance, lieu de naissance, nationalité, genre, situation familiale
- **Contact** : e-mail (perso/pro), téléphone mobile/fixe, indicatif pays, site web, LinkedIn
- **Adresse** : ligne 1/2, code postal, ville, région, pays (nom/ISO)
- **Entreprise** : raison sociale, forme juridique, SIRET/identifiant fiscal, TVA, poste, secteur, taille, IBAN/BIC
- **Professionnel** : intitulé du poste, employeur, dates, description, diplôme, école, compétences, langues, prétentions salariales, disponibilité
- **Documents** : CV, lettre de motivation, pièce d'identité, justificatif de domicile, photo
- **Divers** : réponses types, champs personnalisés

### B. Glossaire

- **Autofill** : remplissage automatique de champs de formulaire.
- **Content script** : script injecté dans une page web par une extension.
- **MV3** : Manifest V3, version actuelle du format d'extensions Chromium.
- **E2E** : chiffrement de bout en bout.
- **Honeypot** : champ invisible servant à piéger les robots.

---

*Ce document est une base de travail : les chiffres (cibles, prix, délais) sont des hypothèses à valider par la recherche utilisateurs et une étude de faisabilité technique.*

## 19. Annexe C – Stack technique recommandée et plan de démarrage

| Couche | Choix | Raison |
| --- | --- | --- |
| Framework d'extension | WXT + TypeScript + Manifest V3 | Un seul code pour Chrome, Edge, Firefox et Safari |
| Interface | React + Tailwind (Svelte en alternative) | Écosystème large, développement rapide |
| Détection et remplissage | Content script TypeScript, MutationObserver, fuse.js | Léger, sans dépendance lourde dans les pages |
| Stockage | IndexedDB (Dexie) | Profils, règles par site, modèles de formulaires |
| Chiffrement | Web Crypto (AES-256-GCM) + Argon2id (hash-wasm) | Natif, sans serveur |
| Tests | Vitest, Playwright avec extension chargée, corpus de pages HTML | Éviter les régressions de détection |
| Outils | pnpm, ESLint, GitHub Actions | Builds signés et reproductibles |
| v2 | Cloudflare Workers + R2/D1, ONNX Runtime Web | Synchro chiffrée et classifieur local |

**Points spécifiques aux pages Weezevent (cas pilote : inscriptions TCF Canada)**

- Le formulaire est chargé dynamiquement par le widget de billetterie : prévoir `all_frames`, des permissions d'hôte Weezevent et un observateur de DOM.
- Formulaire en plusieurs étapes (séance, panier, coordonnées) : relancer le remplissage à l'étape « Coordonnées ».
- Champs personnalisés : numéro de pièce, date d'émission, date d'expiration (avec alias).
- Normalisation : dates JJ/MM/AAAA, téléphone avec ou sans indicatif +228, pays en liste déroulante, noms en majuscules.
- Aperçu obligatoire avant remplissage et envoi manuel : l'identité n'est pas modifiable après inscription.
- Le numéro de pièce d'identité est une donnée sensible : chiffrée, jamais en clair dans le code ni le dépôt.

**Plan de démarrage**

1. Semaine 1 : mini-MVP WXT avec profil JSON local, modèle de formulaire Weezevent, bouton « Remplir » et aperçu.
2. Semaine 2 : coffre chiffré avec mot de passe maître, règles par domaine, apprentissage des corrections.
3. Ensuite : moteur de détection général selon les sections 7 et 8.
