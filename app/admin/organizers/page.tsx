'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AdminShell, api } from '@/components/events/AdminShell';

export default function OrganizersAdmin() {
  const [items, setItems] = useState<any[]>([]); const [msg, setMsg] = useState(''); const [open, setOpen] = useState<string | null>(null); const [evs, setEvs] = useState<any[]>([]);
  const load = () => api('/api/admin/organizers').then(r => r.ok ? setItems(r.data.items) : setMsg(r.error ?? ''));
  useEffect(() => { load(); }, []);
  async function setStatus(userId: string, status: string) {
    const reason = status === 'SUSPENDED' ? prompt('Reason for suspension (optional)') ?? undefined : undefined;
    const r = await api('/api/admin/organizers', 'PATCH', { userId, status, reason }); setMsg(r.error ?? ''); load();
  }
  async function viewEvents(userId: string) {
    if (open === userId) return setOpen(null); setOpen(userId);
    const r = await api('/api/admin/events-manage'); setEvs((r.data.events ?? []).filter((e: any) => e.created_by === userId));
  }
  return (
    <AdminShell title="Organizers">
      {msg && <p className="mb-3 text-sm text-rose-600">{msg}</p>}
      <div className="space-y-2">
        {items.length === 0 && <p className="text-sm text-slate-400">No organizers yet. Users become organizers the first time they open “Organize Your Event”.</p>}
        {items.map(o => (
          <Card key={o.userId} className="!p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="flex items-center gap-2"><span className="font-semibold text-navy-900">{o.name}</span><Badge tone={o.status === 'ACTIVE' ? 'success' : o.status === 'PENDING' ? 'warning' : 'danger'}>{o.status}</Badge></div>
                <p className="text-xs text-slate-500">{o.email} · {o.events} events · {o.registrations} registrations · joined {new Date(o.createdAt).toLocaleDateString()}</p>
                {o.suspendedReason && <p className="text-xs text-rose-600">Reason: {o.suspendedReason}</p>}</div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => viewEvents(o.userId)}>Events</Button>
                {o.status === 'ACTIVE' ? <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setStatus(o.userId, 'SUSPENDED')}>Suspend</Button> : <Button size="sm" onClick={() => setStatus(o.userId, 'ACTIVE')}>{o.status === 'PENDING' ? 'Approve' : 'Reactivate'}</Button>}
              </div>
            </div>
            {open === o.userId && <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">{evs.length === 0 && <li className="text-slate-400">No events.</li>}{evs.map(e => <li key={e.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5"><span>{e.title}</span><span className="text-xs text-slate-500">{e.status} · {e.registrations} reg</span></li>)}</ul>}
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
