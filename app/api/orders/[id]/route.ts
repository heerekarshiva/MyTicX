import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Returns everything the order's buyer or seller need to see the payment
// step: order totals, the SELLER's own UPI ID (never a hardcoded one — see
// lib/providers/payment-provider.ts), and any manual payment proof already
// submitted. Uses the admin client because it needs to read the seller's
// profile on the buyer's behalf, but manually enforces that the caller is
// either the buyer or the seller before returning anything.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('*').eq('id', params.id).single();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.buyer_id !== user.id && order.seller_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized to view this order' }, { status: 403 });
  }

  const { data: seller } = await admin.from('profiles').select('upi_id, upi_payee_name, full_name').eq('id', order.seller_id).single();
  const { data: proof } = await admin
    .from('manual_payment_proofs')
    .select('*')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    order,
    phonepeEnabled: process.env.PAYMENT_PROVIDER === 'phonepe',
    isBuyer: order.buyer_id === user.id,
    isSeller: order.seller_id === user.id,
    sellerUpi: order.buyer_id === user.id ? { upiId: seller?.upi_id ?? null, payeeName: seller?.upi_payee_name ?? seller?.full_name ?? 'Seller' } : null,
    proof: proof ?? null
  });
}
