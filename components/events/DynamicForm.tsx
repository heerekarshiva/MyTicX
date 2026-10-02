'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { validateAnswers, type FieldConfig } from '@/lib/events/fields';

const selectCls = 'min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-navy-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20';

/**
 * The ONE reusable participant form. It renders whatever fields the event's
 * configuration contains (event_fields) — there is no per-event code. Used for
 * live registration and for the organizer's preview. Same validator as the API.
 */
export function DynamicForm({ fields, onSubmit, submitLabel = 'Register', loading, serverErrors, preview }: {
  fields: FieldConfig[]; onSubmit?: (answers: Record<string, string>) => void; submitLabel?: string;
  loading?: boolean; serverErrors?: Record<string, string>; preview?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => { setValues(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })); };
  const shown = { ...errors, ...(serverErrors ?? {}) };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview) return;
    const r = validateAnswers(fields, values);
    setErrors(r.errors);
    if (r.ok) onSubmit?.(r.values);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {fields.map(f => {
        const id = `f_${f.field_key}`; const err = shown[f.field_key];
        return (
          <div key={f.field_key}>
            {f.field_type === 'checkbox' ? (
              <label className="flex items-start gap-2 text-sm text-navy-900">
                <input type="checkbox" id={id} checked={values[f.field_key] === 'true'} onChange={e => set(f.field_key, e.target.checked ? 'true' : 'false')} className="mt-0.5 h-4 w-4 accent-[#FF7A00]" />
                <span>{f.label}{f.is_required && <span className="text-rose-600"> *</span>}</span>
              </label>
            ) : (
              <>
                <label htmlFor={id} className="mb-1 block text-sm font-medium text-navy-900">{f.label}{f.is_required && <span className="text-rose-600"> *</span>}</label>
                {f.field_type === 'dropdown' ? (
                  <select id={id} className={selectCls} value={values[f.field_key] ?? ''} onChange={e => set(f.field_key, e.target.value)}>
                    <option value="">Select…</option>{f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.field_type === 'textarea' ? (
                  <textarea id={id} rows={3} placeholder={f.placeholder ?? ''} value={values[f.field_key] ?? ''} onChange={e => set(f.field_key, e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-navy-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20" />
                ) : (
                  <Input id={id} type={f.field_type === 'number' ? 'number' : f.field_type === 'date' ? 'date' : f.field_type === 'email' ? 'email' : f.field_type === 'phone' ? 'tel' : 'text'}
                    inputMode={f.field_type === 'phone' || f.field_type === 'number' ? 'numeric' : undefined} placeholder={f.placeholder ?? ''}
                    value={values[f.field_key] ?? ''} onChange={e => set(f.field_key, e.target.value)} />
                )}
              </>
            )}
            {err && <p className="mt-1 text-xs text-rose-600" role="alert">{err}</p>}
          </div>
        );
      })}
      {!preview && <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Please wait…' : submitLabel}</Button>}
    </form>
  );
}
