import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { purchaseRequestSchema } from '@/lib/validation/schemas';
import { randomUUID } from 'crypto';
import { checkRateLimitShared } from '@/lib/rate-limit';

// If this buyer already holds an open reservation on the listing, hand back their existing order (idempotent for double-clicks / reloads).
async function resumeOwnReservation(admin: ReturnType<typeof createAdminClient>, listingId: string, userId: string) {
  const { data: current } = await admin.from('ticket_listings').select('status, reserved_by, reservation_expires_at').eq('id', listingId).maybeSingle();
  if (!(current?.status === 'RESERVED' && current.reserved_by === userId && current.reservation_expires_at && new Date(current.reservation_expires_at) > new Date())) return null;
  const { data: mine } = await admin.from('orders').select('id, ticket_price, platform_fee, total_amount')
    .eq('listing_id', listingId).eq('buyer_id', userId).eq('status', 'PAYMENT_PENDING').order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!mine) return null;
  return NextResponse.json({ order: { order_id: mine.id, ticket_price: mine.ticket_price, platform_fee: mine.platform_fee, total_amount: mine.total_amount }, resumed: true });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!(await checkRateLimitShared(`purchase:${user.id}`, 15, 60_000))) return NextResponse.json({ error: 'Too many attempts. Please wait a minute.' }, { status: 429 });

  const parsed = purchaseRequestSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });

  const admin = createAdminClient();

  // Free any reservation whose 15-minute window has passed, so an abandoned
  // checkout never leaves a ticket stuck as RESERVED (the cause of repeat 409s).
  // (scoped to this listing; the cron job sweeps the rest)
  {
    const { data: l0 } = await admin.from('ticket_listings').select('status, reservation_expires_at').eq('id', parsed.data.listingId).maybeSingle();
    if (l0?.status === 'RESERVED' && l0.reservation_expires_at && new Date(l0.reservation_expires_at) <= new Date()) await admin.rpc('release_expired_reservations');
    if (l0 && (l0.status === 'SOLD' || l0.status === 'CANCELLED' || l0.status === 'EXPIRED')) {
      return NextResponse.json({ error: 'Sorry, this ticket is sold out.', soldOut: true }, { status: 409 });
    }
  }

  const resumed = await resumeOwnReservation(admin, parsed.data.listingId, user.id);
  if (resumed) return resumed;
  const { data: current } = await admin.from('ticket_listings').select('status, reserved_by').eq('id', parsed.data.listingId).maybeSingle();
  if (current?.status === 'RESERVED' && current.reserved_by !== user.id) {
    return NextResponse.json({ error: 'Another buyer is completing payment for this ticket right now. Please check back in a few minutes.' }, { status: 409 });
  }

  // Keys are namespaced by user so one buyer can never collide with (or be handed) another buyer's order.
  const clientKey = (req.headers.get('idempotency-key') || '').slice(0, 100) || randomUUID();
  const idempotencyKey = `${user.id}:${clientKey}`;

  const { data, error } = await admin.rpc('reserve_listing_for_purchase', {
    p_listing_id: parsed.data.listingId,
    p_buyer_id: user.id,
    p_idempotency_key: idempotencyKey
  });

  if (error) {
    console.error('[purchase] reserve_listing_for_purchase failed:', error.message);
    const friendly: Record<string, string> = {
      LISTING_NOT_AVAILABLE: 'Sorry, this ticket has just been purchased.',
      TICKET_NOT_AVAILABLE: 'Sorry, this ticket has just been purchased.',
      idx_orders_one_open: 'Sorry, this ticket has just been purchased.',
      uq_orders_one_open_per_listing: 'Sorry, this ticket has just been purchased.',
      LISTING_NOT_FOUND: 'This listing no longer exists.',
      CANNOT_BUY_OWN_LISTING: 'You cannot purchase your own listing.',
      IDEMPOTENCY_KEY_CONFLICT: 'Please try again.'
    };
    // Double-click race: our own request won the lock first, so show the buyer their order instead of an error.
    if (error.message.includes('LISTING_NOT_AVAILABLE')) { const again = await resumeOwnReservation(admin, parsed.data.listingId, user.id); if (again) return again; }
    const key = Object.keys(friendly).find(k => error.message.includes(k));
    // 409 only for real conflicts; anything unexpected is a server error.
    return NextResponse.json({ error: key ? friendly[key] : 'Could not complete the purchase. Please try again.' }, { status: key ? 409 : 500 });
  }

  const order = Array.isArray(data) ? data[0] : data;

  // Record the buyer's acceptance of the "you're buying at your own risk"
  // terms, tied to this specific order — the counterpart to the seller's
  // listing-terms consent recorded when the listing was created.
  await admin.from('consents').insert({
    user_id: user.id,
    consent_type: 'BUYER_PURCHASE_RISK',
    order_id: order?.order_id,
    ip_address: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent')
  });

  return NextResponse.json({ order, idempotencyKey: clientKey });
}
