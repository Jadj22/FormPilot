import type { SemanticType } from '../types';

// === Types de champs détectables ===
// Liste volontairement plus large que les 15 champs proposés dans l'UI
// (lib/authorizedFields.ts) : le profil peut contenir d'autres types.
// Les champs fichier (idPhotoFile, idDocumentFile) en sont exclus.
export const AUTHORIZED_SEMANTIC_TYPES: readonly SemanticType[] = [
  'civility', 'firstName', 'lastName', 'fullName', 'email',
  'phoneMobile', 'phoneHome', 'addressLine1', 'addressLine2',
  'city', 'region', 'postalCode', 'country', 'birthDate',
  'birthCity', 'birthCountry', 'nationality', 'gender',
  'passportNumber', 'idCardNumber', 'idIssueDate', 'idExpiryDate',
  'jobTitle', 'companyName', 'siret', 'vatNumber', 'iban',
  'languages', 'residence',
];

export function isAuthorizedType(type: string): type is SemanticType {
  return (AUTHORIZED_SEMANTIC_TYPES as readonly string[]).includes(type);
}

// === Règles négatives ===
// Un motif qui matche le libellé retire `penalty` points au score des types
// visés (`types`), ou à tous les types si `types` est absent.
export interface NegativeRule {
  pattern: RegExp;
  penalty: number;
  types?: readonly SemanticType[];
}

export const NEGATIVE_RULES: readonly NegativeRule[] = [
  // Identifiants de connexion : jamais des données de profil
  { pattern: /nom.*utilisateur|username|user.*login|pseudo|handle/, penalty: 70 },
  { pattern: /mot.*de.*passe|password|pass.*word/, penalty: 80 },
  // « Adresse e-mail » n'est pas une adresse postale
  { pattern: /adresse.*email|email.*adresse|mail.*adresse/, penalty: 60, types: ['addressLine1', 'addressLine2'] },
  // « Adresse postale » n'est pas un e-mail
  { pattern: /adresse.*postale|adresse.*physique/, penalty: 20, types: ['email'] },
  // « Nom et prénom » est un champ combiné, pas un nom seul ni un prénom seul
  { pattern: /\bnom\b.*\bprenom\b/, penalty: 30, types: ['firstName', 'lastName'] },
  // « Nom de l'entreprise / du client… » n'est pas le nom de la personne
  {
    pattern: /\bnom\b.*(entreprise|societe|client|etablissement|organisation|ecole|rue|voie)/,
    penalty: 70,
    types: ['firstName', 'lastName'],
  },
  // Libellés ambigus tel / e-mail
  { pattern: /tel.*email|email.*tel|phone.*mail/, penalty: 50 },
  // Champs « non reconnu / aucun »
  { pattern: /__none__|non reconnu|non selectionne|\baucun\b/, penalty: 90 },
  // Liens et commentaires (\b évite que « client » matche « lien »)
  { pattern: /\burl\b|\blien\b|website|site.*web/, penalty: 30 },
  { pattern: /commentaires?|\bavis\b|\bretour\b|feedback|remarks/, penalty: 20 },
];

/**
 * Applique les règles négatives au score d'un type.
 * `normalizedLabel` doit déjà être passé par normalizeLabel().
 */
export function applyNegativeRules(
  type: SemanticType,
  score: number,
  normalizedLabel: string,
): number {
  let result = score;
  for (const rule of NEGATIVE_RULES) {
    if (rule.types && !rule.types.includes(type)) continue;
    if (rule.pattern.test(normalizedLabel)) result -= rule.penalty;
  }
  return Math.max(0, result);
}

// === Signal name/id ===
// Valeurs comparées après suppression de tout caractère non alphanumérique
// (« first_name », « first-name » et « firstName » donnent « firstname »).
export const NAME_ID_PATTERNS: ReadonlyArray<{ type: SemanticType; names: readonly string[] }> = [
  { type: 'civility', names: ['civility', 'civilite', 'title', 'salutation'] },
  { type: 'firstName', names: ['firstname', 'fname', 'givenname', 'prenom'] },
  { type: 'lastName', names: ['lastname', 'lname', 'familyname', 'surname', 'nom', 'nomdefamille'] },
  { type: 'email', names: ['email', 'mail', 'courriel', 'emailaddress'] },
  { type: 'phoneMobile', names: ['phone', 'tel', 'telephone', 'mobile', 'phonenumber', 'portable'] },
  { type: 'birthDate', names: ['birthdate', 'dob', 'birthday', 'datenaissance', 'datedenaissance'] },
  { type: 'birthCity', names: ['birthcity', 'villenaissance', 'lieunaissance', 'placeofbirth'] },
  { type: 'birthCountry', names: ['birthcountry', 'paysnaissance', 'countryofbirth'] },
  { type: 'nationality', names: ['nationality', 'nationalite'] },
  { type: 'languages', names: ['languages', 'language', 'langues', 'langue'] },
  { type: 'residence', names: ['residence', 'quartier'] },
  { type: 'jobTitle', names: ['jobtitle', 'profession', 'occupation', 'metier'] },
  { type: 'idCardNumber', names: ['idnumber', 'idcard', 'cni', 'numeropiece', 'documentnumber'] },
  { type: 'idIssueDate', names: ['issuedate', 'dateemission', 'datedelivrance'] },
  { type: 'idExpiryDate', names: ['expirydate', 'expirationdate', 'dateexpiration'] },
];

// === Confiance ===
/** Convertit un score brut (0-100+) en niveau de confiance : 100 / 70 / 40 / 0. */
export function calculateConfidence(score: number): number {
  if (score >= 70) return 100;
  if (score >= 40) return 70;
  if (score >= 20) return 40;
  return 0;
}

// === Helpers ===
export function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
