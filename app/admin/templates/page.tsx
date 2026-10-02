'use client';
import { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AdminShell, api, Toggle, selectCls } from '@/components/events/AdminShell';

export default function TemplatesAdmin() {
  const [items, setItems] = useState<any[]>([]); const [types, setTypes] = useState<any[]>([]); const [defs, setDefs] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null); const [msg, setMsg] = useState('');
  const load = () => Promise.all([api('/api/admin/templates'), api('/api/admin/event-types'), api('/api/admin/fields')]).then(([t, ty, f]) => { setItems(t.data.items ?? []); setTypes(ty.data.items ?? []); setDefs(f.data.items ?? []); if (!t.ok) setMsg(t.error ?? ''); });
  useEffect(() => { load(); }, []);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const label = (id: string) => defs.find(d => d.id === id)?.label ?? '?';
  const move = (i: number, d: -1 | 1) => { const a = [...form.fields]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set('fields', a); };
  async function save() {
    const { created_at, ...body } = form;
    const r = await api('/api/admin/templates', 'POST', { ...body, fields: form.fields.map((f: any) => ({ field_definition_id: f.field_definition_id, is_required: f.is_required })) });
    if (!r.ok) return setMsg(r.error ?? ''); setForm(null); setMsg(''); load();
  }
  return (
    <AdminShell title="Event templates" action={<Button onClick={() => setForm({ event_type_id: types[0]?.id, name: '', description: '', is_default: false, allow_customization: true, is_active: true, fields: [] })}>+ New template</Button>}>
      {msg && <p className="mb-3 text-sm text-rose-600" role="alert">{msg}</p>}
      {form && (
        <Card className="mb-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-xs text-slate-500">Name</label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div><label className="mb-1 block text-xs text-slate-500">Event type</label><select className={selectCls} value={form.event_type_id} onChange={e => set('event_type_id', e.target.value)}>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs text-slate-500">Description</label><Input value={form.description ?? ''} onChange={e => set('description', e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap gap-4"><Toggle label="Default for this type" checked={form.is_default} onChange={v => set('is_default', v)} /><Toggle label="Organizers may customize fields" checked={form.allow_customization} onChange={v => set('allow_customization', v)} /><Toggle label="Active" checked={form.is_active} onChange={v => set('is_active', v)} /></div>
          <div>
            <p className="mb-2 text-sm font-medium text-navy-900">Fields (in order)</p>
            <ul className="space-y-1.5">
              {form.fields.map((f: any, i: number) => (
                <li key={f.field_definition_id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm">
                  <span className="flex-1">{label(f.field_definition_id)}</span>
                  <select className="rounded border border-slate-200 bg-white px-1 text-xs" value={f.is_required ? 'r' : 'o'} onChange={e => set('fields', form.fields.map((x: any, k: number) => k === i ? { ...x, is_required: e.target.value === 'r' } : x))}><option value="r">Required</option><option value="o">Optional</option></select>
                  <button aria-label="Up" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button><button aria-label="Down" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                  <button aria-label="Remove" className="text-rose-600" onClick={() => set('fields', form.fields.filter((_: any, k: number) => k !== i))}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
            <select className={`${selectCls} mt-2`} value="" onChange={e => e.target.value && set('fields', [...form.fields, { field_definition_id: e.target.value, is_required: defs.find(d => d.id === e.target.value)?.default_required ?? false }])}>
              <option value="">+ Add a field…</option>{defs.filter(d => d.is_active && !form.fields.some((f: any) => f.field_definition_id === d.id)).map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2"><Button onClick={save}>Save template</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
        </Card>
      )}
      <div className="space-y-2">
        {items.map(t => (
          <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3 !p-4">
            <div><div className="flex items-center gap-2"><span className="font-semibold text-navy-900">{t.name}</span>{t.is_default && <Badge tone="info">default</Badge>}{!t.is_active && <Badge>inactive</Badge>}</div>
              <p className="text-xs text-slate-500">{types.find(x => x.id === t.event_type_id)?.name} · {t.fields.map((f: any) => label(f.field_definition_id)).join(', ')}</p></div>
            <div className="flex gap-1.5"><Button size="sm" variant="outline" onClick={() => setForm({ ...t, fields: [...t.fields] })}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={async () => { if (confirm('Delete template?')) { await api(`/api/admin/templates?id=${t.id}`, 'DELETE'); load(); } }}>Delete</Button></div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
