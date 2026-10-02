'use client';
import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

/**
 * Fixed-length numeric OTP input rendered as N boxes (default 6).
 * Prevents the exact bug this replaced: a free-text field let people type
 * (or paste) more digits than the code actually is, which silently failed
 * validation with no clue why. This component hard-caps input at `length`
 * digits, strips anything non-numeric, and supports pasting a full code.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = true,
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) inputsRef.current[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  function setDigitAt(index: number, char: string) {
    const next = digits.slice();
    next[index] = char;
    onChange(next.join('').slice(0, length));
  }

  function handleChange(index: number, raw: string) {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      setDigitAt(index, '');
      return;
    }
    // Handles a fast typist or a paste landing in a single box: spread the
    // digits across this box and the following ones instead of overflowing.
    const chars = clean.split('');
    const next = digits.slice();
    let cursor = index;
    for (const c of chars) {
      if (cursor >= length) break;
      next[cursor] = c;
      cursor++;
    }
    onChange(next.join('').slice(0, length));
    const focusIndex = Math.min(cursor, length - 1);
    inputsRef.current[focusIndex]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
      setDigitAt(index - 1, '');
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label={`${length}-digit verification code`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { inputsRef.current[i] = el; }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={d}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={cn(
            'h-12 w-10 rounded-xl border border-slate-200 bg-white text-center text-lg font-semibold text-navy-900',
            'outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20',
            'disabled:opacity-50 sm:h-14 sm:w-12'
          )}
        />
      ))}
    </div>
  );
}
