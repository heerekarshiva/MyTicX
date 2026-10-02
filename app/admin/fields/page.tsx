'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AdminShell, api, Toggle, selectCls } from '@/components/events/AdminShell';
import { DynamicForm } from '@/components/events/DynamicForm';
import { FIELD_TYPES } from '@/lib/events/fields';

const blank = { key: '', label: '', field_type: 'text', placeholder: '', options: [] as string[], validation: {} as any, default_required: false, is_active: true, sort_order: 0 };

export default function FieldBuilderAdmin() {
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState<any>(null); const [msg, setMsg] = useState('');
  const load = () => api('/api/admin/fields').then(r => r.ok ? setItems(r.data.items) : setMsg(r.error ?? ''));
  useEffect(() => { load(); }, []);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const setVal = (k: string, v: string) => setForm((p: any) => ({ ...p, validation: { ...p.validation, [k]: v === '' ? undefined : k === 'pattern' || k === 'patternMessage' ? v : Number(v) } }));
  async function save() {
    const { id, created_at, ...values } = form;
    const r = id ? await api('/api/admin/fields', 'PATCH', { id, values }) : await api('/api/admin/fields', 'POST', values);
    if (!r.ok) return setMsg(r.error ?? ''); setForm(null); setMsg(''); load();
  }
  async function del(id: string) { if (!confirm('Delete this field?')) return; const r = await api(`/api/admin/fields?id=${id}`, 'DELETE'); setMsg(r.error ?? ''); load(); }
  const previewField = form && { field_key: form.key || 'preview', label: form.label || 'Label', field_type: form.field_type, placeholder: form.placeholder, options: form.options, validation: form.validation, is_required: form.default_required };
  return (
    <AdminShell title="Participant field builder" action={<Button onClick={() => setForm({ ...blank })}>+ New field</Button>}>
      {msg && <p className="mb-3 text-sm text-rose-600" role="alert">{msg}</p>}
      {form && (
        <Card className="mb-4 grid gap-4 lg:grid-cols-[1fr_16rem]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className="mb-1 block text-xs text-slate-500">Label</label><Input value={form.label} onChange={e => set('label', e.target.value)} /></div>
              <div><label className="mb-1 block text-xs text-slate-500">Key (e.g. department)</label><Input disabled={!!form.id} value={form.key} onChange={e => set('key', e.target.value)} /></div>
              <div><label className="mb-1 block text-xs text-slate-500">Type</label><select className={selectCls} value={form.field_type} onChange={e => set('field_type', e.target.value)}>{FIELD_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div><label className="mb-1 block text-xs text-slate-500">Placeholder</label><Input value={form.placeholder ?? ''} onChange={e => set('placeholder', e.target.value)} /></div>
              {form.field_type === 'dropdown' && <div className="sm:col-span-2"><label className="mb-1 block text-xs text-slate-500">Options (comma separated)</label><Input value={form.options.join(', ')} onChange={e => set('options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} /></div>}
              {['text', 'textarea'].includes(form.field_type) && <>
                <div><label className="mb-1 block text-xs text-slate-500">Min length</label><Input type="number" value={form.validation.minLength ?? ''} onChange={e => setVal('minLength', e.target.value)} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Max length</label><Input type="number" value={form.validation.maxLength ?? ''} onChange={e => setVal('maxLength', e.target.value)} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Pattern (regex)</label><Input value={form.validation.pattern ?? ''} onChange={e => setVal('pattern', e.target.value)} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Pattern error message</label><Input value={form.validation.patternMessage ?? ''} onChange={e => setVal('patternMessage', e.target.value)} /></div></>}
              {form.field_type === 'number' && <>
                <div><label className="mb-1 block text-xs text-slate-500">Min</label><Input type="number" value={form.validation.min ?? ''} onChange={e => setVal('min', e.target.value)} /></div>
                <div><label className="mb-1 block text-xs text-slate-500">Max</label><Input type="number" value={form.validation.max ?? ''} onChange={e => setVal('max', e.target.value)} /></div></>}
            </div>
            <div className="flex flex-wrap gap-4"><Toggle label="Required by default" checked={form.default_required} onChange={v => set('default_required', v)} /><Toggle label="Active" checked={form.is_active} onChange={v => set('is_active', v)} /></div>
            <div className="flex gap-2"><Button onClick={save}>Save field</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="mb-2 text-xs font-semibold uppercase text-slate-400">Preview</p><DynamicForm key={JSON.stringify(previewField)} fields={[previewField]} preview /></div>
        </Card>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        {items.map(f => (
          <Card key={f.id} className="flex items-center justify-between gap-2 !p-3">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-navy-900">{f.label} <span className="font-normal text-slate-400">· {f.key}</span></p><div className="mt-1 flex gap-1.5"><Badge tone="info">{f.field_type}</Badge>{f.default_required && <Badge>required</Badge>}{!f.is_active && <Badge tone="danger">inactive</Badge>}</div></div>
            <div className="flex shrink-0 gap-1"><Button size="sm" variant="outline" onClick={() => setForm(f)}>Edit</Button><Button size="sm" variant="ghost" className="text-rose-600" onClick={() => del(f.id)}>Delete</Button></div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
