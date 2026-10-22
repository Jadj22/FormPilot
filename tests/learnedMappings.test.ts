// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { getFieldSignature } from '~/lib/detection/classify';
import type { DetectedField, LearnedMapping } from '~/lib/types';

// ─── Inline helpers (mirror content.ts logic for unit testing) ────────────────

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
      hit = hostMappings.find((m) => m.fieldSignature === `label:${f.label.toLowerCase().trim()}`);
    }
    return hit ? { ...f, type: hit.type, confidence: 100, selected: true, isLearned: true } : f;
  });
}

function hasFormElementMutation(mutations: MutationRecord[]): boolean {
  const formTags = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'FORM', 'FIELDSET']);
  for (const m of mutations) {
    for (const node of [...m.addedNodes, ...m.removedNodes]) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const el = node as Element;
      if (formTags.has(el.tagName)) return true;
      if (el.querySelector?.('input, select, textarea')) return true;
    }
  }
  return false;
}

function fieldsSignatureChanged(next: DetectedField[], prev: DetectedField[]): boolean {
  if (next.length !== prev.length) return true;
  return next.some((f, i) => f.key !== prev[i]?.key);
}

function fieldSignatureFrom(f: Pick<DetectedField, 'name' | 'id' | 'label'>): string {
  if (f.name) return `name:${f.name.toLowerCase().trim()}`;
  if (f.id) return `id:${f.id.toLowerCase().trim()}`;
  return `label:${f.label.toLowerCase().trim()}`;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeField(overrides: Partial<DetectedField> = {}): DetectedField {
  return { key: 'k1', label: 'Champ test', type: null, confidence: 0, value: '', selected: false, ...overrides };
}

function makeMapping(overrides: Partial<LearnedMapping> = {}): LearnedMapping {
  return { id: 'id-1', hostname: 'example.com', fieldSignature: 'label:champ test', type: 'firstName', createdAt: 0, ...overrides };
}

function fakeMutationRecord(addedEl: Element | null, removedEl: Element | null = null): MutationRecord {
  return {
    type: 'childList',
    target: document.body,
    addedNodes: (addedEl ? [addedEl] : []) as unknown as NodeList,
    removedNodes: (removedEl ? [removedEl] : []) as unknown as NodeList,
    previousSibling: null,
    nextSibling: null,
    attributeName: null,
    attributeNamespace: null,
    oldValue: null,
  } as MutationRecord;
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
    const result = applyLearnedMappings(
      [makeField({ label: 'Champ test', type: null })],
      'example.com',
      [makeMapping({ fieldSignature: 'label:champ test', type: 'firstName' })],
    )[0]!;

    expect(result.type).toBe('firstName');
    expect(result.confidence).toBe(100);
    expect(result.isLearned).toBe(true);
  });

  it('applies mapping by name attribute', () => {
    const result = applyLearnedMappings(
      [makeField({ label: 'X', name: 'email_field', type: null })],
      'example.com',
      [makeMapping({ fieldSignature: 'name:email_field', type: 'email' })],
    )[0]!;
    expect(result.type).toBe('email');
  });

  it('applies mapping by id attribute', () => {
    const result = applyLearnedMappings(
      [makeField({ id: 'birth_date', label: 'Quelque chose', type: null })],
      'example.com',
      [makeMapping({ fieldSignature: 'id:birth_date', type: 'birthDate' })],
    )[0]!;
    expect(result.type).toBe('birthDate');
  });

  it('ignores mappings from a different host', () => {
    const result = applyLearnedMappings(
      [makeField()],
      'example.com',
      [makeMapping({ hostname: 'other.com' })],
    )[0]!;
    expect(result.type).toBeNull();
  });

  it('matches subdomains against base hostname', () => {
    const result = applyLearnedMappings(
      [makeField()],
      'tickets.example.com',
      [makeMapping({ hostname: 'example.com' })],
    )[0]!;
    expect(result.isLearned).toBe(true);
  });

  it('does not match sibling domains', () => {
    const result = applyLearnedMappings(
      [makeField()],
      'example.com',
      [makeMapping({ hostname: 'evil-example.com' })],
    )[0]!;
    expect(result.type).toBeNull();
  });
});

// ─── fieldSignatureFrom (popup helper) ────────────────────────────────────────

describe('fieldSignatureFrom (popup helper)', () => {
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

// ─── FR-20 : hasFormElementMutation ──────────────────────────────────────────

describe('hasFormElementMutation (FR-20)', () => {
  it('returns true when an input is added', () => {
    expect(hasFormElementMutation([fakeMutationRecord(document.createElement('input'))])).toBe(true);
  });

  it('returns true when a select is removed', () => {
    expect(hasFormElementMutation([fakeMutationRecord(null, document.createElement('select'))])).toBe(true);
  });

  it('returns true when a div wrapping an input is added', () => {
    const div = document.createElement('div');
    div.appendChild(document.createElement('input'));
    expect(hasFormElementMutation([fakeMutationRecord(div)])).toBe(true);
  });

  it('returns false when only a span is added', () => {
    const span = document.createElement('span');
    span.textContent = 'hello';
    expect(hasFormElementMutation([fakeMutationRecord(span)])).toBe(false);
  });

  it('returns false for empty mutation array', () => {
    expect(hasFormElementMutation([])).toBe(false);
  });
});

// ─── FR-20 : fieldsSignatureChanged ──────────────────────────────────────────

describe('fieldsSignatureChanged (FR-20)', () => {
  it('returns false when field sets are identical', () => {
    const a = [makeField({ key: 'k1' }), makeField({ key: 'k2' })];
    const b = [makeField({ key: 'k1' }), makeField({ key: 'k2' })];
    expect(fieldsSignatureChanged(a, b)).toBe(false);
  });

  it('returns true when counts differ', () => {
    expect(fieldsSignatureChanged([makeField({ key: 'k1' })], [makeField({ key: 'k1' }), makeField({ key: 'k2' })])).toBe(true);
  });

  it('returns true when a key differs at same position', () => {
    const a = [makeField({ key: 'k1' }), makeField({ key: 'k_new' })];
    const b = [makeField({ key: 'k1' }), makeField({ key: 'k2' })];
    expect(fieldsSignatureChanged(a, b)).toBe(true);
  });

  it('returns false for two empty arrays', () => {
    expect(fieldsSignatureChanged([], [])).toBe(false);
  });
});
