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
  | 'residence'
  /** FR-21 — file attachments */
  | 'idPhotoFile'
  | 'idDocumentFile';

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

/** Encrypted binary attachment stored in the vault (base64 data URL). */
export interface FileAttachment {
  id: string;
  type: 'idPhotoFile' | 'idDocumentFile';
  name: string;      // original filename
  mimeType: string;  // e.g. 'image/jpeg', 'application/pdf'
  dataUrl: string;   // base64 data: URL
  sizeBytes: number;
}

export interface Profile {
  id: string;
  name: string;
  color: string;
  fields: FieldValue[];
  attachments?: FileAttachment[];
}

export interface LearnedMapping {
  id: string;
  hostname: string;
  fieldSignature: string; // ex: name, id, or normalized label
  type: SemanticType;
  createdAt: number;
}

export interface SiteRule {
  hostname: string;
  defaultProfileId?: string | null;
}

export interface VaultData {
  version: 1;
  profiles: Profile[];
  defaultProfileId: string | null;
  learnedMappings?: LearnedMapping[];
  siteRules?: SiteRule[];
}

export interface DetectedField {
  key: string;
  label: string;
  name?: string;
  id?: string;
  type: SemanticType | null;
  confidence: number;
  value: string;
  selected: boolean;
  isLearned?: boolean;
}

export interface FillItem {
  key: string;
  selected: boolean;
  overrideValue?: string;
  overrideType?: SemanticType | null;
  saveRuleForHost?: string;
  /** FR-21: base64 data URL to inject into input[type=file] */
  fileDataUrl?: string;
  fileMimeType?: string;
  fileName?: string;
}

export type ContentRequest =
  | { type: 'DETECT'; learnedMappings?: LearnedMapping[] }
  | { type: 'FILL'; items: FillItem[]; profile: Profile }
  | { type: 'UNDO' }
  | { type: 'STATUS' };

/** Push message sent by content.ts → popup when a multi-step form changes step. */
export type ContentPushMessage = {
  type: 'STEP_CHANGED';
  detected: DetectedField[];
  warnings: string[];
};

export type ContentResponse =
  | { ok: true; status: { fields: number; filled: number } }
  | { ok: true; detected: DetectedField[]; warnings: string[] }
  | { ok: true; filled: number }
  | { ok: true; undone: boolean }
  | { ok: false; error: string };

export function emptyVault(): VaultData {
  return {
    version: 1,
    profiles: [],
    defaultProfileId: null,
    learnedMappings: [],
    siteRules: [],
  };
}

export function uid(): string {
  return crypto.randomUUID();
}
