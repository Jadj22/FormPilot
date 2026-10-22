import { describe, expect, it } from 'vitest';
import { classifyWeezevent, isWeezeventHost } from '~/lib/weezevent/rules';
import { AUTOCOMPLETE_MAP, DICT_RULES } from '~/lib/detection/dictionary';

describe('weezevent rules', () => {
  it('detects weezevent hosts', () => {
    expect(isWeezeventHost('www.weezevent.com')).toBe(true);
    expect(isWeezeventHost('tickets.weezevent.com')).toBe(true);
    expect(isWeezeventHost('example.com')).toBe(false);
  });

  it('classifies identity fields', () => {
    expect(classifyWeezevent('Nom de famille')?.type).toBe('lastName');
    expect(classifyWeezevent('Prénom')?.type).toBe('firstName');
    expect(classifyWeezevent('Adresse e-mail')?.type).toBe('email');
    expect(classifyWeezevent('Mail')?.type).toBe('email');
    expect(classifyWeezevent('Téléphone portable')?.type).toBe('phoneMobile');
    expect(classifyWeezevent('last_name')?.type).toBe('lastName');
    expect(classifyWeezevent('first_name')?.type).toBe('firstName');
    expect(classifyWeezevent('lastname')?.type).toBe('lastName');
    expect(classifyWeezevent('firstname')?.type).toBe('firstName');
  });

  it('classifies passport and ID fields', () => {
    expect(classifyWeezevent('Numéro de passeport')?.type).toBe('passportNumber');
    expect(classifyWeezevent("Numéro de la carte d'identité")?.type).toBe('idCardNumber');
    expect(classifyWeezevent("Date d'expiration du document")?.type).toBe('idExpiryDate');
    expect(classifyWeezevent('Date de délivrance')?.type).toBe('idIssueDate');
    expect(classifyWeezevent('Numéro de pièce')?.type).toBe('idCardNumber');
    expect(classifyWeezevent('Titre de séjour')?.type).toBe('idCardNumber');
  });

  it('classifies profile fields including birth, nationality, residence and languages', () => {
    expect(classifyWeezevent('Pays de naissance')?.type).toBe('birthCountry');
    expect(classifyWeezevent('Ville de naissance')?.type).toBe('birthCity');
    expect(classifyWeezevent('Lieu de naissance')?.type).toBe('birthCity');
    expect(classifyWeezevent('Nationalité')?.type).toBe('nationality');
    expect(classifyWeezevent('Langues parlées')?.type).toBe('languages');
    expect(classifyWeezevent('Résidence')?.type).toBe('residence');
    expect(classifyWeezevent('Quartier')?.type).toBe('residence');
    expect(classifyWeezevent('Profession')?.type).toBe('jobTitle');
    expect(classifyWeezevent('Métier')?.type).toBe('jobTitle');
  });

  it('flags uppercase transforms for names only', () => {
    expect(classifyWeezevent('Nom de famille')?.transform).toBe('uppercase');
    expect(classifyWeezevent('Prénom')?.transform).toBe('uppercase');
    expect(classifyWeezevent('Adresse e-mail')?.transform).toBeUndefined();
  });

  it('returns null for unknown labels', () => {
    expect(classifyWeezevent('Commentaires libres')).toBeNull();
  });
});

describe('dictionary', () => {
  it('maps WHATWG autocomplete attributes', () => {
    expect(AUTOCOMPLETE_MAP['given-name']).toBe('firstName');
    expect(AUTOCOMPLETE_MAP['email']).toBe('email');
    expect(AUTOCOMPLETE_MAP['postal-code']).toBe('postalCode');
  });

  it('has rules for core fields', () => {
    const types = new Set(DICT_RULES.map((r) => r.type));
    for (const t of ['firstName', 'lastName', 'email', 'city', 'postalCode'] as const) {
      expect(types.has(t)).toBe(true);
    }
  });
});
