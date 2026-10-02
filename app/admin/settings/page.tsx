'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AdminShell, api, Toggle } from '@/components/events/AdminShell';

const numbers: [string, string][] = [
  ['registration_cutoff_minutes', 'Registration closes N minutes before event start'], ['max_price', 'Maximum registration price (₹)'], ['max_poster_mb', 'Maximum poster size (MB)'],
  ['max_custom_fields', 'Max custom fields per event'], ['pending_payment_hold_minutes', 'Release unpaid registrations after (minutes)']
];
const toggles: [string, string][] = [
  ['organizer_auto_approve', 'Auto-approve new organizers (off = admin must approve)'], ['allow_paid_events', 'Allow paid events'],
  ['notify_organizer_on_registration', 'Notify organizer on each registration'], ['organize_nav_enabled', 'Show “Organize Your Event” in the navigation']
];

export default function SettingsAdmin() {
  const [s, setS] = useState<any>(null); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false);
  useEffect(() => { api('/api/admin/settings').then(r => r.ok ? setS(r.data.settings) : setMsg(r.error ?? '')); }, []);
  async function save() {
    setOk(false); const { currency, ...body } = s;
    const r = await api('/api/admin/settings', 'PATCH', body); if (!r.ok) return setMsg(r.error ?? ''); setMsg(''); setS(r.data.settings); setOk(true);
  }
  if (!s) return <AdminShell title="Platform settings">{msg ? <p className="text-sm text-rose-600">{msg}</p> : <p className="text-sm text-slate-500">Loading…</p>}</AdminShell>;
  return (
    <AdminShell title="Platform settings">
      <Card className="max-w-2xl space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {numbers.map(([k, l]) => <div key={k}><label className="mb-1 block text-xs text-slate-500">{l}</label><Input type="number" value={s[k]} onChange={e => setS({ ...s, [k]: e.target.value })} /></div>)}
          <div><label className="mb-1 block text-xs text-slate-500">Timezone (IANA, e.g. Asia/Kolkata)</label><Input value={s.timezone} onChange={e => setS({ ...s, timezone: e.target.value })} /></div>
          <div><label className="mb-1 block text-xs text-slate-500">Navigation label</label><Input value={s.organize_nav_label} onChange={e => setS({ ...s, organize_nav_label: e.target.value })} /></div>
        </div>
        <div className="space-y-2">{toggles.map(([k, l]) => <Toggle key={k} label={l} checked={!!s[k]} onChange={v => setS({ ...s, [k]: v })} />)}</div>
        <p className="text-xs text-slate-500">A changed cutoff applies to events saved or edited afterwards; already-published events keep the deadline they were created with.</p>
        {msg && <p className="text-sm text-rose-600" role="alert">{msg}</p>}{ok && <p className="text-sm text-emerald-700">Saved.</p>}
        <Button onClick={save}>Save settings</Button>
      </Card>
    </AdminShell>
  );
}
