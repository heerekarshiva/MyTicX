'use client';
import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { CalendarDays, Clock, MapPin, Users, User, GraduationCap } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DynamicForm } from '@/components/events/DynamicForm';
import { StatusBadge } from '@/components/events/StatusBadge';
import { buildUpiIntentLinkClient } from '@/lib/ticket/upi-client';
import { fmtDate, fmtDay, fmtDateTime, fmtTime } from '@/lib/events/time';

export default function EventClient({ id, initial }: { id: string; initial: any | null }) {
  const path = usePathname();
  const [d, setD] = useState<any>(initial); // server-rendered public data; replaced by the user-specific payload after mount
  const [notFound, setNotFound] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [loggedOut, setLoggedOut] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [upiQr, setUpiQr] = useState<string | null>(null);
  const [passQr, setPassQr] = useState<string | null>(null);
  const [utr, setUtr] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/events/${id}`); const j = await r.json();
    if (!r.ok) { setNotFound(true); return; } setD(j);
  }, [id]);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]); // re-sync so the page flips to "Registration Closed" without a reload

  const reg = d?.registration; const ev = d?.event;
  useEffect(() => {
    if (reg && d.payment && ev?.registration_type === 'PAID' && reg.status !== 'CONFIRMED') {
      QRCode.toDataURL(buildUpiIntentLinkClient({ upiId: d.payment.upiId, payeeName: d.payment.payeeName, amount: Number(reg.amount), note: `MyTICX ${reg.registration_code}` }), { width: 240 }).then(setUpiQr).catch(() => setUpiQr(null));
    }
    if (reg?.qrToken) QRCode.toDataURL(`${window.location.origin}/check-in/${reg.qrToken}`, { width: 280, margin: 1 }).then(setPassQr).catch(() => setPassQr(null));
  }, [reg, d, ev]);

  async function register(answers: Record<string, string>) {
    setBusy(true); setError(''); setFieldErrors({});
    try {
      const r = await fetch(`/api/events/${id}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }) });
      const j = await r.json();
      if (r.status === 401) { setLoggedOut(true); return; }
      if (!r.ok) { setError(j.error ?? 'Could not register.'); if (j.fieldErrors) setFieldErrors(j.fieldErrors); if (j.code) load(); return; }
      setShowForm(false); await load();
    } finally { setBusy(false); }
  }
  async function submitUtr() {
    if (!utr.trim()) return setError('Enter the UPI transaction / reference number (UTR).');
    setBusy(true); setError('');
    const r = await fetch(`/api/events/${id}/utr`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ registrationId: reg.id, utr }) });
    const j = await r.json(); if (!r.ok) setError(j.error ?? 'Could not submit.'); else await load();
    setBusy(false);
  }

  if (notFound) return <div><Navbar /><div className="container-page py-16 text-center text-sm text-slate-500">Event not found.</div></div>;
  if (!d) return <div><Navbar /><div className="container-page py-10 text-sm text-slate-500">Loading event…</div></div>;
  const tz = d.timezone; const paid = ev.registration_type === 'PAID'; const open = ev.status === 'REGISTRATION_OPEN';
  const closedLabel = ev.status === 'COMPLETED' ? 'EVENT COMPLETED' : ev.status === 'CANCELLED' ? 'EVENT CANCELLED' : 'REGISTRATION CLOSED';

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar />
      <div className="container-page max-w-3xl py-8">
        {ev.poster_url && <img src={ev.poster_url} alt={`${ev.title} poster`} className="mb-5 max-h-[28rem] w-full rounded-xl2 bg-slate-100 object-contain" />}
        <div className="flex flex-wrap items-start justify-between gap-3"><h1 className="text-2xl font-bold text-navy-900">{ev.title}</h1><div className="flex gap-2"><Badge tone="info">{ev.event_type}</Badge>{d.isOwner && <StatusBadge status={ev.status} />}</div></div>
        {ev.college_name && <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><GraduationCap className="h-4 w-4" />{ev.college_name}</p>}
        {ev.organizer_name && <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><User className="h-4 w-4" />Organized by {ev.organizer_name}</p>}
        <div className="mt-3 grid gap-1.5 text-sm text-slate-600">
          {ev.start_at && <p className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{fmtDate(ev.start_at, tz)} · {fmtDay(ev.start_at, tz)}</p>}
          {ev.start_at && <p className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{fmtTime(ev.start_at, tz)} – {fmtTime(ev.end_at, tz)}</p>}
          {(ev.venue || ev.city) && <p className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{[ev.venue, ev.city].filter(Boolean).join(', ')}</p>}
          {ev.capacity && <p className="flex items-center gap-1.5"><Users className="h-4 w-4" />{d.spotsLeft ?? '—'} of {ev.capacity} spots left</p>}
        </div>
        {ev.description && <p className="mt-4 text-sm text-slate-700">{ev.description}</p>}
        {ev.details && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{ev.details}</p>}

        <Card className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg font-bold text-navy-900">{paid ? `₹${Number(ev.amount).toFixed(0)}` : 'Free'} <span className="text-sm font-normal text-slate-500">· {paid ? 'Paid' : 'Free'} registration</span></p>
            {ev.registration_closes_at && <p className="text-xs text-slate-500">Registration deadline: {fmtDateTime(ev.registration_closes_at, tz)}</p>}
          </div>
          {d.fields.length > 0 && !reg && <p className="text-xs text-slate-500">You’ll be asked for: {d.fields.map((f: any) => f.label).join(', ')}</p>}
          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}

          {!reg && !open && <p className="rounded-xl bg-slate-100 p-4 text-center text-sm font-bold tracking-wide text-slate-600">{closedLabel}</p>}
          {!reg && open && !showForm && (
            <Button className="w-full" disabled={d.spotsLeft === 0} onClick={() => setShowForm(true)}>{d.spotsLeft === 0 ? 'Event full' : paid ? 'Register & pay' : 'Register Now'}</Button>
          )}
          {loggedOut && <p className="text-sm text-slate-600">Please <Link className="font-medium text-brand-blue" href={`/login?redirectTo=${encodeURIComponent(path)}`}>log in</Link> or <Link className="font-medium text-brand-blue" href="/signup">sign up</Link> to register.</p>}
          {!reg && open && showForm && <DynamicForm fields={d.fields} onSubmit={register} loading={busy} serverErrors={fieldErrors} submitLabel={paid ? 'Continue to payment' : 'Complete registration'} />}

          {reg?.status === 'CONFIRMED' && (
            <div className="space-y-3 text-center">
              <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{paid ? 'Payment confirmed — you’re registered!' : 'You’re registered!'}</p>
              {passQr && <img src={passQr} alt="Your entry QR code" className="mx-auto h-56 w-56" />}
              <p className="text-xs text-slate-500">Registration ID <b>{reg.registration_code}</b>. Show this QR at the entrance.</p>
              {reg.checkedInAt && <p className="text-xs font-semibold text-emerald-700">CHECKED IN · {fmtDateTime(reg.checkedInAt, tz)}</p>}
            </div>
          )}
          {reg && ['PENDING_PAYMENT', 'REJECTED'].includes(reg.status) && (
            <div className="space-y-3">
              {reg.status === 'REJECTED' && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">Your payment couldn’t be verified. Pay again and re-submit the reference, or contact the organizer.</p>}
              {upiQr && <img src={upiQr} alt="UPI payment QR code" className="mx-auto h-56 w-56" />}
              <p className="text-xs text-slate-500">Scan with any UPI app to pay ₹{Number(reg.amount).toFixed(2)}, then enter the reference number. Your pass is issued after the organizer verifies the payment.</p>
              <Input placeholder="UTR / reference number" value={utr} onChange={e => setUtr(e.target.value)} />
              <Button className="w-full" onClick={submitUtr} disabled={busy}>{busy ? 'Submitting…' : 'I’ve paid — submit reference'}</Button>
            </div>
          )}
          {reg?.status === 'SUBMITTED' && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">Reference {reg.utr} submitted — waiting for the organizer to verify your payment (PAYMENT PROCESSING).</p>}
          {reg && ev.status === 'COMPLETED' && <p className="text-center text-xs font-bold tracking-wide text-slate-500">EVENT COMPLETED</p>}
        </Card>
      </div>
      <MobileBottomNav />
    </div>
  );
}
