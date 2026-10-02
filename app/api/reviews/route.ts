import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkMessage } from '@/lib/chat/moderation';

const reviewSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional()
});

// GET ?orderId=  -> the caller's review for that order (or null)
// GET ?sellerId= -> seller's average rating + latest reviews
export async function GET(req: NextRequest) {
  const admin = createAdminClient();
  const sellerId = req.nextUrl.searchParams.get('sellerId');
  const orderId = req.nextUrl.searchParams.get('orderId');

  if (sellerId) {
    const { data } = await admin.from('reviews').select('rating, comment, created_at').eq('seller_id', sellerId).order('created_at', { ascending: false }).limit(20);
    const rows = data ?? [];
    const average = rows.length ? rows.reduce((a, r) => a + r.rating, 0) / rows.length : null;
    return NextResponse.json({ average, count: rows.length, reviews: rows });
  }
  if (orderId) {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { data } = await admin.from('reviews').select('rating, comment').eq('order_id', orderId).eq('reviewer_id', user.id).maybeSingle();
    return NextResponse.json({ review: data ?? null });
  }
  return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
}

// The buyer can review the seller at any time once the order is paid. When the
// review is saved, the buyer/seller chat for that listing is deleted.
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = reviewSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Choose a rating from 1 to 5 stars.' }, { status: 400 });
  const { orderId, rating, comment } = parsed.data;

  if (comment && !checkMessage(comment).ok) {
    return NextResponse.json({ error: "Reviews can't include phone numbers, emails or links." }, { status: 422 });
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, listing_id, buyer_id, seller_id, status').eq('id', orderId).single();
  if (!order || order.buyer_id !== user.id) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (order.status !== 'PAID' && order.status !== 'TRANSFERRED') {
    return NextResponse.json({ error: 'You can review the seller once your payment is confirmed.' }, { status: 409 });
  }

  const { error } = await admin.from('reviews').insert({
    order_id: orderId, reviewer_id: user.id, seller_id: order.seller_id, rating, comment: comment || null
  });
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'You already reviewed this order.' }, { status: 409 });
    console.error('[reviews] insert failed:', error.message);
    return NextResponse.json({ error: 'Could not save your review.' }, { status: 500 });
  }

  // Sale is complete and reviewed — delete the chat for this listing.
  await admin.from('messages').delete().eq('listing_id', order.listing_id);
  await admin.from('notifications').insert({
    user_id: order.seller_id, type: 'REVIEW_RECEIVED', title: 'New review', body: `You received a ${rating}-star review.`
  });

  return NextResponse.json({ ok: true });
}
