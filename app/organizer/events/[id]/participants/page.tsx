'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Download, ScanLine, ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PaymentBadge } from '@/components/events/StatusBadge';

const sel = 'min-h-[40px] rounded-lg border border-slate-200 bg-white px-2 text-sm';

export default function ParticipantsPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState(''); const [pay, setPay] = useState(''); const [ci, setCi] = useState(''); const [sort, setSort] = useState('newest'); const [from, setFrom] = useState('');
  const [open, setOpen] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const load = () => fetch(`/api/organizer/events/${id}/participants`).then(async r => { const j = await r.json(); r.ok ? setData(j) : setErr(j.error); });
  useEffect(() => { load(); }, [id]);

  const rows = useMemo(() => {
    if (!data) return [];
    let r = data.participants.filter((p: any) => p.rawStatus !== 'CANCELLED') as any[];
    const needle = q.trim().toLowerCase();
    if (needle) r = r.filter(p => p.name.toLowerCase().includes(needle) || (p.registrationCode ?? '').toLowerCase().includes(needle) || Object.values(p.answers).some(v => String(v).toLowerCase().includes(needle)));
    if (pay) r = r.filter(p => p.paymentStatus === pay);
    if (ci) r = r.filter(p => (ci === 'in') === !!p.checkedInAt);
    if (from) r = r.filter(p => p.createdAt >= from);
    return [...r].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
  }, [data, q, pay, ci, sort, from]);

  async function verify(regId: string, action: 'confirm' | 'reject') {
    setBusy(regId);
    await fetch(`/api/organizer/events/${id}/registrations/${regId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    await load(); setBusy(null);
  }

  if (err) return <div><Navbar authed /><p className="container-page py-10 text-sm text-rose-600">{err}</p></div>;
  if (!data) return <div><Navbar authed /><p className="container-page py-10 text-sm text-slate-500">Loading…</p></div>;
  const isFree = data.event.registration_type === 'FREE';

  return (
    <div className="min-h-screen bg-ticx-bg">
      <Navbar authed />
      <div className="container-page py-8">
        <Link href="/organizer/dashboard" className="flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" /> My events</Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-navy-900">{data.event.title} — participants <span className="text-sm font-normal text-slate-400">({rows.length})</span></h1>
          <div className="flex gap-2">
            <Link href={`/organizer/events/${id}/scan`}><Button size="sm"><ScanLine className="h-4 w-4" />Scan</Button></Link>
            <a href={`/api/organizer/events/${id}/export`}><Button size="sm" variant="outline"><Download className="h-4 w-4" />Export CSV</Button></a>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <Input placeholder="Search name, ID, any field…" value={q} onChange={e => setQ(e.target.value)} className="lg:col-span-2" />
          {!isFree && <select aria-label="Payment status" className={sel} value={pay} onChange={e => setPay(e.target.value)}><option value="">All payments</option><option value="PAID">Paid</option><option value="PAYMENT_PROCESSING">Needs verification</option><option value="PAYMENT_REQUIRED">Payment required</option><option value="PAYMENT_FAILED">Failed</option></select>}
          <select aria-label="Check-in status" className={sel} value={ci} onChange={e => setCi(e.target.value)}><option value="">All check-ins</option><option value="in">Checked in</option><option value="out">Not checked in</option></select>
          <select aria-label="Sort" className={sel} value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name">Name A–Z</option></select>
          <label className="flex items-center gap-2 text-xs text-slate-500">Registered since <input type="date" className={sel} value={from} onChange={e => setFrom(e.target.value)} /></label>
        </div>

        <div className="mt-4 space-y-2">
          {rows.length === 0 && <Card className="text-center text-sm text-slate-400">No participants match.</Card>}
          {rows.map(p => (
            <Card key={p.id} className="!p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button className="text-left" onClick={() => setOpen(open === p.id ? null : p.id)}>
                  <p className="font-medium text-navy-900">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.registrationCode} · {new Date(p.createdAt).toLocaleString()}</p>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <PaymentBadge status={isFree ? 'FREE' : p.paymentStatus} />
                  <span className={`text-xs ${p.checkedInAt ? 'font-medium text-emerald-700' : 'text-slate-400'}`}>{p.checkedInAt ? `Checked in ${new Date(p.checkedInAt).toLocaleTimeString()}` : 'Not checked in'}</span>
                  {p.rawStatus === 'SUBMITTED' && <><Button size="sm" disabled={busy === p.id} onClick={() => verify(p.id, 'confirm')}>Confirm payment</Button><Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => verify(p.id, 'reject')}>Reject</Button></>}
                </div>
              </div>
              {p.rawStatus === 'SUBMITTED' && p.utr && <p className="mt-1 text-xs text-slate-500">UTR: {p.utr} · ₹{Number(p.amount)}</p>}
              {open === p.id && (
                <dl className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2">
                  {data.fields.map((f: any) => <div key={f.field_key}><dt className="text-xs text-slate-400">{f.label}</dt><dd className="text-navy-900">{p.answers[f.field_key] || '—'}</dd></div>)}
                </dl>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
