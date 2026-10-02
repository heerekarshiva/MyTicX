'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AdminShell, api, Toggle } from '@/components/events/AdminShell';

const blank = { key: '', name: '', description: '', icon: 'calendar', collect_college_name: false, allow_paid: true, allow_custom_fields: true, allow_field_editing: true, is_active: true, sort_order: 0 };

export default function EventTypesAdmin() {
  const [items, setItems] = useState<any[]>([]); const [form, setForm] = useState<any>(null); const [msg, setMsg] = useState('');
  const load = () => api('/api/admin/event-types').then(r => r.ok ? setItems(r.data.items) : setMsg(r.error ?? ''));
  useEffect(() => { load(); }, []);
  async function save() {
    const { id, created_at, ...values } = form;
    const r = id ? await api('/api/admin/event-types', 'PATCH', { id, values }) : await api('/api/admin/event-types', 'POST', values);
    if (!r.ok) return setMsg(r.error ?? ''); setForm(null); setMsg(''); load();
  }
  async function del(id: string) { if (!confirm('Delete this event type?')) return; const r = await api(`/api/admin/event-types?id=${id}`, 'DELETE'); setMsg(r.error ?? ''); load(); }
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  return (
    <AdminShell title="Event types" action={<Button onClick={() => setForm({ ...blank })}>+ New type</Button>}>
      {msg && <p className="mb-3 text-sm text-rose-600" role="alert">{msg}</p>}
      {form && (
        <Card className="mb-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-xs text-slate-500">Name</label><Input value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div><label className="mb-1 block text-xs text-slate-500">Key (lowercase_underscores)</label><Input disabled={!!form.id} value={form.key} onChange={e => set('key', e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="mb-1 block text-xs text-slate-500">Description shown on the card</label><Input value={form.description ?? ''} onChange={e => set('description', e.target.value)} /></div>
            <div><label className="mb-1 block text-xs text-slate-500">Icon (graduation-cap / calendar)</label><Input value={form.icon} onChange={e => set('icon', e.target.value)} /></div>
            <div><label className="mb-1 block text-xs text-slate-500">Sort order</label><Input type="number" value={form.sort_order} onChange={e => set('sort_order', Number(e.target.value))} /></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle label="Ask organizer for a college name" checked={form.collect_college_name} onChange={v => set('collect_college_name', v)} />
            <Toggle label="Allow paid registration" checked={form.allow_paid} onChange={v => set('allow_paid', v)} />
            <Toggle label="Organizers may add custom fields" checked={form.allow_custom_fields} onChange={v => set('allow_custom_fields', v)} />
            <Toggle label="Organizers may change template fields" checked={form.allow_field_editing} onChange={v => set('allow_field_editing', v)} />
            <Toggle label="Active (visible to organizers)" checked={form.is_active} onChange={v => set('is_active', v)} />
          </div>
          <div className="flex gap-2"><Button onClick={save}>Save</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
        </Card>
      )}
      <div className="space-y-2">
        {items.map(t => (
          <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3 !p-4">
            <div><div className="flex items-center gap-2"><span className="font-semibold text-navy-900">{t.name}</span><Badge tone={t.is_active ? 'success' : 'neutral'}>{t.is_active ? 'Active' : 'Disabled'}</Badge></div><p className="text-xs text-slate-500">{t.key} · {t.description}</p></div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setForm(t)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={async () => { await api('/api/admin/event-types', 'PATCH', { id: t.id, values: { is_active: !t.is_active } }); load(); }}>{t.is_active ? 'Disable' : 'Enable'}</Button>
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => del(t.id)}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
