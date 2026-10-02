import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdminCtx, sameOrigin, fail, json } from '@/lib/events/server';
import { retryRefundNow } from '@/lib/payments/settle';

// Money you owe sellers (PhonePe settles to YOUR account) and payments that needed a refund.
export async function GET() {
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  const a = g.ctx.admin;
  const { data: payouts } = await a.from('seller_payouts').select('id, order_id, seller_id, amount, status, utr, paid_at, created_at').order('created_at', { ascending: false }).limit(200);
  const ids = Array.from(new Set((payouts ?? []).map((p: any) => p.seller_id)));
  const { data: profs } = ids.length ? await a.from('profiles').select('id, full_name, upi_id, upi_payee_name').in('id', ids) : { data: [] as any[] };
  const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
  const { data: issues } = await a.from('payment_issues').select('*').order('created_at', { ascending: false }).limit(100);
  return json({ payouts: (payouts ?? []).map((p: any) => ({ ...p, seller: byId.get(p.seller_id) ?? null })), issues: issues ?? [] });
}

const schema = z.object({ id: z.string().uuid(), utr: z.string().trim().min(4).max(64) });
export async function PATCH(req: NextRequest) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  const body = await req.json().catch(() => null);
  const rr = z.object({ action: z.literal('retry_refund'), id: z.string().uuid() }).safeParse(body);
  if (rr.success) { const r = await retryRefundNow(rr.data.id); return r.ok ? json({ ok: true }) : fail(r.error ?? 'Refund failed.', 502); }
  const p = schema.safeParse(body);
  if (!p.success) return fail('Enter the UPI reference number of the payout.');
  const { error } = await g.ctx.admin.from('seller_payouts').update({ status: 'PAID', utr: p.data.utr, paid_at: new Date().toISOString() }).eq('id', p.data.id).eq('status', 'PENDING');
  return error ? fail('Could not update payout.', 500) : json({ ok: true });
}
