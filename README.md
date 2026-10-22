# FormPilot

Extension de navigateur (Chromium, Manifest V3) qui remplit automatiquement les formulaires web à partir de profils chiffrés, avec aperçu et confirmation avant chaque remplissage.

> MVP orienté formulaires Weezevent (inscriptions TCF/TEF Canada). Voir le PRD complet dans `PRD – Logiciel d'auto-remplissage de formulaires web (AutoFill Pro).md`.

## Fonctionnalités (MVP)

- **Coffre chiffré** : AES-256-GCM, clé dérivée du mot de passe maître via Argon2id (WASM), stockage local IndexedDB. Clé de récupération générée à la création (affichée une seule fois).
- **Verrouillage automatique** après 15 minutes d'inactivité.
- **Profils multiples** : identité, contact, adresse, entreprise, documents (gestion via la page options).
- **Détection de champs** : attributs `autocomplete`/`name`/`id` + heuristiques FR/EN, score de confiance 0–100, détection des honeypots.
- **Aperçu obligatoire** : champ par champ, confiance affichée, modification/désactivation avant remplissage.
- **Remplissage compatible React/Vue/Angular** (setter natif + événements), `select`, checkbox/radio, dates (`input[type=date]`).
- **Annulation en un clic** (undo) de tout le remplissage.
- **Règles Weezevent** : noms en majuscules, téléphone normalisé (+228 par défaut), dates, passeport/CNI — alias officiels (`first_name`, `lastname`, `mail`…).
- **Avertissements** : formulaire cross-origin ou HTTP non sécurisé signalés avant remplissage.
- **Raccourci clavier** : `Alt+Shift+F` ouvre le popup.
- **Export/import** du coffre chiffré (JSON), suppression totale en un clic.

## Guide & formulaire de test

- **Guide d’utilisation** : voir [`GUIDE-UTILISATION.md`](./GUIDE-UTILISATION.md)
- **Formulaire HTML de test** (tous les champs) : ouvrir [`formulaire-test.html`](./formulaire-test.html) dans Chrome (`Fichier → Ouvrir un fichier…`)

## Développement

```bash
pnpm install
pnpm dev          # compile l'extension → charger `.output/chrome-mv3-dev` dans chrome://extensions
pnpm dev:firefox  # dev Firefox
```

## Build

```bash
pnpm build           # .output/chrome-mv3/
pnpm build:firefox   # .output/firefox-mv2/
pnpm zip             # archive de publication
```

### Installation manuelle (Chromium)

1. `pnpm build`
2. `chrome://extensions` → mode développeur activé → « Charger l'extension non empaquetée » → sélectionner `.output/chrome-mv3/`

## Tests

```bash
pnpm test        # tests unitaires (Vitest) : crypto, normalisation, classification, remplissage
pnpm test:e2e    # test E2E (Playwright) : nécessite un build d'abord (pnpm build)
```

L'E2E charge l'extension buildée dans Chromium, crée un coffre, remplit le formulaire fixture `tests/fixture/form.html` via le content script, et vérifie l'undo.

## Stack

- [WXT](https://wxt.dev) (Manifest V3, multi-navigateurs)
- React + Tailwind CSS 4
- Dexie (IndexedDB), Web Crypto API, [hash-wasm](https://github.com/danilenkoam/hash-wasm) (Argon2id)
- Vitest, Playwright

## Sécurité

- Aucune donnée ne quitte l'appareil ; zéro télémétrie.
- Le coffre n'est stocké qu'en AES-256-GCM ; le mot de passe maître et la clé de récupération dérivent/ouvrent la clé de chiffrement sans jamais être stockés.
- Remplissage uniquement sur action explicite de l'utilisateur ; jamais d'envoi automatique de formulaire.
- Sans mot de passe **ni** clé de récupération, les données sont irrécupérables (chiffrement zéro connaissance).
