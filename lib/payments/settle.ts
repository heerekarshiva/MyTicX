import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPhonePeOrderStatus, refundPhonePePayment } from '@/lib/providers/phonepe';

export type SettleResult = 'PAID' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'ERROR';

const MAX_REFUND_ATTEMPTS = 10;

/** Calls PhonePe's (idempotent) refund API for an issue row and records the outcome. Safe to repeat. */
async function attemptRefund(orderId: string, kind: string, amountPaise: number, prevAttempts: number): Promise<SettleResult> {
  const admin = createAdminClient();
  const r = await refundPhonePePayment({ merchantOrderId: orderId, amountPaise });
  await admin.from('payment_issues').update({
    refund_status: r.ok ? 'REFUND_INITIATED' : 'REFUND_FAILED',
    refund_attempts: prevAttempts + 1,
    last_attempt_at: new Date().toISOString(),
    last_error: r.ok ? null : String(r.error ?? 'unknown').slice(0, 500)
  }).eq('order_id', orderId).eq('kind', kind);
  if (r.ok) {
    await admin.from('orders').update({ status: 'REFUNDED', updated_at: new Date().toISOString() }).eq('id', orderId).in('status', ['CANCELLED', 'PAYMENT_PENDING', 'FAILED']);
    await admin.from('payments').update({ status: 'REFUNDED' }).eq('order_id', orderId).eq('status', 'SUCCEEDED');
  }
  return r.ok ? 'REFUNDED' : 'ERROR';
}

async function recordIssueAndRefund(orderId: string, kind: string, amountPaise: number, detail: string): Promise<SettleResult> {
  const admin = createAdminClient();
  const { error: insErr } = await admin.from('payment_issues').insert({ order_id: orderId, kind, amount: amountPaise / 100, detail });
  if (insErr && insErr.code !== '23505') console.error('[phonepe] could not record payment issue', insErr.message);
  console.error('[phonepe] PAYMENT ISSUE', { orderId, kind, detail });
  const { data: row } = await admin.from('payment_issues').select('refund_attempts').eq('order_id', orderId).eq('kind', kind).maybeSingle();
  return attemptRefund(orderId, kind, amountPaise, row?.refund_attempts ?? 0);
}

/** Cron: retry refunds that failed or never got sent (bounded attempts, spaced out). Returns how many succeeded. */
export async function retryOpenRefunds(limit = 20): Promise<number> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data } = await admin.from('payment_issues').select('order_id, kind, amount, refund_attempts')
    .in('refund_status', ['PENDING', 'REFUND_FAILED']).lt('refund_attempts', MAX_REFUND_ATTEMPTS)
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`).order('created_at').limit(limit);
  let ok = 0;
  for (const i of data ?? []) {
    try { if ((await attemptRefund(i.order_id, i.kind, Math.round(Number(i.amount) * 100), i.refund_attempts ?? 0)) === 'REFUNDED') ok++; }
    catch (e) { console.error('[refund-retry] failed', i.order_id, e); }
  }
  return ok;
}

/** Admin button: retry one refund now, regardless of the automatic attempt limit. */
export async function retryRefundNow(issueId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: i } = await admin.from('payment_issues').select('order_id, kind, amount, refund_attempts, refund_status').eq('id', issueId).maybeSingle();
  if (!i) return { ok: false, error: 'Issue not found.' };
  if (i.refund_status === 'REFUND_INITIATED' || i.refund_status === 'RESOLVED') return { ok: false, error: 'Already refunded.' };
  const r = await attemptRefund(i.order_id, i.kind, Math.round(Number(i.amount) * 100), i.refund_attempts ?? 0);
  return r === 'REFUNDED' ? { ok: true } : { ok: false, error: 'PhonePe refused the refund. See the error on the issue.' };
}

/** Safety net: make sure a PhonePe-collected, paid order has its payout row (finalize_paid_order normally creates it). */
async function ensurePayout(order: { id: string; seller_id: string; ticket_price: number }) {
  const admin = createAdminClient();
  const { data: pay } = await admin.from('payments').select('id').eq('order_id', order.id).eq('provider', 'phonepe').in('status', ['SUCCEEDED']).limit(1).maybeSingle();
  if (!pay) return;
  const { error } = await admin.from('seller_payouts').insert({ order_id: order.id, seller_id: order.seller_id, amount: order.ticket_price });
  if (error && error.code !== '23505') console.error('[payout] could not create payout row', order.id, error.message);
}

/**
 * Verifies a PhonePe payment SERVER-TO-SERVER (never trusts a webhook body or the browser redirect),
 * checks the amount against our own order, records it once, and finalizes the order.
 * Safe to call repeatedly (webhook + redirect page + polling) and concurrently.
 * If money was taken but the ticket is gone, the buyer is refunded automatically and the case is logged in payment_issues.
 */
export async function settlePhonePeOrder(orderId: string): Promise<SettleResult> {
  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, total_amount, status, seller_id, ticket_price').eq('id', orderId).maybeSingle();
  if (!order) return 'ERROR';
  if (order.status === 'PAID' || order.status === 'TRANSFERRED') { await ensurePayout(order as any); return 'PAID'; }
  if (order.status === 'REFUNDED') return 'REFUNDED';

  const { data: issue } = await admin.from('payment_issues').select('refund_status').eq('order_id', orderId).limit(1).maybeSingle();
  if (issue) return issue.refund_status === 'REFUND_INITIATED' || issue.refund_status === 'RESOLVED' ? 'REFUNDED' : 'ERROR'; // failed refunds are retried by cron / the admin button

  const st = await getPhonePeOrderStatus(orderId);
  if (st.state === 'PENDING') return 'PENDING';
  if (st.state !== 'COMPLETED') return 'FAILED';

  const expectedPaise = Math.round(Number(order.total_amount) * 100);
  if (st.amountPaise !== expectedPaise) return recordIssueAndRefund(orderId, 'AMOUNT_MISMATCH', st.amountPaise, `expected ${expectedPaise}, got ${st.amountPaise}`);

  const { error: payErr } = await admin.from('payments').insert({
    order_id: orderId, provider: 'phonepe', provider_payment_id: st.transactionId, amount: order.total_amount,
    status: 'SUCCEEDED', idempotency_key: `phonepe_${orderId}`, raw_webhook_payload: { source: 'phonepe_status_api', state: st.state }
  });
  if (payErr && payErr.code !== '23505') { console.error('[phonepe] record payment failed', payErr.message); return 'ERROR'; }

  const { error: finErr } = await admin.rpc('finalize_paid_order', { p_order_id: orderId });
  if (finErr) {
    // Paid, but the ticket is no longer available (sold to someone else). Refund automatically.
    return recordIssueAndRefund(orderId, 'ORDER_NOT_PAYABLE', st.amountPaise, finErr.message);
  }

  await ensurePayout(order as any); // normally already created inside finalize_paid_order
  return 'PAID';
}
