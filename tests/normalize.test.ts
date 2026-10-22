import { describe, expect, it } from 'vitest';
import {
  formatDateFrench,
  normalizeDate,
  normalizeForType,
  normalizePhone,
  toDateISO,
} from '~/lib/normalize';

describe('normalizePhone', () => {
  it('adds Togo country code by default', () => {
    expect(normalizePhone('90 12 34 56')).toBe('+22890123456');
  });

  it('keeps an existing country code', () => {
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('+33612345678');
  });

  it('converts 00 prefix', () => {
    expect(normalizePhone('0022890123456')).toBe('+22890123456');
  });
});

describe('normalizeDate & formatDateFrench', () => {
  it('converts ISO to JJ/MM/AAAA', () => {
    expect(normalizeDate('1990-05-17')).toBe('17/05/1990');
  });

  it('normalizes dotted dates', () => {
    expect(normalizeDate('17.05.1990')).toBe('17/05/1990');
  });

  it('formats dates in full French words', () => {
    expect(formatDateFrench('1993-11-07')).toBe('07 novembre 1993');
    expect(formatDateFrench('18/09/2024')).toBe('18 septembre 2024');
    expect(formatDateFrench('17-09-2029')).toBe('17 septembre 2029');
    expect(formatDateFrench('18 fevrier 2024')).toBe('18 février 2024');
    expect(formatDateFrench('15 aout 2023')).toBe('15 août 2023');
  });

  it('leaves unknown formats untouched', () => {
    expect(normalizeDate('printemps 1990')).toBe('printemps 1990');
  });
});

describe('toDateISO', () => {
  it('converts JJ/MM/AAAA to YYYY-MM-DD', () => {
    expect(toDateISO('17/05/1990')).toBe('1990-05-17');
  });

  it('keeps already-ISO values', () => {
    expect(toDateISO('1990-05-17')).toBe('1990-05-17');
  });

  it('converts dotted dates', () => {
    expect(toDateISO('17.05.1990')).toBe('1990-05-17');
  });

  it('returns null for unparseable values', () => {
    expect(toDateISO('printemps')).toBeNull();
  });
});

describe('normalizeForType', () => {
  it('applies phone normalization', () => {
    expect(normalizeForType('phoneMobile', '90 12 34 56')).toBe('+22890123456');
  });

  it('applies date normalization', () => {
    expect(normalizeForType('birthDate', '1990-05-17')).toBe('17/05/1990');
  });

  it('leaves plain text as-is', () => {
    expect(normalizeForType('firstName', '  Awa  ')).toBe('Awa');
  });
});
