import { NextRequest, NextResponse } from 'next/server';
import { manualPaymentsEnabled } from '@/lib/payments/mode';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { manualPaymentConfirmSchema } from '@/lib/validation/schemas';

// Seller's side: "yes, I received this." Only the order's seller may call
// this. On confirm, it inserts a SUCCEEDED payments row (reusing the same
// table/shape the real webhook route writes to) and calls the same
// finalize_paid_order RPC — so the rest of the app (transfers, order
// status) behaves identically whether payment came from a real gateway or
// a manually confirmed UPI transfer.
export async function POST(req: NextRequest) {
  if (!manualPaymentsEnabled()) return NextResponse.json({ error: 'Not available.' }, { status: 404 });
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = manualPaymentConfirmSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });

  const admin = createAdminClient();
  const { data: proof } = await admin.from('manual_payment_proofs').select('*').eq('id', parsed.data.paymentId).single();
  if (!proof) return NextResponse.json({ error: 'Payment proof not found' }, { status: 404 });
  if (proof.seller_id !== user.id) return NextResponse.json({ error: 'Only the seller can confirm this payment' }, { status: 403 });
  if (proof.status === 'CONFIRMED') return NextResponse.json({ ok: true, alreadyConfirmed: true });

  const { data: order } = await admin.from('orders').select('*').eq('id', proof.order_id).single();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const { error: paymentError } = await admin.from('payments').insert({
    order_id: order.id,
    provider: 'upi_manual',
    provider_payment_id: proof.utr,
    amount: order.total_amount,
    status: 'SUCCEEDED',
    idempotency_key: `manual_${order.id}`,
    raw_webhook_payload: { source: 'seller_manual_confirm', utr: proof.utr, confirmedBy: user.id }
  });
  if (paymentError && paymentError.code !== '23505') {
    return NextResponse.json({ error: 'Could not record payment.' }, { status: 500 });
  }

  const { error: finalizeError } = await admin.rpc('finalize_paid_order', { p_order_id: order.id });
  if (finalizeError) return NextResponse.json({ error: 'Could not finalize order.' }, { status: 500 });

  await admin.from('manual_payment_proofs').update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString() }).eq('id', proof.id);

  return NextResponse.json({ ok: true });
}
