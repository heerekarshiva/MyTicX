'use client';
import { useEffect, useState } from 'react';

/**
 * Show-time picker with an explicit AM / PM selector.
 *
 * A plain `<input type="time">` renders 12-hour with AM/PM or 24-hour
 * depending on the visitor's OS/browser locale, which made it genuinely
 * ambiguous when a seller typed "07:30" and a buyer's device rendered a
 * different picker. This component always presents hour / minute / AM-PM
 * explicitly, and reports the value back as a canonical 24-hour "HH:mm"
 * string — the same format already used everywhere else in the app
 * (movie provider show times, ticket verification matching, price calc,
 * and the database) — so nothing downstream needs to change.
 */
export function TimeInput({
  value,
  onChange,
  id
}: {
  value: string;
  onChange: (value24: string) => void;
  id?: string;
}) {
  const parsed = parse24h(value);
  const [hour12, setHour12] = useState(parsed?.hour12 ?? 7);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed?.period ?? 'PM');

  // Keep internal fields in sync if the parent resets/loads a value.
  useEffect(() => {
    const next = parse24h(value);
    if (next) {
      setHour12(next.hour12);
      setMinute(next.minute);
      setPeriod(next.period);
    }
  }, [value]);

  function emit(nextHour12: number, nextMinute: number, nextPeriod: 'AM' | 'PM') {
    onChange(to24h(nextHour12, nextMinute, nextPeriod));
  }

  return (
    <div id={id} className="flex items-center gap-2">
      <select
        aria-label="Hour"
        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-navy-900 focus:border-brand-blue focus:outline-none"
        value={hour12}
        onChange={e => {
          const h = Number(e.target.value);
          setHour12(h);
          emit(h, minute, period);
        }}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-slate-400">:</span>
      <select
        aria-label="Minute"
        className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-navy-900 focus:border-brand-blue focus:outline-none"
        value={minute}
        onChange={e => {
          const m = Number(e.target.value);
          setMinute(m);
          emit(hour12, m, period);
        }}
      >
        {Array.from({ length: 60 }, (_, i) => i).map(m => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
        ))}
      </select>
      <div className="flex overflow-hidden rounded-lg border border-slate-200">
        {(['AM', 'PM'] as const).map(p => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              period === p ? 'bg-brand-gradient text-white' : 'bg-white text-slate-500 hover:bg-slate-50'
            }`}
            onClick={() => {
              setPeriod(p);
              emit(hour12, minute, p);
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function parse24h(value: string | undefined | null): { hour12: number; minute: number; period: 'AM' | 'PM' } | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour24 < 0 || hour24 > 23 || minute < 0 || minute > 59) return null;
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, period };
}

function to24h(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let hour24 = hour12 % 12;
  if (period === 'PM') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
