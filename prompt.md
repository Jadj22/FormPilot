## Objectif : adapter les champs du profil et améliorer le remplissage automatique sur les formulaires web

Je souhaite ajuster la gestion des informations personnelles dans **FormPilot (AutoFill Pro)** afin de répondre précisément aux besoins des formulaires d'inscription, notamment ceux de Weezevent.

Le MVP est déjà opérationnel : coffre chiffré, gestion des profils, détection des champs, moteur de remplissage, normalisation et interface popup/options. Il ne faut donc pas reconstruire ces fonctionnalités, mais analyser l'existant et effectuer uniquement les modifications nécessaires.

### 1. Champs autorisés pour ce profil

Pour le profil concerné, les informations à conserver sont exclusivement les suivantes :

1. Civilité
2. Nom
3. Prénom(s)
4. Date de naissance
5. Pays de naissance
6. Ville de naissance
7. Nationalité
8. Langue(s) usuelle(s)
9. Numéro de la pièce d'identité
10. Adresse e-mail
11. Numéro de téléphone
12. Résidence (quartier et ville)
13. Profession
14. Date d'émission de la pièce d'identité
15. Date d'expiration de la pièce d'identité

**Règle importante :** cette liste définit les champs autorisés pour ce profil et ce formulaire cible. Supprime de cette interface les champs supplémentaires qui ne correspondent pas à ces besoins, sans supprimer les fonctionnalités génériques de FormPilot ni les données utilisées par d'autres profils.

Avant toute modification, vérifie comment les champs sont actuellement structurés dans le modèle de données, les composants d'interface et le moteur de remplissage.

### 2. Comportement attendu des champs

Adapte les composants de saisie en fonction de la nature de chaque information.

**A. Listes déroulantes natives (`select`)**

Utilise les composants suivants :

* **Civilité** : liste déroulante avec les options « Monsieur » et « Madame ».
* **Pays de naissance** : liste déroulante des pays.
* **Nationalité** : liste déroulante des nationalités.
* **Langue(s) usuelle(s)** : sélection multiple si plusieurs langues peuvent être enregistrées.
* **Ville de naissance** : liste déroulante uniquement si une source de données fiable est déjà disponible. Sinon, conserve une saisie textuelle.
* **Profession** : liste déroulante uniquement si une liste de professions existe déjà. Sinon, conserve une saisie textuelle.

Pour les champs restants, utilise un composant adapté :

* Texte pour le nom, les prénoms et la résidence.
* E-mail pour l'adresse électronique.
* Téléphone pour le numéro de téléphone.
* Texte pour le numéro de la pièce d'identité, afin de préserver les zéros initiaux et les caractères spéciaux.

Ne transforme pas automatiquement tous les champs en listes déroulantes.

### 3. Gestion et affichage des dates

Les trois champs de date doivent être pris en charge :

* Date de naissance
* Date d'émission de la pièce d'identité
* Date d'expiration de la pièce d'identité

Le format lisible souhaité dans l'interface est :

**JJ mois AAAA**, avec le mois écrit en toutes lettres et en français.

Exemples :

* 07 novembre 1993
* 18 septembre 2024
* 17 septembre 2029

L'utilisateur doit pouvoir choisir séparément :

* Le jour, sous forme numérique.
* Le mois, sous forme de nom en français.
* L'année, sous forme numérique.

Privilégie trois sélecteurs distincts si cela s'intègre correctement à l'interface existante. Si le projet possède déjà un composant de calendrier adapté, réutilise-le plutôt que de créer inutilement un nouveau composant.

**Attention :** l'affichage en toutes lettres ne doit pas compromettre le remplissage automatique.

Le moteur de remplissage doit convertir la date stockée vers le format réellement attendu par le champ du site cible :

* Pour un champ HTML `input[type="date"]`, utiliser le format technique `YYYY-MM-DD`.
* Pour trois champs distincts jour/mois/année, remplir chaque champ séparément.
* Pour un champ textuel, adapter la date au format détecté ou configuré pour le site.

Ne modifie pas globalement la normalisation des dates sans vérifier les conséquences sur les sites déjà pris en charge, notamment Weezevent.

### 4. Compatibilité avec le moteur de remplissage existant

FormPilot prend déjà en charge les champs natifs, les cases à cocher, les boutons radio et les champs de date, ainsi que les frameworks réactifs.

Il faut maintenant vérifier que les données du profil peuvent être correctement associées aux champs correspondants, y compris lorsque le site utilise des libellés différents.

Prévois notamment les correspondances suivantes :

| Information du profil         | Exemples d'alias possibles                                           |
| ----------------------------- | -------------------------------------------------------------------- |
| Civilité                      | civilité, titre, title, salutation                                   |
| Nom                           | nom, nom de famille, lastname, last_name, surname                    |
| Prénom(s)                     | prénom, prénoms, firstname, first_name, given name                   |
| Date de naissance             | date de naissance, birth date, date of birth, DOB                    |
| Pays de naissance             | pays de naissance, country of birth, birth country                   |
| Ville de naissance            | ville de naissance, lieu de naissance, city of birth, place of birth |
| Nationalité                   | nationalité, nationality, citizenship                                |
| Langue(s) usuelle(s)          | langue, langues parlées, preferred language, spoken language         |
| Numéro de la pièce d'identité | numéro de pièce, numéro de document, ID number, document number      |
| Adresse e-mail                | e-mail, email, courriel, mail                                        |
| Numéro de téléphone           | téléphone, téléphone mobile, phone, mobile, telephone                |
| Résidence                     | résidence, quartier, ville de résidence, address, locality           |
| Profession                    | profession, métier, occupation, profession, job title                |
| Date d'émission               | date d'émission, date de délivrance, issue date, date of issue       |
| Date d'expiration             | date d'expiration, date de validité, expiry date, expiration date    |

Cette table sert de référence pour les associations sémantiques. Réutilise le dictionnaire et le système de classification existants plutôt que d'ajouter un second moteur de détection indépendant.

Ne considère pas automatiquement « lieu de naissance », « résidence » et « adresse complète » comme des informations interchangeables.

### 5. Préserver l'architecture et la sécurité de FormPilot

Avant de coder :

1. Examine les composants de gestion des profils dans `entrypoints/options/`.
2. Examine les types et structures de données utilisés pour enregistrer les profils.
3. Analyse `lib/normalize.ts` et les règles existantes dans `lib/weezevent/rules.ts`.
4. Vérifie le comportement de `lib/fill/fill.ts` pour les listes déroulantes et les champs de date.
5. Identifie les tests existants qui couvrent ces fonctionnalités.

Ensuite, effectue les changements les plus ciblés possible.

Contraintes :

* Conserve le coffre chiffré, IndexedDB, la dérivation de clé et les mécanismes de verrouillage.
* Ne stocke aucune information personnelle en clair dans le code source, les journaux ou les tests versionnés.
* Ne casse pas les profils existants ni les données déjà enregistrées.
* Préserve le fonctionnement des sites déjà pris en charge.
* Ne modifie pas la détection générale si le problème peut être résolu au niveau des données du profil ou de la normalisation.
* Ne réécris pas les composants qui fonctionnent déjà.
* N'ajoute aucune dépendance sans nécessité démontrée.

### 6. Données de test

Utilise les données fictives ou anonymisées déjà disponibles dans les tests pour vérifier le comportement des composants.

Si les informations ci-dessous sont utilisées pour une vérification manuelle, elles ne doivent pas être enregistrées comme valeurs par défaut permanentes ni intégrées à des fixtures versionnées :

* Civilité : Monsieur
* Nom : AGBODJAN
* Prénom(s) : KOSSI BRUCE
* Date de naissance : 07 novembre 1993
* Pays de naissance : Togo
* Ville de naissance : AHEPE
* Nationalité : Togolaise
* Langue(s) usuelle(s) : Français
* Numéro de la pièce d'identité : valeur fournie dans les données de test locales
* Adresse e-mail : valeur fournie dans les données de test locales
* Numéro de téléphone : valeur fournie dans les données de test locales
* Résidence : Djagblé, Tsévié
* Profession : Géomètre-topographe
* Date d'émission : 18 septembre 2024
* Date d'expiration : 17 septembre 2029

### 7. Critères de validation

Considère la tâche comme terminée lorsque :

1. L'interface présente exactement les 15 champs autorisés pour le profil concerné.
2. Les listes déroulantes proposent des options cohérentes et enregistrent correctement les valeurs sélectionnées.
3. Les dates sont affichées en français sous la forme « 07 novembre 1993 ».
4. Les dates sont correctement converties lors du remplissage des champs des sites cibles.
5. Les numéros de pièce d'identité et de téléphone conservent les zéros initiaux lorsque cela est nécessaire.
6. Les informations du profil sont correctement associées aux champs correspondants.
7. Les profils déjà enregistrés restent compatibles.
8. Les tests unitaires et E2E concernés passent.

### Consigne finale

Commence par analyser le code existant et identifier les fichiers réellement concernés. Présente brièvement les modifications nécessaires, puis implémente-les sans élargir le périmètre.

Ne développe pas de nouvelles fonctionnalités sans rapport avec cette tâche. Ne modifie pas le fonctionnement général de FormPilot et ne considère pas cette demande comme une refonte de l'extension.
