'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';
import { AdminShell } from '@/components/events/AdminShell';

const tiles: [string, string][] = [
  ['totalEvents', 'Total events'], ['activeEvents', 'Active events'], ['registrationOpen', 'Registration open'], ['registrationClosed', 'Registration closed'],
  ['upcoming', 'Upcoming'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['totalRegistrations', 'Total registrations'],
  ['paidRegistrations', 'Paid registrations'], ['freeRegistrations', 'Free registrations'], ['checkIns', 'Check-ins']
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [err, setErr] = useState('');
  const [pendingTickets, setPendingTickets] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/event-stats').then(async r => { const j = await r.json(); r.ok ? setStats(j) : setErr(j.error); });
    const supabase = createClient();
    (async () => {
      const { data: t } = await supabase.from('tickets').select('*').eq('status', 'VERIFYING').limit(20); setPendingTickets(t ?? []);
      const { data: r } = await supabase.from('reports').select('*').eq('status', 'OPEN').limit(20); setReports(r ?? []);
    })();
  }, []);

  return (
    <AdminShell title="Admin dashboard">
      <h2 className="text-sm font-semibold text-navy-900">Event platform</h2>
      {err && <p className="mt-2 text-sm text-rose-600">{err}</p>}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([k, label]) => <Card key={k} className="!p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold text-navy-900">{stats ? stats[k] : '—'}</p></Card>)}
      </div>
      <p className="mt-3 text-xs text-slate-500">Everything about organized events — types, participant fields, templates, rules, nav label — is configured from the tabs above. <Link href="/admin/settings" className="text-brand-blue">Platform settings →</Link></p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold text-navy-900">Verification queue</h2>
          <div className="mt-3 space-y-2">
            {pendingTickets.length === 0 && <p className="text-sm text-slate-400">Nothing pending.</p>}
            {pendingTickets.map(t => <Card key={t.id} className="flex items-center justify-between text-sm"><span>{t.booking_reference}</span><Badge tone="warning">VERIFYING</Badge></Card>)}
          </div>
        </section>
        <section>
          <h2 className="text-sm font-semibold text-navy-900">Open reports</h2>
          <div className="mt-3 space-y-2">
            {reports.length === 0 && <p className="text-sm text-slate-400">No open reports.</p>}
            {reports.map(r => <Card key={r.id} className="flex items-center justify-between text-sm"><span>{r.reason}</span><Badge tone="danger">OPEN</Badge></Card>)}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
