import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { settlePhonePeOrder } from '@/lib/payments/settle';

// Called by the order page after the buyer returns from PhonePe (and while polling). Covers a late/missed webhook.
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  const { data: order } = await createAdminClient().from('orders').select('buyer_id').eq('id', orderId).maybeSingle();
  if (!order || order.buyer_id !== user.id) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  try { return NextResponse.json({ state: await settlePhonePeOrder(orderId) }); }
  catch { return NextResponse.json({ state: 'PENDING' }); }
}
