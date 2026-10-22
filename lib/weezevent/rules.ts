import type { SemanticType } from '../types';

export interface WeezeventRule {
  match: RegExp;
  type: SemanticType;
  transform?: 'uppercase' | 'phone' | 'date';
}

export const WEEZEVENT_HOSTS = ['weezevent.com', 'www.weezevent.com'];

export function isWeezeventHost(hostname: string): boolean {
  return hostname.endsWith('weezevent.com');
}

/**
 * Règles pour les formulaires Weezevent (TCF/TEF Canada, billetterie).
 * Alias techniques Weezevent : first_name/firstname/prenom, last_name/lastname/nom,
 * email/mail, company/societe (source : weez-xlsx-uploader).
 * Ordre important : les règles les plus spécifiques d'abord.
 */
export const WEEZEVENT_RULES: WeezeventRule[] = [
  { match: /date.*expiration|expiry|expiration.*document|validite.*document|date.*validite/i, type: 'idExpiryDate', transform: 'date' },
  { match: /date.*emission|date.*delivrance|issue.*date|date.*release|delivre.*le/i, type: 'idIssueDate', transform: 'date' },
  { match: /numero.*passeport|passeport|passport.*number|numero.*passe/i, type: 'passportNumber' },
  { match: /carte.*sejour|titre.*sejour|resident.*permit/i, type: 'idCardNumber' },
  { match: /carte.*identite|cni|id.*card|numero.*document|document.*identite|piece.*identite|numero.*piece/i, type: 'idCardNumber' },
  { match: /numero.*natalite|acte.*naissance|birth.*certificate|certificat.*naissance/i, type: 'idCardNumber' },
  { match: /date.*naiss|birth.*date|dob|jour.*naissance/i, type: 'birthDate', transform: 'date' },
  { match: /pays.*naiss|country.*birth|birth.*country/i, type: 'birthCountry' },
  { match: /lieu.*naiss|birth.*place|ville.*naiss/i, type: 'birthCity' },
  { match: /nationalit|nationality|pays.*nationalite/i, type: 'nationality' },
  { match: /langue|preferred.*language|spoken.*language/i, type: 'languages' },
  { match: /residence|quartier|ville.*residence/i, type: 'residence' },
  { match: /nom.*famil|last.?name|family.?name|lastname|surname|nom.*epoux|nom.*jeune.?fille/i, type: 'lastName', transform: 'uppercase' },
  { match: /^nom$|^last.?name$|^lastname$|^surname$/i, type: 'lastName', transform: 'uppercase' },
  { match: /first.?name|prenom|given.?name|firstname/i, type: 'firstName', transform: 'uppercase' },
  { match: /nom.*complet|full.?name|complete.*name/i, type: 'fullName', transform: 'uppercase' },
  { match: /^mail$|e-?mail|courriel|correo|adresse.*mail/i, type: 'email' },
  { match: /portable|mobile|telephone|phone|celular|tel$|^tel/i, type: 'phoneMobile', transform: 'phone' },
  { match: /adresse.*facturation|billing.*address/i, type: 'addressLine1' },
  { match: /adresse|address|street|rue|domicile/i, type: 'addressLine1' },
  { match: /complement|address.*2|adresse.*2|apartment|apt|bureau|office/i, type: 'addressLine2' },
  { match: /code.?postal|zip|cep/i, type: 'postalCode' },
  { match: /ville|city|cidade|commune|localite|municipalit/i, type: 'city' },
  { match: /region|etat|state|province|departement/i, type: 'region' },
  { match: /pays|country|pais/i, type: 'country' },
  { match: /societe|company|entreprise|raison.?sociale|organization/i, type: 'companyName' },
  { match: /siret|siren/i, type: 'siret' },
  { match: /tva|vat|tax.*number/i, type: 'vatNumber' },
  { match: /profession|metier|poste|job.*title|position|fonction|occupation|cargo/i, type: 'jobTitle' },
  { match: /genre|gender|sexe|sexo/i, type: 'gender' },
  { match: /civilit|salutation|honorific/i, type: 'civility' },
];

export function deaccent(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '');
}

export function classifyWeezevent(label: string): {
  type: SemanticType;
  transform?: WeezeventRule['transform'];
} | null {
  const flat = deaccent(label);
  for (const rule of WEEZEVENT_RULES) {
    if (rule.match.test(flat) || rule.match.test(label)) {
      return { type: rule.type, transform: rule.transform };
    }
  }
  return null;
}
