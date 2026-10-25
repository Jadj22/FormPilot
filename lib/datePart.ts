/**
 * Dates réparties sur trois <select> (Jour / Mois / Année).
 *
 * Beaucoup de sites (dont les formulaires de billetterie) n'utilisent pas
 * <input type="date"> mais trois listes. On reconnaît le rôle de chaque liste
 * d'après ses options, pas d'après son nom (souvent opaque : q3[d], q3[m]…).
 */

export type DatePart = 'day' | 'month' | 'year';

// Début de mois en français et en anglais, sans accents.
const MONTH_PREFIXES: ReadonlyArray<readonly string[]> = [
  ['jan'],
  ['fev', 'feb'],
  ['mar'],
  ['avr', 'apr'],
  ['mai', 'may'],
  ['juin', 'jun'],
  ['juil', 'jul'],
  ['aou', 'aug'],
  ['sep'],
  ['oct'],
  ['nov'],
  ['dec'],
];

function clean(text: string | null | undefined): string {
  return (text ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Numéro de mois (1-12) d'après un nom de mois, ou null. */
export function monthFromName(text: string): number | null {
  const t = clean(text);
  if (t.length < 3 || /\d/.test(t)) return null;
  const idx = MONTH_PREFIXES.findIndex((prefixes) => prefixes.some((p) => t.startsWith(p)));
  return idx === -1 ? null : idx + 1;
}

/** Rôle d'une liste dans une date : jour, mois ou année (null si ce n'en est pas une). */
export function getDatePart(el: HTMLSelectElement): DatePart | null {
  const texts = Array.from(el.options).map((o) => clean(o.textContent));

  // Mois écrits en toutes lettres : il faut les 12.
  const named = texts.filter((t) => monthFromName(t) !== null);
  if (named.length >= 12 && new Set(named.map((t) => monthFromName(t))).size === 12) {
    return 'month';
  }

  const nums = texts.filter((t) => /^\d{1,4}$/.test(t)).map(Number);
  if (nums.length < 12) return null;
  const max = Math.max(...nums);
  const min = Math.min(...nums);

  const yearLike = nums.filter((n) => n >= 1900 && n <= 2100).length;
  if (yearLike >= 10 && yearLike / nums.length >= 0.8) return 'year';
  if (min >= 1 && max <= 12 && nums.length <= 13) return 'month';
  if (min >= 1 && max >= 28 && max <= 31) return 'day';
  return null;
}

/**
 * Libellé d'une date en trois listes : seule la première liste est en général
 * reliée à un <label>. On regarde les listes voisines (même parent) puis le
 * <label> du conteneur.
 */
export function dateGroupLabel(el: HTMLSelectElement): string {
  if (!getDatePart(el)) return '';
  const parent = el.parentElement;
  if (!parent) return '';

  const siblings = Array.from(parent.querySelectorAll('select')).filter(
    (s) => getDatePart(s) !== null,
  );
  const parts = new Set(siblings.map((s) => getDatePart(s)));
  if (siblings.length < 2 || parts.size < 2) return ''; // pas un groupe de date

  const texts: string[] = [];
  for (const s of siblings) {
    if (s === el || !s.id) continue;
    const label = el.ownerDocument.querySelector(`label[for="${CSS.escape(s.id)}"]`);
    if (label?.textContent) texts.push(label.textContent);
  }
  const containerLabel = parent.parentElement?.querySelector(':scope > label');
  if (containerLabel?.textContent) texts.push(containerLabel.textContent);
  return texts.join(' ');
}

/** Choisit l'option correspondant à `value` (jour, mois ou année) dans la liste. */
export function findDateOption(
  el: HTMLSelectElement,
  part: DatePart,
  value: { day: number; month: number; year: number },
): HTMLOptionElement | undefined {
  const options = Array.from(el.options);
  return options.find((o) => {
    const text = clean(o.textContent);
    if (part === 'month') {
      const byName = monthFromName(text);
      if (byName !== null) return byName === value.month;
      return /^\d+$/.test(text) && Number(text) === value.month;
    }
    const target = part === 'day' ? value.day : value.year;
    return /^\d+$/.test(text) && Number(text) === target;
  });
}
