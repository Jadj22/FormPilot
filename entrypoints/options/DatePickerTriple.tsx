import React, { useMemo } from 'react';
import {
  parseDateParts,
  formatDateFrench,
  FRENCH_MONTHS,
} from '~/lib/normalize';

interface DatePickerTripleProps {
  value: string;
  onChange: (newValue: string) => void;
}

export function DatePickerTriple({ value, onChange }: DatePickerTripleProps) {
  const parts = useMemo(() => parseDateParts(value), [value]);

  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(currentYear + 15 - i));

  const update = (field: 'day' | 'month' | 'year', val: string) => {
    const d = field === 'day' ? val : parts?.day || '01';
    const m = field === 'month' ? val : parts?.month || '01';
    const y = field === 'year' ? val : parts?.year || String(currentYear);
    onChange(`${y}-${m}-${d}`);
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Jour */}
        <select
          value={parts?.day || ''}
          onChange={(e) => update('day', e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
        >
          <option value="">Jour</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        {/* Mois */}
        <select
          value={parts?.month || ''}
          onChange={(e) => update('month', e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
        >
          <option value="">Mois</option>
          {FRENCH_MONTHS.map((name, idx) => {
            const m = String(idx + 1).padStart(2, '0');
            return (
              <option key={m} value={m}>
                {name}
              </option>
            );
          })}
        </select>

        {/* Année */}
        <select
          value={parts?.year || ''}
          onChange={(e) => update('year', e.target.value)}
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-xs text-neutral-200"
        >
          <option value="">Année</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {parts && (
          <span className="text-xs text-sky-400 font-medium ml-1">
            {formatDateFrench(`${parts.year}-${parts.month}-${parts.day}`)}
          </span>
        )}
      </div>
    </div>
  );
}
