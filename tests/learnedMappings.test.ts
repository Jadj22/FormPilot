// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getFieldSignature } from '~/lib/detection/classify';
import type { DetectedField, LearnedMapping } from '~/lib/types';

// ─── Inline applyLearnedMappings (mirrors content.ts logic for unit testing) ──

function applyLearnedMappings(
  fields: DetectedField[],
  hostname: string,
  mappings: LearnedMapping[] = [],
): DetectedField[] {
  if (!mappings.length) return fields;
  const hostMappings = mappings.filter(
    (m) => hostname === m.hostname || hostname.endsWith(`.${m.hostname}`),
  );
  if (!hostMappings.length) return fields;

  return fields.map((f) => {
    let hit = f.name
      ? hostMappings.find((m) => m.fieldSignature === `name:${f.name!.toLowerCase().trim()}`)
      : undefined;
    if (!hit && f.id) {
      hit = hostMappings.find((m) => m.fieldSignature === `id:${f.id!.toLowerCase().trim()}`);
    }
    if (!hit) {
      hit = hostMappings.find(
        (m) => m.fieldSignature === `label:${f.label.toLowerCase().trim()}`,
      );
    }
    if (hit) {
      return { ...f, type: hit.type, confidence: 100, selected: true, isLearned: true };
    }
    return f;
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeField(overrides: Partial<DetectedField> = {}): DetectedField {
  return {
    key: 'k1',
    label: 'Champ test',
    type: null,
    confidence: 0,
    value: '',
    selected: false,
    ...overrides,
  };
}

function makeMapping(overrides: Partial<LearnedMapping> = {}): LearnedMapping {
  return {
    id: 'id-1',
    hostname: 'example.com',
    fieldSignature: 'label:champ test',
    type: 'firstName',
    createdAt: 0,
    ...overrides,
  };
}

// ─── getFieldSignature ────────────────────────────────────────────────────────

describe('getFieldSignature', () => {
  it('prefers name attribute', () => {
    const el = document.createElement('input');
    el.setAttribute('name', 'FirstName');
    expect(getFieldSignature(el, 'label')).toBe('name:firstname');
  });

  it('falls back to id if no name', () => {
    const el = document.createElement('input');
    el.setAttribute('id', 'Field_Email');
    expect(getFieldSignature(el, 'label')).toBe('id:field_email');
  });

  it('falls back to label if no name or id', () => {
    const el = document.createElement('input');
    expect(getFieldSignature(el, 'Adresse e-mail')).toBe('label:adresse e-mail');
  });
});

// ─── applyLearnedMappings ─────────────────────────────────────────────────────

describe('applyLearnedMappings', () => {
  it('returns fields unchanged when no mappings', () => {
    const fields = [makeField()];
    expect(applyLearnedMappings(fields, 'example.com', [])).toStrictEqual(fields);
  });

  it('applies mapping by label', () => {
    const field = makeField({ label: 'Champ test', type: null });
    const mapping = makeMapping({ fieldSignature: 'label:champ test', type: 'firstName' });
    const [result] = applyLearnedMappings([field], 'example.com', [mapping]);
    expect(result.type).toBe('firstName');
    expect(result.confidence).toBe(100);
    expect(result.isLearned).toBe(true);
  });

  it('applies mapping by name attribute (takes priority over label)', () => {
    const field = makeField({ label: 'X', name: 'email_field', type: null });
    const mapping = makeMapping({
      fieldSignature: 'name:email_field',
      type: 'email',
    });
    const [result] = applyLearnedMappings([field], 'example.com', [mapping]);
    expect(result.type).toBe('email');
    expect(result.isLearned).toBe(true);
  });

  it('applies mapping by id attribute', () => {
    const field = makeField({ id: 'birth_date', label: 'Quelque chose', type: null });
    const mapping = makeMapping({ fieldSignature: 'id:birth_date', type: 'birthDate' });
    const [result] = applyLearnedMappings([field], 'example.com', [mapping]);
    expect(result.type).toBe('birthDate');
  });

  it('ignores mappings from a different host', () => {
    const field = makeField({ label: 'Champ test', type: null });
    const mapping = makeMapping({ hostname: 'other.com' });
    const [result] = applyLearnedMappings([field], 'example.com', [mapping]);
    expect(result.type).toBeNull();
    expect(result.isLearned).toBeUndefined();
  });

  it('matches subdomains against base hostname', () => {
    const field = makeField({ label: 'Champ test', type: null });
    const mapping = makeMapping({ hostname: 'example.com' });
    const [result] = applyLearnedMappings([field], 'tickets.example.com', [mapping]);
    expect(result.type).toBe('firstName');
    expect(result.isLearned).toBe(true);
  });

  it('does not match sibling domains', () => {
    const field = makeField({ label: 'Champ test', type: null });
    const mapping = makeMapping({ hostname: 'evil-example.com' });
    const [result] = applyLearnedMappings([field], 'example.com', [mapping]);
    expect(result.type).toBeNull();
  });
});

// ─── fieldSignatureFrom (popup helper - tested inline) ────────────────────────

describe('fieldSignatureFrom (popup helper)', () => {
  function fieldSignatureFrom(f: Pick<DetectedField, 'name' | 'id' | 'label'>): string {
    if (f.name) return `name:${f.name.toLowerCase().trim()}`;
    if (f.id) return `id:${f.id.toLowerCase().trim()}`;
    return `label:${f.label.toLowerCase().trim()}`;
  }

  it('returns name signature when name is set', () => {
    expect(fieldSignatureFrom({ name: 'LastName', id: 'x', label: 'y' })).toBe('name:lastname');
  });

  it('returns id signature when no name', () => {
    expect(fieldSignatureFrom({ id: 'email_id', label: 'E-mail' })).toBe('id:email_id');
  });

  it('returns label signature as last resort', () => {
    expect(fieldSignatureFrom({ label: 'Date de naissance' })).toBe('label:date de naissance');
  });
});
