import type { Profile, SemanticType } from '../types';
import { findDateOption, getDatePart } from '../datePart';
import { normalizeForType, toDateISO } from '../normalize';

export function resolveValue(
  profile: Profile,
  type: SemanticType | null,
): string | null {
  if (!type) return null;
  const direct = profile.fields.find((f) => f.type === type);
  if (direct?.value) return direct.value;

  // Fallbacks sémantiques sécurisés
  if (type === 'passportNumber' || type === 'idCardNumber') {
    const fallback = profile.fields.find(
      (f) => (f.type === 'idCardNumber' || f.type === 'passportNumber') && f.value,
    );
    if (fallback) return fallback.value;
  }

  if (type === 'addressLine1' || type === 'residence') {
    const fallback = profile.fields.find(
      (f) => (f.type === 'residence' || f.type === 'addressLine1') && f.value,
    );
    if (fallback) return fallback.value;
  }

  if (type === 'country' || type === 'birthCountry') {
    const fallback = profile.fields.find(
      (f) => (f.type === 'birthCountry' || f.type === 'country') && f.value,
    );
    if (fallback) return fallback.value;
  }

  if (type === 'city' || type === 'birthCity') {
    const fallback = profile.fields.find(
      (f) => (f.type === 'birthCity' || f.type === 'city') && f.value,
    );
    if (fallback) return fallback.value;
  }

  return null;
}

export function applyValue(
  el: HTMLElement,
  rawValue: string,
): boolean {
  if (el instanceof HTMLSelectElement) {
    // Date en trois listes (Jour / Mois / Année) : on place la bonne partie
    const datePart = getDatePart(el);
    const iso = datePart ? toDateISO(rawValue) : null;
    if (datePart && iso) {
      const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
      const option = findDateOption(el, datePart, { day, month, year });
      if (!option) return false;
      setSelectValue(el, option.value);
      return true;
    }

    const options = Array.from(el.options);
    const normalized = rawValue.trim().toLowerCase();
    // 1. Correspondance exacte
    let match = options.find(
      (o) =>
        o.value.trim().toLowerCase() === normalized ||
        (o.textContent ?? '').trim().toLowerCase() === normalized,
    );
    // 2. Correspondance souple (ex: "M." pour "Monsieur", inclusion)
    if (!match && normalized) {
      if (normalized === 'monsieur' || normalized === 'm.') {
        match = options.find((o) => {
          const t = (o.textContent || o.value).trim().toLowerCase();
          return t === 'm.' || t === 'mr' || t === 'monsieur' || t === 'm';
        });
      } else if (normalized === 'madame' || normalized === 'mme') {
        match = options.find((o) => {
          const t = (o.textContent || o.value).trim().toLowerCase();
          return t === 'mme' || t === 'mrs' || t === 'madame';
        });
      } else {
        match = options.find(
          (o) =>
            (o.textContent ?? '').trim().toLowerCase().includes(normalized) ||
            normalized.includes((o.textContent ?? '').trim().toLowerCase()),
        );
      }
    }
    if (!match) return false;
    setSelectValue(el, match.value);
    return true;
  }

  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    const target = rawValue.trim().toLowerCase();
    const value = (el.value || 'on').trim().toLowerCase();
    const label = el.closest('label')?.textContent?.trim().toLowerCase() ?? '';
    const shouldCheck =
      !target || value === target || label.includes(target) || target === 'true';
    if (el.checked !== shouldCheck) {
      el.click();
    }
    return true;
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    let value = normalizeForType(null, rawValue);
    if (el instanceof HTMLInputElement && el.type === 'date') {
      value = toDateISO(value) ?? '';
    }
    setNativeValue(el, value);
    return true;
  }

  return false;
}

export function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
}

function setSelectValue(el: HTMLSelectElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value',
  );
  if (descriptor?.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}

export interface UndoEntry {
  el: HTMLElement;
  prevValue: string;
  prevChecked: boolean;
  prevSelectedIndex: number;
}

export function snapshot(el: HTMLElement): UndoEntry {
  if (el instanceof HTMLSelectElement) {
    return {
      el,
      prevValue: el.value,
      prevChecked: false,
      prevSelectedIndex: el.selectedIndex,
    };
  }
  if (el instanceof HTMLInputElement) {
    return {
      el,
      prevValue: el.value,
      prevChecked: el.checked,
      prevSelectedIndex: -1,
    };
  }
  if (el instanceof HTMLTextAreaElement) {
    return { el, prevValue: el.value, prevChecked: false, prevSelectedIndex: -1 };
  }
  return { el, prevValue: '', prevChecked: false, prevSelectedIndex: -1 };
}

export function restore(entry: UndoEntry): void {
  const { el } = entry;
  if (el instanceof HTMLSelectElement) {
    setSelectValue(el, entry.prevValue);
    return;
  }
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked !== entry.prevChecked) el.click();
      return;
    }
    setNativeValue(el, entry.prevValue);
    return;
  }
  if (el instanceof HTMLTextAreaElement) {
    setNativeValue(el, entry.prevValue);
  }
}

/**
 * FR-21 — inject a file into an input[type=file] via DataTransfer.
 * @param el       The file input element.
 * @param dataUrl  A base64 data: URL (e.g. "data:image/jpeg;base64,/9j/...").
 * @param mimeType MIME type of the file (e.g. "image/jpeg").
 * @param fileName Original filename (e.g. "passport.jpg").
 * @returns true if the file was successfully injected.
 */
export function applyFileValue(
  el: HTMLInputElement,
  dataUrl: string,
  mimeType: string,
  fileName: string,
): boolean {
  if (el.type !== 'file') return false;
  try {
    const [, base64] = dataUrl.split(',');
    if (!base64) return false;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });

    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}
