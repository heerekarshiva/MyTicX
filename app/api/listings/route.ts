import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
import { calculatePlatformFee, getResalePriceBounds } from '@/lib/config/pricing';
import { queryMarketplace } from '@/lib/listings/public';

const createListingSchema = z.object({
  ticketId: z.string().uuid(),
  resalePrice: z.coerce.number().positive(),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the seller terms to list a ticket.' }) })
});

// Marketplace browse — only ever returns ACTIVE listings. Reads through the
// server-side admin client because the view joins tickets/profiles, which
// regular users can't read row-by-row under RLS (that is why other people's
// listings used to be invisible). Only marketplace-safe columns are returned.
// Params: q (searches title, theatre, city and language), movie, location,
// language, page.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const { rows, total, page, pageSize, error } = await queryMarketplace({
    q: sp.get('q'), movie: sp.get('movie'), location: sp.get('location'), language: sp.get('language'), page: Number(sp.get('page') ?? '1')
  });
  if (error) {
    console.error('[listings] browse failed:', error.message);
    return NextResponse.json({ error: 'Could not load marketplace listings.' }, { status: 500 });
  }
  return NextResponse.json({ listings: rows, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = createListingSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  const { ticketId, resalePrice } = parsed.data;

  const admin = createAdminClient();
  const { data: ticket } = await admin.from('tickets').select('*').eq('id', ticketId).single();
  if (!ticket || ticket.owner_id !== user.id) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }
  if (ticket.status !== 'VERIFIED') {
    return NextResponse.json({ error: 'Ticket is not eligible for listing yet.' }, { status: 409 });
  }

  const { min, max } = getResalePriceBounds(ticket.original_price);
  if (resalePrice < min - 0.01 || resalePrice > max + 0.01) {
    return NextResponse.json({ error: `Resale price must be between ₹${min.toFixed(2)} and ₹${max.toFixed(2)} (at least ₹50 below the original price).` }, { status: 400 });
  }

  const platformFee = calculatePlatformFee(resalePrice);

  const { data: listing, error } = await admin.from('ticket_listings').insert({
    ticket_id: ticketId,
    seller_id: user.id,
    resale_price: resalePrice,
    platform_fee: platformFee,
    status: 'ACTIVE'
  }).select().single();

  if (error) {
    const message = error.code === '23505'
      ? 'This ticket already has an active listing.'
      : 'Could not create the listing.';
    return NextResponse.json({ error: message }, { status: 409 });
  }

  await admin.from('tickets').update({ status: 'LISTED' }).eq('id', ticketId);

  // Record the seller's acceptance of the listing terms — used as the
  // evidentiary record referenced in fraud/refund disputes.
  await admin.from('consents').insert({
    user_id: user.id,
    consent_type: 'SELLER_LISTING_TERMS',
    listing_id: listing.id,
    ip_address: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent')
  });

  return NextResponse.json({ listing });
}

