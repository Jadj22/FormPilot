import type { SemanticType } from '../types';

export interface Rule {
  type: SemanticType;
  pattern: RegExp;
  weight: number;
}

const rule = (type: SemanticType, pattern: string, weight: number): Rule => ({
  type,
  pattern: new RegExp(pattern, 'i'),
  weight,
});

export const DICT_RULES: Rule[] = [
  rule('firstName', 'prenom|first[-_ ]?name|given[-_ ]?name|nombre|nome.*prop', 0.9),
  rule('lastName', 'nom.*famil|lastname|last[-_ ]?name|family[-_ ]?name|surname|apelido', 0.9),
  rule('fullName', 'nom.*complet|fullname|full[-_ ]?name|complete.*name', 0.85),
  rule('civility', 'civilit|title.*civil|salutation|gender.*title|mr|mrs|miss|monsieur|madame', 0.6),
  rule('email', 'e-?mail|courriel|correo', 1.0),
  rule('phoneMobile', 'mobile|portable|cell|phone|tel[ée]phone|celular', 0.85),
  rule('phoneHome', 'telephone.*fixe|home.*phone|landline', 0.8),
  rule('addressLine1', 'adresse|address|street|rue|domicile|residence|endereco|living', 0.8),
  rule('addressLine2', 'adresse.*(2|compl[ée]ment|suite|apartment|apt)|address[-_ ]?2|complemento', 0.75),
  rule('city', 'ville|city|cidade|localit|town|commune|municipality', 0.9),
  rule('postalCode', 'code[-_ ]?postal|zip|cep|postal[-_ ]?code', 0.95),
  rule('region', 'region|etat|state|province|departement|departamento|regiao', 0.8),
  rule('country', 'pays|country|pais|nation', 0.9),
  rule('birthDate', 'date.*naiss|birth[-_ ]?date|dob|data.*nasc|born', 0.95),
  rule('nationality', 'nationalit|nationality|nacionalidade', 1.0),
  rule('gender', 'genre|gender|sexo|sexe', 0.9),
  rule('companyName', 'entreprise|company|societe|firm|organizacao|raison.*sociale|business.*name', 0.85),
  rule('siret', 'siret|siren|numero.*entreprise|company.*number', 0.95),
  rule('vatNumber', 'tva|vat|tax.*number|taxation|impot', 0.9),
  rule('iban', 'iban|bank.*account|compte.*bancaire|routing', 0.95),
  rule('birthCountry', 'pays.*naiss|country.*birth|birth.*country', 1.0),
  rule('birthCity', 'ville.*naiss|lieu.*naiss|city.*birth|place.*birth|town.*birth', 1.0),
  rule('languages', 'langue|languages?|preferred.*language|spoken.*language', 0.95),
  rule('residence', 'residence|quartier|ville.*residence|adresse.*residence', 0.9),
  rule('jobTitle', 'profession|metier|job.*title|occupation|poste|position|fonction|cargo|role', 0.85),
  rule('passportNumber', 'passeport|passport|numero.*passeport', 1.0),
  rule('idCardNumber', 'carte.*identite|id.*card|cni|identity.*number|identificacion|documento|numero.*piece|numero.*document|id.*number|document.*number', 0.95),
  rule('idIssueDate', 'date.*emission|issue.*date|date.*delivrance|date.*release', 0.85),
  rule('idExpiryDate', 'date.*expiration|expiry|expiration.*date|validite|vencimento|date.*fin', 0.85),
];

export const AUTOCOMPLETE_MAP: Record<string, SemanticType> = {
  'given-name': 'firstName',
  'additional-name': 'firstName',
  'family-name': 'lastName',
  'honorific-prefix': 'civility',
  'honorific-suffix': 'civility',
  'email': 'email',
  'tel': 'phoneMobile',
  'tel-national': 'phoneMobile',
  'tel-local': 'phoneHome',
  'street-address': 'addressLine1',
  'address-line1': 'addressLine1',
  'address-line2': 'addressLine2',
  'address-level2': 'city',
  'address-level1': 'region',
  'postal-code': 'postalCode',
  'country': 'country',
  'country-name': 'country',
  'bday': 'birthDate',
  'organization': 'companyName',
  'organization-title': 'jobTitle',
};
