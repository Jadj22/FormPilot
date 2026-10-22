export type SemanticType =
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'civility'
  | 'email'
  | 'phoneMobile'
  | 'phoneHome'
  | 'addressLine1'
  | 'addressLine2'
  | 'city'
  | 'postalCode'
  | 'region'
  | 'country'
  | 'birthDate'
  | 'nationality'
  | 'gender'
  | 'companyName'
  | 'siret'
  | 'vatNumber'
  | 'iban'
  | 'jobTitle'
  | 'passportNumber'
  | 'idCardNumber'
  | 'idIssueDate'
  | 'idExpiryDate'
  | 'birthCountry'
  | 'birthCity'
  | 'languages'
  | 'residence';

export const SENSITIVE_TYPES: SemanticType[] = [
  'iban',
  'siret',
  'vatNumber',
  'passportNumber',
  'idCardNumber',
  'idIssueDate',
  'idExpiryDate',
];

export interface FieldValue {
  id: string;
  type: SemanticType;
  label: string;
  value: string;
}

export interface Profile {
  id: string;
  name: string;
  color: string;
  fields: FieldValue[];
}

export interface VaultData {
  version: 1;
  profiles: Profile[];
  defaultProfileId: string | null;
}

export interface DetectedField {
  key: string;
  label: string;
  type: SemanticType | null;
  confidence: number;
  value: string;
  selected: boolean;
}

export interface FillItem {
  key: string;
  selected: boolean;
  overrideValue?: string;
  overrideType?: SemanticType | null;
}

export type ContentRequest =
  | { type: 'DETECT' }
  | { type: 'FILL'; items: FillItem[]; profile: Profile }
  | { type: 'UNDO' }
  | { type: 'STATUS' };

export type ContentResponse =
  | { ok: true; status: { fields: number; filled: number } }
  | { ok: true; detected: DetectedField[]; warnings: string[] }
  | { ok: true; filled: number }
  | { ok: true; undone: boolean }
  | { ok: false; error: string };

export function emptyVault(): VaultData {
  return { version: 1, profiles: [], defaultProfileId: null };
}

export function uid(): string {
  return crypto.randomUUID();
}
