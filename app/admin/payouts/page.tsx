'use client';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AdminShell, api } from '@/components/events/AdminShell';

export default function PayoutsAdmin() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [utr, setUtr] = useState<Record<string, string>>({});
  async function load() { const r = await api('/api/admin/payouts'); r.ok ? setD(r.data) : setErr(r.error ?? 'Could not load'); }
  useEffect(() => { load(); }, []);
  async function markPaid(id: string) { const r = await api('/api/admin/payouts', 'PATCH', { id, utr: utr[id] ?? '' }); if (!r.ok) return setErr(r.error ?? ''); setErr(''); load(); }
  async function retryRefund(id: string) { const r = await api('/api/admin/payouts', 'PATCH', { action: 'retry_refund', id }); setErr(r.ok ? '' : (r.error ?? 'Refund failed')); load(); }
  if (!d) return <AdminShell title="Payouts & refunds">{err ? <p className="text-sm text-rose-600">{err}</p> : <p className="text-sm text-slate-500">Loading…</p>}</AdminShell>;
  const pending = d.payouts.filter((p: any) => p.status === 'PENDING');
  const total = pending.reduce((n: number, p: any) => n + Number(p.amount), 0);
  return (
    <AdminShell title="Payouts & refunds">
      {err && <p className="mb-3 text-sm text-rose-600" role="alert">{err}</p>}
      <Card className="mb-4"><p className="text-sm text-slate-600">Owed to sellers: <strong>₹{total.toFixed(2)}</strong> across {pending.length} payout(s). Pay each seller their UPI ID, then record the reference.</p></Card>
      <div className="space-y-3">
        {d.payouts.map((p: any) => (
          <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm"><p className="font-semibold text-navy-900">₹{Number(p.amount).toFixed(2)} → {p.seller?.upi_payee_name ?? p.seller?.full_name ?? 'Seller'}</p>
              <p className="text-slate-500">UPI: {p.seller?.upi_id ?? 'not added yet'} · order {String(p.order_id).slice(0, 8)}</p></div>
            {p.status === 'PAID' ? <span className="text-sm text-emerald-700">Paid · {p.utr}</span> : (
              <div className="flex gap-2"><Input placeholder="UPI reference" value={utr[p.id] ?? ''} onChange={e => setUtr({ ...utr, [p.id]: e.target.value })} /><Button onClick={() => markPaid(p.id)}>Mark paid</Button></div>)}
          </Card>))}
        {d.payouts.length === 0 && <p className="text-sm text-slate-500">No payouts yet.</p>}
      </div>
      <h2 className="mb-2 mt-8 text-sm font-semibold text-navy-900">Payment issues (auto-refund log)</h2>
      <div className="space-y-2">
        {d.issues.map((i: any) => {
          const done = i.refund_status === 'REFUND_INITIATED' || i.refund_status === 'RESOLVED';
          return (
            <Card key={i.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-navy-900">{i.kind} · ₹{Number(i.amount ?? 0).toFixed(2)} · <span className={done ? 'text-emerald-700' : 'text-rose-600'}>{i.refund_status}</span></p>
                <p className="text-xs text-slate-500">order {String(i.order_id).slice(0, 8)} · {i.detail} · attempts {i.refund_attempts ?? 0}</p>
                {i.last_error && !done && <p className="text-xs text-rose-600">Last error: {i.last_error}</p>}
              </div>
              {!done && <Button onClick={() => retryRefund(i.id)}>Retry refund</Button>}
            </Card>
          );
        })}
        {d.issues.length === 0 && <p className="text-sm text-slate-500">None. </p>}
      </div>
    </AdminShell>
  );
}
