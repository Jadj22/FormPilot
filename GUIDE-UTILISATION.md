# Guide d’utilisation — FormPilot

Extension Chrome/Edge qui remplit des formulaires web à partir de **profils chiffrés** stockés uniquement sur votre ordinateur.

---

## 1. Installer l’extension (mode développement)

1. Ouvrez un terminal dans le dossier du projet `autofillapp`.
2. Lancez :
   ```bash
   pnpm install
   pnpm dev
   ```
3. Dans Chrome, allez sur `chrome://extensions` (Edge : `edge://extensions`).
4. Activez le **Mode développeur**.
5. Cliquez **Charger l’extension non empaquetée**.
6. Sélectionnez le dossier :
   ```
   F:\autofillapp\.output\chrome-mv3-dev
   ```
7. Épinglez **FormPilot** dans la barre d’extensions.

Laissez le terminal `pnpm dev` ouvert pendant vos tests. Après une mise à jour du code, cliquez **Actualiser** sur la carte FormPilot dans `chrome://extensions` si besoin.

---

## 2. Première configuration (une seule fois)

### 2.1 Créer le coffre

1. Cliquez sur l’icône **FormPilot**.
2. Choisissez un **mot de passe maître** (8 caractères minimum) → confirmez → **Créer**.
3. **Notez la clé de récupération** affichée (copiez-la quelque part de sûr).
4. Cliquez **J’ai noté ma clé — Continuer**.

Sans mot de passe **ni** clé de récupération, les données sont **irrécupérables**.

### 2.2 Créer un profil et remplir les champs

1. Dans le popup, cliquez **Options** (ça s’ouvre dans un **nouvel onglet**).
2. Déverrouillez avec le mot de passe maître si demandé.
3. Cliquez **+ Nouveau** pour créer un profil (renommez-le, ex. « Perso »).
4. Dans **+ Ajouter un champ…**, ajoutez les types dont vous avez besoin, par exemple :
   - Civilité, Prénom, Nom  
   - E-mail, Téléphone mobile  
   - Adresse, Code postal, Ville, Pays  
   - Date de naissance, Nationalité  
   - Entreprise, SIRET, IBAN…  
   - N° passeport / CNI, dates d’émission / expiration  
5. Saisissez les **valeurs** dans chaque ligne.
6. (Optionnel) **Définir par défaut** ce profil.

Vous pouvez fermer l’onglet Options : les données sont déjà enregistrées dans le coffre chiffré.

---

## 3. Tester sur le formulaire HTML fourni

Un fichier de test contient **tous les champs** reconnus par FormPilot :

```
F:\autofillapp\formulaire-test.html
```

### Étapes

1. Dans Chrome : **Fichier → Ouvrir un fichier…** (ou glissez `formulaire-test.html` dans une fenêtre Chrome).
2. Vérifiez que l’URL commence par `file:///` et que la page affiche « Formulaire de test FormPilot ».
3. Cliquez sur l’icône **FormPilot** (ou `Alt+Shift+F`).
4. Déverrouillez si le coffre est verrouillé.
5. Cliquez **Détecter les champs**.
6. Dans l’**aperçu** :
   - cochez / décochez les champs ;
   - vérifiez la valeur proposée (`→ …`) et le score de confiance ;
   - cliquez **Remplir**.
7. Sur la page, cliquez **Afficher les valeurs** pour contrôler le résultat JSON.
8. Dans le popup, vous pouvez **Annuler le remplissage** (undo) si besoin.

FormPilot **n’envoie jamais** le formulaire à votre place : l’envoi reste manuel.

---

## 4. Utiliser FormPilot sur un vrai site (ex. Weezevent)

1. Ouvrez le site et allez jusqu’à la page avec les **champs à remplir** (attendez le chargement complet).
2. Ouvrez FormPilot → **Détecter les champs** → vérifiez l’aperçu → **Remplir**.
3. Relisez les champs sur le site, puis validez / envoyez **vous-même**.

Si la détection échoue :

- rechargez la page ;
- restez sur l’onglet du formulaire (pas sur `chrome://…`) ;
- vérifiez que l’extension est déverrouillée ;
- sur Weezevent, placez-vous bien à l’étape « Coordonnées ».

---

## 5. Fonctions utiles

| Action | Où |
| --- | --- |
| Détecter / remplir | Popup FormPilot |
| Raccourci clavier | `Alt+Shift+F` |
| Gérer profils & champs | Options (nouvel onglet) |
| Exporter le coffre (JSON chiffré) | Options → Exporter |
| Importer un coffre | Options → zone Importer |
| Supprimer toutes les données | Options → Supprimer toutes les données |
| Verrouillage auto | Après **15 min** d’inactivité |

---

## 6. Checklist rapide « premier test réussi »

- [ ] Extension chargée depuis `.output\chrome-mv3-dev`
- [ ] Coffre créé + clé de récupération notée
- [ ] Profil créé avec au moins Prénom, Nom, E-mail, Téléphone
- [ ] `formulaire-test.html` ouvert dans Chrome
- [ ] Détection → aperçu → Remplir → valeurs visibles dans le formulaire
- [ ] Bouton **Afficher les valeurs** montre le JSON rempli

---

## 7. Dépannage

| Problème | Que faire |
| --- | --- |
| Popup bizarre / Options trop petites | Actualiser l’extension ; Options doit s’ouvrir en **onglet** |
| « Impossible de joindre cette page » | Recharger la page web, puis rouvrir le popup |
| Aucun champ détecté | Page sans inputs visibles, ou mauvais onglet ; tester d’abord `formulaire-test.html` |
| Champs vides après Remplir | Vérifier que le profil a bien des **valeurs** saisies dans Options |
| Mot de passe oublié | Utiliser la **clé de récupération** dans Options |
| Après `pnpm dev`, rien ne change | `chrome://extensions` → Actualiser FormPilot |

---

## 8. Sécurité (rappel)

- Données chiffrées en local (AES-256-GCM + Argon2id).
- Aucune synchronisation cloud dans cette version.
- Remplissage uniquement après votre confirmation dans l’aperçu.
- Ne partagez jamais votre mot de passe maître ni votre clé de récupération.
