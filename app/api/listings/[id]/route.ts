import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Single listing for the detail page. Admin client for the same reason as the
// browse route (the view joins rows the buyer can't read under RLS).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('marketplace_listings_view')
    .select('listing_id, resale_price, platform_fee, original_price, seat_label, verification_status, movie_id, movie_title, language, poster_url, theatre_name, location, show_date, show_time, seller_phone_verified, seller_id, status')
    .eq('listing_id', params.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Listing not found.' }, { status: 404 });
  return NextResponse.json({ listing: data });
}
