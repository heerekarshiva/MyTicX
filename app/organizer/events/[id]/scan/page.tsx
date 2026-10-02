'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { QrScanner } from '@/components/events/QrScanner';
import { PaymentBadge } from '@/components/events/StatusBadge';

function Scan() {
  const { id } = useParams<{ id: string }>();
  const initial = useSearchParams().get('token');
  const [token, setToken] = useState<string | null>(null);
  const [p, setP] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ at: string; dup: boolean } | null>(null);
  const [manual, setManual] = useState('');
  const lock = useRef(false);

  const lookup = useCallback(async (raw: string) => {
    if (lock.current) return; lock.current = true;
    setErr(''); setDone(null); setP(null); setToken(raw);
    const r = await fetch('/api/organizer/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: id, token: raw }) });
    const j = await r.json();
    if (!r.ok) { setErr(j.error ?? 'Could not verify.'); setToken(null); lock.current = false; if (r.status !== 429) setTimeout(() => setErr(''), 4000); return; }
    setP(j);
  }, [id]);
  useEffect(() => { if (initial) lookup(initial); }, [initial, lookup]);

  async function confirm() {
    setBusy(true);
    const r = await fetch('/api/organizer/check-in', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: id, token }) });
    const j = await r.json();
    if (r.ok) setDone({ at: j.checkedInAt, dup: false });
    else if (j.alreadyCheckedIn) setDone({ at: j.checkedInAt, dup: true });
    else setErr(j.error ?? 'Check-in failed.');
    setBusy(false);
  }
  function next() { setP(null); setDone(null); setToken(null); setErr(''); lock.current = false; }

  return (
    <div className="min-h-screen bg-ticx-bg">
      <Navbar authed />
      <div className="container-page max-w-lg py-6">
        <Link href="/organizer/dashboard" className="flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4" /> My events</Link>
        <h1 className="mt-2 text-xl font-bold text-navy-900">Scan participant</h1>

        {!p && (
          <>
            <div className="mt-4"><QrScanner onResult={lookup} paused={!!token} /></div>
            {err && <p className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert"><XCircle className="h-4 w-4 shrink-0" />{err}</p>}
            <form className="mt-4 flex gap-2" onSubmit={e => { e.preventDefault(); if (manual.trim()) { lock.current = false; lookup(manual); } }}>
              <Input placeholder="…or paste pass link / code" value={manual} onChange={e => setManual(e.target.value)} />
              <Button type="submit" variant="outline">Verify</Button>
            </form>
          </>
        )}

        {p && (
          <Card className="mt-4 space-y-3">
            <h2 className="text-base font-semibold text-navy-900">Participant details</h2>
            <p className="text-lg font-bold text-navy-900">{p.name}</p>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {p.details.map((d: any) => <div key={d.label}><dt className="text-xs text-slate-400">{d.label}</dt><dd className="font-medium text-navy-900">{d.value || '—'}</dd></div>)}
            </dl>
            <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-sm">
              <div><p className="text-xs text-slate-400">Registration status</p><PaymentBadge status={p.paymentStatus} /></div>
              <div><p className="text-xs text-slate-400">Check-in status</p><span className={`text-xs font-semibold ${p.checkedIn || done ? 'text-emerald-700' : 'text-amber-700'}`}>{p.checkedIn || done ? 'CHECKED IN' : 'NOT CHECKED IN'}</span></div>
              <div><p className="text-xs text-slate-400">ID</p><span className="text-xs">{p.registrationCode}</span></div>
            </div>
            {done && !done.dup && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />Checked in at {new Date(done.at).toLocaleTimeString()}</p>}
            {(done?.dup || (p.checkedIn && !done)) && <p className="rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-800">Already Checked In — {new Date(done?.at ?? p.checkedInAt).toLocaleString()}</p>}
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <div className="flex gap-2">
              {!p.checkedIn && !done && <Button className="flex-1" disabled={busy} onClick={confirm}>{busy ? 'Checking in…' : 'Confirm Check-In'}</Button>}
              <Button variant="outline" className="flex-1" onClick={next}>Scan next</Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
export default function ScanPage() { return <Suspense><Scan /></Suspense>; }
