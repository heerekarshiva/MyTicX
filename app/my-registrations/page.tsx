'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Card } from '@/components/ui/Card';
import { StatusBadge, PaymentBadge } from '@/components/events/StatusBadge';
import { EmptyState } from '@/components/EmptyState';
import { fmtDateTime } from '@/lib/events/time';

function Pass({ token }: { token: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => { QRCode.toDataURL(`${window.location.origin}/check-in/${token}`, { width: 220, margin: 1 }).then(setSrc); }, [token]);
  return src ? <img src={src} alt="Entry QR code" className="h-40 w-40" /> : null;
}

export default function MyRegistrations() {
  const [rows, setRows] = useState<any[] | null>(null);
  useEffect(() => { fetch('/api/my-registrations').then(r => r.json()).then(j => setRows(j.registrations ?? [])); }, []);
  return (
    <div className="pb-20 lg:pb-0">
      <Navbar authed />
      <div className="container-page max-w-3xl py-8">
        <h1 className="text-xl font-bold text-navy-900">My event registrations</h1>
        <div className="mt-6 space-y-4">
          {rows === null && <p className="text-sm text-slate-500">Loading…</p>}
          {rows?.length === 0 && <EmptyState title="No registrations yet." subtitle="Browse events and register." />}
          {rows?.map(r => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <Link href={`/events/${r.event.id}`} className="font-semibold text-navy-900 hover:text-brand-blue">{r.event.title}</Link>
                <p className="text-xs text-slate-500">{r.event.start_at && fmtDateTime(r.event.start_at, 'Asia/Kolkata')} · {r.event.venue}</p>
                <p className="text-xs text-slate-500">Registration ID: <b>{r.code}</b></p>
                <div className="flex flex-wrap gap-2"><StatusBadge status={r.event.status} /><PaymentBadge status={Number(r.amount) === 0 ? 'FREE' : r.paymentStatus} />{r.checkedInAt && <span className="text-xs font-semibold text-emerald-700">CHECKED IN</span>}</div>
              </div>
              {r.qrToken && <Pass token={r.qrToken} />}
            </Card>
          ))}
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
