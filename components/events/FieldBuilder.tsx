'use client';
import { useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FIELD_TYPES } from '@/lib/events/fields';

export interface BuilderField {
  uid: string; definitionId?: string | null; key?: string; label: string; type: string; placeholder?: string | null; options?: string[]; required: boolean; custom?: boolean;
}
export interface LibraryField { id: string; key: string; label: string; field_type: string; options: string[]; default_required: boolean; placeholder?: string | null }

const sel = 'min-h-[40px] rounded-lg border border-slate-200 bg-white px-2 text-sm text-navy-900 outline-none focus:border-brand-blue';
let n = 0; const uid = () => `u${Date.now()}_${n++}`;
export const fromLibrary = (d: LibraryField, required = d.default_required): BuilderField => ({ uid: uid(), definitionId: d.id, key: d.key, label: d.label, type: d.field_type, placeholder: d.placeholder, options: d.options, required });

/** Organizer-side participant field picker: toggle library fields, add custom, edit, reorder, required/optional. */
export function FieldBuilder({ value, onChange, library, allowCustom, allowEditing, maxCustom, disabled }: {
  value: BuilderField[]; onChange: (v: BuilderField[]) => void; library: LibraryField[]; allowCustom: boolean; allowEditing: boolean; maxCustom: number; disabled?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [custom, setCustom] = useState({ label: '', type: 'text', options: '' });
  const [err, setErr] = useState('');
  const chosen = new Set(value.map(v => v.definitionId).filter(Boolean));
  const lock = disabled || !allowEditing;

  const toggle = (d: LibraryField) => onChange(chosen.has(d.id) ? value.filter(v => v.definitionId !== d.id) : [...value, fromLibrary(d)]);
  const move = (i: number, dir: -1 | 1) => { const a = [...value]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; onChange(a); };
  const patch = (u: string, p: Partial<BuilderField>) => onChange(value.map(v => v.uid === u ? { ...v, ...p } : v));

  function addCustom() {
    setErr('');
    const label = custom.label.trim();
    if (!label) return setErr('Give the field a name.');
    const options = custom.options.split(',').map(s => s.trim()).filter(Boolean);
    if (custom.type === 'dropdown' && options.length < 2) return setErr('Dropdown needs at least two comma-separated options.');
    if (value.filter(v => v.custom).length >= maxCustom) return setErr(`You can add up to ${maxCustom} custom fields.`);
    onChange([...value, { uid: uid(), label, type: custom.type, options, required: false, custom: true }]);
    setCustom({ label: '', type: 'text', options: '' });
  }

  return (
    <div className="space-y-4">
      {!lock && (
        <div>
          <p className="mb-2 text-sm font-medium text-navy-900">What information should participants provide?</p>
          <div className="flex flex-wrap gap-2">
            {library.map(d => (
              <button key={d.id} type="button" onClick={() => toggle(d)} aria-pressed={chosen.has(d.id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${chosen.has(d.id) ? 'border-brand-blue bg-brand-blue/10 font-medium text-brand-bluedark' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                {chosen.has(d.id) ? '✓ ' : ''}{d.label}
              </button>
            ))}
          </div>
        </div>
      )}
      {lock && <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">The fields below are set by MyTICX for this template and can’t be changed.</p>}

      <ul className="space-y-2">
        {value.length === 0 && <li className="text-sm text-slate-400">No fields selected yet.</li>}
        {value.map((f, i) => (
          <li key={f.uid} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-[8rem] flex-1 text-sm font-medium text-navy-900">{f.label} <span className="text-xs font-normal text-slate-400">· {f.type}</span></span>
              <select aria-label={`${f.label} required`} className={sel} value={f.required ? 'req' : 'opt'} disabled={disabled} onChange={e => patch(f.uid, { required: e.target.value === 'req' })}>
                <option value="req">Required</option><option value="opt">Optional</option>
              </select>
              {!lock && <>
                <button type="button" aria-label="Edit" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setEditing(editing === f.uid ? null : f.uid)}><Pencil className="h-4 w-4" /></button>
                <button type="button" aria-label="Move up" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                <button type="button" aria-label="Move down" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                <button type="button" aria-label="Remove" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" onClick={() => onChange(value.filter(v => v.uid !== f.uid))}><Trash2 className="h-4 w-4" /></button>
              </>}
            </div>
            {editing === f.uid && !lock && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div><label className="mb-1 block text-xs text-slate-500">Label</label><Input value={f.label} onChange={e => patch(f.uid, { label: e.target.value })} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Placeholder</label><Input value={f.placeholder ?? ''} onChange={e => patch(f.uid, { placeholder: e.target.value })} /></div>
                {f.custom && <div><label className="mb-1 block text-xs text-slate-500">Type</label>
                  <select className={`${sel} w-full`} value={f.type} onChange={e => patch(f.uid, { type: e.target.value })}>{FIELD_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>}
                {f.custom && f.type === 'dropdown' && <div><label className="mb-1 block text-xs text-slate-500">Options (comma separated)</label>
                  <Input value={(f.options ?? []).join(', ')} onChange={e => patch(f.uid, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} /></div>}
              </div>
            )}
          </li>
        ))}
      </ul>

      {allowCustom && !lock && (
        <div className="rounded-xl border border-dashed border-slate-300 p-3">
          <p className="mb-2 text-sm font-medium text-navy-900">Add a custom field</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_10rem]">
            <Input placeholder='Field name, e.g. "Branch"' value={custom.label} onChange={e => setCustom({ ...custom, label: e.target.value })} />
            <select className={`${sel} w-full`} value={custom.type} onChange={e => setCustom({ ...custom, type: e.target.value })}>{FIELD_TYPES.map(t => <option key={t}>{t}</option>)}</select>
          </div>
          {custom.type === 'dropdown' && <Input className="mt-2" placeholder="Options, comma separated: CSE, ECE, EEE" value={custom.options} onChange={e => setCustom({ ...custom, options: e.target.value })} />}
          {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addCustom}><Plus className="h-4 w-4" /> Add field</Button>
        </div>
      )}
    </div>
  );
}
