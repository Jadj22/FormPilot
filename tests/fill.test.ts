// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { applyValue, restore, snapshot } from '~/lib/fill/fill';

describe('applyValue on date inputs', () => {
  it('fills input[type=date] with ISO format from JJ/MM/AAAA', () => {
    const el = document.createElement('input');
    el.type = 'date';
    document.body.appendChild(el);
    expect(applyValue(el, '17/05/1990')).toBe(true);
    expect(el.value).toBe('1990-05-17');
    el.remove();
  });

  it('fills input[type=date] when value is already ISO', () => {
    const el = document.createElement('input');
    el.type = 'date';
    document.body.appendChild(el);
    expect(applyValue(el, '1990-05-17')).toBe(true);
    expect(el.value).toBe('1990-05-17');
    el.remove();
  });

  it('fills input[type=date] with French text date "07 novembre 1993"', () => {
    const el = document.createElement('input');
    el.type = 'date';
    document.body.appendChild(el);
    expect(applyValue(el, '07 novembre 1993')).toBe(true);
    expect(el.value).toBe('1993-11-07');
    el.remove();
  });

  it('dispatches input and change events (React-compatible)', () => {
    const el = document.createElement('input');
    el.type = 'date';
    document.body.appendChild(el);
    let events: string[] = [];
    el.addEventListener('input', () => events.push('input'));
    el.addEventListener('change', () => events.push('change'));
    applyValue(el, '17/05/1990');
    expect(events).toContain('input');
    expect(events).toContain('change');
    el.remove();
  });
});

describe('applyValue on select inputs', () => {
  it('selects civil title gracefully (e.g. Monsieur -> M.)', () => {
    const select = document.createElement('select');
    const optEmpty = document.createElement('option');
    optEmpty.value = '';
    const optM = document.createElement('option');
    optM.value = 'M.';
    optM.textContent = 'M.';
    const optMme = document.createElement('option');
    optMme.value = 'Mme';
    optMme.textContent = 'Mme';
    select.appendChild(optEmpty);
    select.appendChild(optM);
    select.appendChild(optMme);
    document.body.appendChild(select);

    expect(applyValue(select, 'Monsieur')).toBe(true);
    expect(select.value).toBe('M.');
    select.remove();
  });
});

describe('undo', () => {
  it('restores the previous value', () => {
    const el = document.createElement('input');
    el.type = 'text';
    el.value = 'avant';
    document.body.appendChild(el);
    const entry = snapshot(el);
    applyValue(el, 'après');
    expect(el.value).toBe('après');
    restore(entry);
    expect(el.value).toBe('avant');
    el.remove();
  });
});
