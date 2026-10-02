// Dynamic participant-field validation. Used by the browser form AND the
// register API so both enforce exactly the same rules from the DB config.
export type FieldType = 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'dropdown' | 'date' | 'checkbox';
export const FIELD_TYPES: FieldType[] = ['text', 'textarea', 'email', 'phone', 'number', 'dropdown', 'date', 'checkbox'];

export interface FieldConfig {
  id?: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  placeholder?: string | null;
  options: string[];
  validation: { minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: string; patternMessage?: string };
  is_required: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+]?[0-9\s-]{7,15}$/;

export function sanitizeText(v: string): string {
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/[<>]/g, '').trim();
}

/** Returns {value} (normalised string, '' when empty+optional) or {error}. */
export function validateField(f: FieldConfig, raw: unknown): { value: string } | { error: string } {
  const str = typeof raw === 'string' ? raw : typeof raw === 'number' || typeof raw === 'boolean' ? String(raw) : '';
  const v = f.field_type === 'checkbox' ? (str === 'true' ? 'true' : 'false') : sanitizeText(str);
  const empty = f.field_type === 'checkbox' ? v !== 'true' : v === '';
  if (empty) return f.is_required ? { error: `${f.label} is required` } : { value: f.field_type === 'checkbox' ? 'false' : '' };
  const val = f.validation ?? {};
  if (f.field_type === 'email' && !EMAIL.test(v)) return { error: `${f.label} must be a valid email` };
  if (f.field_type === 'phone' && !PHONE.test(v)) return { error: `${f.label} must be a valid phone number` };
  if (f.field_type === 'number') {
    const n = Number(v);
    if (!Number.isFinite(n)) return { error: `${f.label} must be a number` };
    if (val.min !== undefined && n < val.min) return { error: `${f.label} must be at least ${val.min}` };
    if (val.max !== undefined && n > val.max) return { error: `${f.label} must be at most ${val.max}` };
  }
  if (f.field_type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: `${f.label} must be a valid date` };
  if (f.field_type === 'dropdown' && !f.options.includes(v)) return { error: `${f.label}: choose one of the listed options` };
  if (val.minLength !== undefined && v.length < val.minLength) return { error: `${f.label} must be at least ${val.minLength} characters` };
  const max = val.maxLength ?? (f.field_type === 'textarea' ? 1000 : 300);
  if (v.length > max) return { error: `${f.label} must be at most ${max} characters` };
  if (val.pattern) {
    try { if (!new RegExp(val.pattern).test(v)) return { error: val.patternMessage || `${f.label} is not in the expected format` }; } catch { /* bad admin regex: ignore */ }
  }
  return { value: v };
}

export function validateAnswers(fields: FieldConfig[], answers: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const values: Record<string, string> = {};
  for (const f of fields) {
    const r = validateField(f, answers?.[f.field_key]);
    if ('error' in r) errors[f.field_key] = r.error; else values[f.field_key] = r.value;
  }
  return { errors, values, ok: Object.keys(errors).length === 0 };
}

export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '');
  return d.length < 4 ? '****' : `${'*'.repeat(Math.max(0, d.length - 2))}${d.slice(-2)}`;
}
