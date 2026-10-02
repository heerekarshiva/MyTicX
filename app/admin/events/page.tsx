'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AdminShell, api, selectCls } from '@/components/events/AdminShell';
import { StatusBadge } from '@/components/events/StatusBadge';
import { fmtDateTime } from '@/lib/events/time';

export default function AdminEvents() {
  const [events, setEvents] = useState<any[]>([]);
  const [q, setQ] = useState(''); const [status, setStatus] = useState('');
  const [msg, setMsg] = useState(''); const [openId, setOpenId] = useState<string | null>(null); const [parts, setParts] = useState<any>(null);
  const load = () => api('/api/admin/events-manage').then(r => r.ok ? setEvents(r.data.events) : setMsg(r.error ?? ''));
  useEffect(() => { load(); }, []);
  const rows = useMemo(() => events.filter(e => (!status || e.status === status) && (!q || `${e.title} ${e.organizer_name} ${e.organizer_account_email} ${e.college_name ?? ''}`.toLowerCase().includes(q.toLowerCase()))), [events, q, status]);

  async function act(eventId: string, action: string) {
    if (['cancel', 'delete'].includes(action) && !confirm(`${action} this event?`)) return;
    const r = await api('/api/admin/events-manage', 'POST', { eventId, action }); setMsg(r.error ?? ''); load();
  }
  async function view(id: string) {
    if (openId === id) return setOpenId(null);
    setOpenId(id); setParts(null);
    const r = await api(`/api/organizer/events/${id}/participants`); setParts(r.ok ? r.data : { error: r.error });
  }
  return (
    <AdminShell title="All events">
      <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
        <Input placeholder="Search title, organizer, college…" value={q} onChange={e => setQ(e.target.value)} />
        <select className={selectCls} value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{['DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'SUSPENDED'].map(s => <option key={s}>{s}</option>)}</select>
      </div>
      {msg && <p className="mt-3 text-sm text-rose-600">{msg}</p>}
      <div className="mt-4 space-y-3">
        {rows.map(e => (
          <Card key={e.id} className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-navy-900">{e.title}</h3><StatusBadge status={e.status} /></div>
                <p className="mt-1 text-xs text-slate-500">{e.event_type} · {e.organizer_name} ({e.organizer_account_email}) · {e.start_at ? fmtDateTime(e.start_at, 'Asia/Kolkata') : 'No date'}</p>
                <p className="text-xs text-slate-500">{e.registrations} registrations · {e.checkIns} checked in · {e.registration_type === 'PAID' ? `₹${Number(e.amount)}` : 'Free'}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {e.status !== 'DRAFT' && <Link href={`/events/${e.id}`} target="_blank"><Button size="sm" variant="outline">View</Button></Link>}
                <Link href={`/organize-event?edit=${e.id}`} target="_blank"><Button size="sm" variant="outline">Edit</Button></Link>
                <Button size="sm" variant="outline" onClick={() => view(e.id)}>Registrations</Button>
                {e.status === 'SUSPENDED' ? <Button size="sm" variant="ghost" onClick={() => act(e.id, 'unsuspend')}>Reactivate</Button> : !['CANCELLED', 'COMPLETED', 'DRAFT'].includes(e.status) && <Button size="sm" variant="ghost" onClick={() => act(e.id, 'suspend')}>Suspend</Button>}
                {!['CANCELLED', 'COMPLETED'].includes(e.status) && <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => act(e.id, 'cancel')}>Cancel</Button>}
                <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => act(e.id, 'delete')}>Delete</Button>
              </div>
            </div>
            {openId === e.id && (
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                {!parts && <p className="text-slate-400">Loading…</p>}
                {parts?.error && <p className="text-rose-600">{parts.error}</p>}
                {parts?.participants?.filter((p: any) => p.rawStatus !== 'CANCELLED').map((p: any) => <div key={p.id} className="flex justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><span>{p.name} · {p.registrationCode}</span><span className="text-xs text-slate-500">{p.paymentStatus} · {p.checkedInAt ? 'checked in' : 'not checked in'}</span></div>)}
                {parts?.participants?.length === 0 && <p className="text-slate-400">No registrations.</p>}
              </div>
            )}
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-slate-400">No events found.</p>}
      </div>
    </AdminShell>
  );
}
