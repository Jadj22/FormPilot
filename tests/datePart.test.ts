import { describe, expect, it } from 'vitest';
import { getDatePart } from '~/lib/datePart';
import { classifyField } from '~/lib/detection/classify';
import { applyValue } from '~/lib/fill/fill';

const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function makeSelect(placeholder: string, items: Array<string | number>): HTMLSelectElement {
  const el = document.createElement('select');
  el.innerHTML =
    `<option value="">${placeholder}</option>` +
    items.map((x, i) => `<option value="${typeof x === 'number' ? x : i + 1}">${x}</option>`).join('');
  return el;
}

const days = () => makeSelect('Jour', Array.from({ length: 31 }, (_, i) => i + 1));
const months = () => makeSelect('Mois', MONTHS);
const years = () => makeSelect('Année', Array.from({ length: 106 }, (_, i) => 2025 - i));

describe('getDatePart', () => {
  it('reconnaît jour, mois et année d’après les options', () => {
    expect(getDatePart(days())).toBe('day');
    expect(getDatePart(months())).toBe('month');
    expect(getDatePart(years())).toBe('year');
  });

  it('reconnaît des mois numériques 1-12', () => {
    expect(getDatePart(makeSelect('Mois', Array.from({ length: 12 }, (_, i) => i + 1)))).toBe('month');
  });

  it('ignore une liste ordinaire', () => {
    expect(getDatePart(makeSelect('Pays', ['Togo', 'France', 'Bénin']))).toBeNull();
  });
});

describe('remplissage d’une date en trois listes', () => {
  it('place le jour, le mois et l’année au bon endroit', () => {
    const d = days();
    const m = months();
    const y = years();
    expect(applyValue(d, '14/05/2000')).toBe(true);
    expect(applyValue(m, '14/05/2000')).toBe(true);
    expect(applyValue(y, '14/05/2000')).toBe(true);
    expect(d.options[d.selectedIndex]?.text).toBe('14'); // pas « 1 »
    expect(m.options[m.selectedIndex]?.text).toBe('mai');
    expect(y.options[y.selectedIndex]?.text).toBe('2000');
  });
});

describe('classifyField : libellés courts', () => {
  const input = (attrs: Record<string, string> = {}) => {
    const el = document.createElement('input');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  it('reconnaît « Nom » seul comme nom de famille', () => {
    expect(classifyField(input({ name: 'attendee[0][q1]' }), 'attendee[0][q1] Nom*').type).toBe('lastName');
  });

  it('ne pénalise pas « Prénom » parce que « nom » est dans « prénom »', () => {
    const r = classifyField(input(), 'Prénom* Prénom*');
    expect(r.type).toBe('firstName');
    expect(r.confidence).toBe(100);
  });

  it('écarte « Nom d’utilisateur »', () => {
    expect(classifyField(input(), 'Nom d utilisateur').type).toBeNull();
  });
});
