export function normalizePhone(value: string, countryCode = 'TG'): string {
  let digits = value.replace(/\D/g, '');
  if (!digits) return value;
  if (digits.startsWith('00')) digits = digits.slice(2);
  const dialCodes: Record<string, string> = { TG: '228', FR: '33', BE: '32', CH: '41', SN: '221', CI: '225' };
  const dial = dialCodes[countryCode] ?? '228';
  if (!digits.startsWith(dial)) {
    if (digits.length <= 8) digits = dial + digits;
  }
  return `+${digits}`;
}

export const FRENCH_MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

export interface DateParts {
  day: string; // '01'..'31'
  month: string; // '01'..'12'
  year: string; // '1993'
}

export function parseDateParts(value: string): DateParts | null {
  if (!value) return null;
  const trimmed = value.trim();

  // YYYY-MM-DD
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso && iso[1] && iso[2] && iso[3]) {
    return { day: iso[3], month: iso[2], year: iso[1] };
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmy = trimmed.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (dmy && dmy[1] && dmy[2] && dmy[3]) {
    return {
      day: dmy[1].padStart(2, '0'),
      month: dmy[2].padStart(2, '0'),
      year: dmy[3],
    };
  }

  // DD mois YYYY (ex: "07 novembre 1993", "7 nov 1993", "18 février 2024", "18 fevrier 2024")
  const textMatch = trimmed.match(/^(\d{1,2})\s+([^\d\s]+)\s+(\d{4})$/u);
  if (textMatch && textMatch[1] && textMatch[2] && textMatch[3]) {
    const rawMonth = textMatch[2]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const monthIndex = FRENCH_MONTHS.findIndex((m) => {
      const cleanM = m.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return cleanM.startsWith(rawMonth) || rawMonth.startsWith(cleanM.slice(0, 3));
    });
    if (monthIndex !== -1) {
      return {
        day: textMatch[1].padStart(2, '0'),
        month: String(monthIndex + 1).padStart(2, '0'),
        year: textMatch[3],
      };
    }
  }

  return null;
}

export function formatDateFrench(value: string): string {
  const parts = parseDateParts(value);
  if (!parts) return value;
  const mIndex = parseInt(parts.month, 10) - 1;
  const monthName = FRENCH_MONTHS[mIndex] ?? parts.month;
  return `${parts.day} ${monthName} ${parts.year}`;
}

export function normalizeDate(value: string): string {
  const parts = parseDateParts(value);
  if (parts) return `${parts.day}/${parts.month}/${parts.year}`;
  return value;
}

export function toDateISO(value: string): string | null {
  const parts = parseDateParts(value);
  if (parts) return `${parts.year}-${parts.month}-${parts.day}`;
  return null;
}

export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeForType(
  type: string | null,
  value: string,
): string {
  if (!type) return value;
  if (type === 'phoneMobile' || type === 'phoneHome') return normalizePhone(value);
  if (type === 'birthDate' || type === 'idIssueDate' || type === 'idExpiryDate') {
    return normalizeDate(value);
  }
  if (type === 'lastName' || type === 'firstName' || type === 'fullName') {
    return normalizeName(value);
  }
  return value;
}
