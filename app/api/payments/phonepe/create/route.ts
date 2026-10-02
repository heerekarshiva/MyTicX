import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPhonePePayment, phonepeConfigured } from '@/lib/providers/phonepe';
import { abs } from '@/lib/site';
import { checkRateLimitShared } from '@/lib/rate-limit';
import { planHold } from '@/lib/payments/hold';

// Buyer clicks "Pay with PhonePe": we create the PhonePe payment from OUR order (amount comes from the DB, never the client).
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!phonepeConfigured()) return NextResponse.json({ error: 'PhonePe is not configured.' }, { status: 503 });

  const { orderId } = await req.json().catch(() => ({}));
  if (typeof orderId !== 'string') return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  if (!(await checkRateLimitShared(`pp-create:${user.id}`, 10, 60_000))) return NextResponse.json({ error: 'Too many attempts. Please wait a minute.' }, { status: 429 });

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, listing_id, buyer_id, total_amount, status').eq('id', orderId).maybeSingle();
  if (!order || order.buyer_id !== user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'PAYMENT_PENDING') return NextResponse.json({ error: 'This order is not awaiting payment.' }, { status: 409 });

  // Never take money for a reservation that has lapsed or a ticket someone else now holds.
  const { data: listing } = await admin.from('ticket_listings').select('status, reserved_by, reserved_at, reservation_expires_at').eq('id', order.listing_id).maybeSingle();
  const expiresMs = listing?.reservation_expires_at ? new Date(listing.reservation_expires_at).getTime() : 0;
  if (!listing || listing.status !== 'RESERVED' || listing.reserved_by !== user.id) {
    return NextResponse.json({ error: 'Your reservation has expired or this ticket is no longer available. Please go back and try again.' }, { status: 409 });
  }
  // PhonePe needs a payment window of at least 300s. If the reservation is nearly over, extend the buyer's own hold (capped).
  const now = Date.now();
  const plan = planHold({ nowMs: now, expiresAtMs: expiresMs, reservedAtMs: listing.reserved_at ? new Date(listing.reserved_at).getTime() : null });
  if (!plan.ok) return NextResponse.json({ error: 'Your reservation has expired or this ticket is no longer available. Please go back and try again.' }, { status: 409 });
  if (plan.extend) {
    const { data: ext } = await admin.from('ticket_listings')
      .update({ reservation_expires_at: new Date(plan.newExpiresAtMs).toISOString(), updated_at: new Date().toISOString() })
      .eq('id', order.listing_id).eq('status', 'RESERVED').eq('reserved_by', user.id).gt('reservation_expires_at', new Date(now).toISOString())
      .select('id');
    if (!ext || ext.length === 0) return NextResponse.json({ error: 'Your reservation has expired or this ticket is no longer available. Please go back and try again.' }, { status: 409 });
  }

  try {
    const { redirectUrl } = await createPhonePePayment({
      merchantOrderId: order.id,
      amountRupees: Number(order.total_amount),
      redirectUrl: abs(`/orders/${order.id}?pp=return`),
      expireAfterSeconds: plan.expireAfterSeconds // >= 300s (PhonePe minimum) and always ends before our reservation does
    });
    return NextResponse.json({ redirectUrl });
  } catch (e) {
    console.error('[phonepe] create failed', e);
    return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 502 });
  }
}
