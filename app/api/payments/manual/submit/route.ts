import { NextRequest, NextResponse } from 'next/server';
import { manualPaymentsEnabled } from '@/lib/payments/mode';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { manualPaymentSubmitSchema } from '@/lib/validation/schemas';

// Buyer's side of the manual-UPI flow: "I paid, here's my UTR/reference
// number." This does NOT mark the order paid — it only records the claim.
// The seller still has to confirm receipt (see manual/confirm/route.ts)
// before finalize_paid_order runs. This is a trust-based fallback for when
// there's no real payment gateway wired in; it is not a substitute for one.
export async function POST(req: NextRequest) {
  if (!manualPaymentsEnabled()) return NextResponse.json({ error: 'Not available.' }, { status: 404 });
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = manualPaymentSubmitSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  const { orderId, utr, screenshotPath } = parsed.data;

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('*').eq('id', orderId).single();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'Only the buyer can submit payment proof for this order' }, { status: 403 });

  const { data: proof, error } = await admin
    .from('manual_payment_proofs')
    .insert({
      order_id: orderId,
      buyer_id: order.buyer_id,
      seller_id: order.seller_id,
      utr,
      screenshot_path: screenshotPath ?? null,
      status: 'SUBMITTED'
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: 'Could not record payment proof.' }, { status: 500 });

  return NextResponse.json({ proof });
}
