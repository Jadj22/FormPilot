import type { SemanticType } from './types';

// === RÈGLES POSITIVES ===
export const POSITIVE_RULES = [
  rule('civility', 'civilit|title.*civil|salutation|gender.*title|mr|mrs|miss|monsieur|madame', 40),
  rule('firstName', 'prenom|first[-_ ]?name|given[-_ ]?name|nombre|nome.*prop|vorname|firstname', 40),
  rule('lastName', 'nom.*famil|lastname|last[-_ ]?name|family[-_ ]?name|surname|apelido|nachname', 40),
  rule('fullName', 'nom.*complet|fullname|full[-_ ]?name|complete.*name', 35),
  rule('email', 'e-?mail|courriel|correo|email|mail', 50),
  rule('phoneMobile', 'mobile|portable|cell|phone|tel[ée]phone|celular|portable|gsm', 45),
  rule('phoneHome', 'telephone.*fixe|home.*phone|landline|fixe', 40),
  rule('addressLine1', 'adresse|address|street|rue|domicile|residence|endereco|living|adresse.*postale', 40),
  rule('city', 'ville|city|cidade|localit|town|commune|municipality|village', 45),
  rule('postalCode', 'code[-_ ]?postal|zip|cep|postal[-_ ]?code|code.postal', 50),
  rule('region', 'region|etat|state|province|departement|departamento|regiao|region.*administrat', 35),
  rule('country', 'pays|country|pais|nation|usa|canada|france|algerie|togo|uk|ukraine', 45),
  rule('birthDate', 'date.*naiss|birth[-_ ]?date|dob|data.*nasc|born|naissance|né.*le', 50),
  rule('birthCity', 'ville.*naiss|lieu.*naiss|city.*birth|place.*birth|town.*birth|né.*à', 45),
  rule('nationality', 'nationalit|nationality|nacionalidade|nationalite', 50),
  rule('gender', 'genre|gender|sexo|sexe|civilite|civility', 30),
  rule('passportNumber', 'passeport|passport|numero.*passeport|passport.*number', 55),
  rule('idCardNumber', 'carte.*identite|id.*card|cni|identity.*number|identificacion|documento|piece.*identite', 55),
  rule('idIssueDate', 'date.*emission|issue.*date|date.*delivrance|date.*release|date.*obtention', 35),
  rule('idExpiryDate', 'date.*expiration|expiry|expiration.*date|validite|vencimento|date.*fin|exp.*date', 35),
  rule('languages', 'langue|languages?|preferred.*language|spoken.*language|langue.*utilise', 40),
  rule('residence', 'residence|quartier|ville.*residence|adresse.*residence|domicile.fiscal', 35),
  rule('jobTitle', 'profession|metier|job.*title|occupation|poste|position|fonction|cargo|role|titre.*poste', 35),
  rule('companyName', 'entreprise|company|societe|firm|organizacao|raison.*sociale|business.*name|société', 35),
  rule('siret', 'siret|siren|numero.*entreprise|company.*number|num.*siret', 60),
  rule('vatNumber', 'tva|vat|tax.*number|taxation|impot|num.*taxe', 55),
  rule('iban', 'iban|bank.*account|compte.*bancaire|routing|swift|bic', 60),
] as const;

const rule = (type: SemanticType, pattern: string, weight: number): Rule => ({
  type,
  pattern: new RegExp(pattern, 'i'),
  weight,
});

export interface Rule {
  type: SemanticType;
  pattern: RegExp;
  weight: number;
};

export const AUTHORIZED_SEMANTIC_TYPES: SemanticType[] = [
  'civility',
  'firstName',
  'lastName',
  'fullName',
  'email',
  'phoneMobile',
  'phoneHome',
  'addressLine1',
  'addressLine2',
  'city',
  'region',
  'postalCode',
  'country',
  'birthDate',
  'birthCity',
  'nationality',
  'gender',
  'passportNumber',
  'idCardNumber',
  'idIssueDate',
  'idExpiryDate',
  'jobTitle',
  'companyName',
  'siret',
  'vatNumber',
  'iban',
  'languages',
  'residence',
] as const;

export const UNAUTHORIZED_TYPES: SemanticType[] = [
  'idDocumentFile',
] as const;

// === RÈGLES NÉGATIVES (exclusions) ===
export const NEGATIVE_RULES = [
  rule('trap', 'nom.*utilisateur|username|user.*login|pseudo|handle', -70),
  rule('trap', 'mot.*de.*passe|password|pass.*word', -80),
  rule('exclude', 'adresse.*email|email.*adresse|mail.*adresse', -60),
  rule('exclude', 'adresse.*postale|adresse.*physique', -20),
  rule('exclude', 'champ.*nom.*et.*prénom|nom.*et.*prenom|nom.*prénom', -30),
  rule('exclude', 'tel.*email|email.*tel|phone.*mail', -50),
  rule('trap', '__none__|non.*reconnu|non.*sélectionné|aucun', -90),
  rule('trap', 'url|lien|website|site.*web', -30),
  rule('trap', 'commentaires|comment|avis|retour|feedback|remarks', -20),
] as const;

// === Helpers ===

export function normalizeLabel(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\\*+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAuthorizedType(type: string): type is SemanticType {
  return AUTHORIZED_SEMANTIC_TYPES.includes(type as SemanticType);
}