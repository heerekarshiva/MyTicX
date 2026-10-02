'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, Plus, ScanLine, Users, Copy, Download, Pencil, Ban, Eye } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/events/StatusBadge';
import { fmtDate, fmtDay, fmtTime } from '@/lib/events/time';

export default function OrganizerDashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [tz, setTz] = useState('Asia/Kolkata');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const load = () => fetch('/api/organizer/events').then(async r => { const j = await r.json(); if (!r.ok) setMsg(j.error); else setEvents(j.events); }).finally(() => setLoading(false));
  useEffect(() => { load(); fetch('/api/event-config').then(r => r.json()).then(c => setTz(c.settings.timezone)); }, []);

  async function act(id: string, action: string) {
    if (action === 'cancel' && !confirm('Cancel this event? Registered participants will be notified.')) return;
    setMsg('');
    const r = await fetch(`/api/organizer/events/${id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const j = await r.json(); if (!r.ok) setMsg(j.error); load();
  }

  return (
    <div className="min-h-screen bg-ticx-bg">
      <Navbar authed />
      <div className="container-page py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-bold text-navy-900">My events</h1><p className="text-sm text-slate-500">Create, manage and check people in.</p></div>
          <Link href="/organize-event"><Button><Plus className="h-4 w-4" /> New event</Button></Link>
        </div>
        {msg && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{msg}</p>}
        {loading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}
        {!loading && events.length === 0 && !msg && <Card className="mt-6 text-center text-sm text-slate-500">No events yet. <Link href="/organize-event" className="font-medium text-brand-blue">Organize your first event</Link>.</Card>}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {events.map(e => (
            <Card key={e.id} className="flex flex-col gap-3 !p-0 overflow-hidden sm:flex-row">
              <div className="h-40 w-full bg-brand-gradient-soft bg-cover bg-center sm:h-auto sm:w-40 sm:shrink-0" style={e.poster_url ? { backgroundImage: `url(${e.poster_url})` } : undefined} />
              <div className="flex-1 p-4">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-navy-900">{e.title}</h3><StatusBadge status={e.status} /></div>
                <div className="mt-1 flex flex-wrap gap-1.5"><Badge tone="info">{e.event_type}</Badge><Badge>{e.registration_type === 'PAID' ? `Paid ₹${Number(e.amount)}` : 'Free'}</Badge></div>
                {e.start_at && <p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" />{fmtDate(e.start_at, tz)} ({fmtDay(e.start_at, tz)}) · {fmtTime(e.start_at, tz)} – {fmtTime(e.end_at, tz)}</p>}
                {e.venue && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" />{[e.venue, e.city].filter(Boolean).join(', ')}</p>}
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><Users className="h-3.5 w-3.5" />{e.counts.total} registered · {e.counts.checkedIn} checked in</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.status !== 'DRAFT' && <Link href={`/events/${e.id}`} target="_blank"><Button size="sm" variant="outline"><Eye className="h-4 w-4" />View</Button></Link>}
                  {!['COMPLETED', 'CANCELLED'].includes(e.status) && <Link href={`/organize-event?edit=${e.id}`}><Button size="sm" variant="outline"><Pencil className="h-4 w-4" />Edit</Button></Link>}
                  <Link href={`/organizer/events/${e.id}/participants`}><Button size="sm" variant="outline"><Users className="h-4 w-4" />Participants</Button></Link>
                  {!['DRAFT', 'CANCELLED', 'SUSPENDED'].includes(e.status) && <Link href={`/organizer/events/${e.id}/scan`}><Button size="sm"><ScanLine className="h-4 w-4" />Scan</Button></Link>}
                  <a href={`/api/organizer/events/${e.id}/export`}><Button size="sm" variant="ghost"><Download className="h-4 w-4" />Export</Button></a>
                  <Button size="sm" variant="ghost" onClick={() => act(e.id, 'duplicate')}><Copy className="h-4 w-4" />Duplicate</Button>
                  {e.status === 'DRAFT' && <Button size="sm" variant="ghost" onClick={() => act(e.id, 'publish')}>Publish</Button>}
                  {['PUBLISHED', 'REGISTRATION_OPEN'].includes(e.status) && <Button size="sm" variant="ghost" onClick={() => act(e.id, 'unpublish')}>Unpublish</Button>}
                  {!['COMPLETED', 'CANCELLED'].includes(e.status) && <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => act(e.id, 'cancel')}><Ban className="h-4 w-4" />Cancel</Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
