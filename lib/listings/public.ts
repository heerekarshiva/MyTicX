import 'server-only';
import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

export const MARKETPLACE_PAGE_SIZE = 24;

export interface MarketplaceRow {
  listing_id: string; resale_price: number; platform_fee: number; original_price: number; seat_label: string | null;
  verification_status: string; movie_id?: string | null; movie_title: string | null; language: string | null; poster_url: string | null;
  theatre_name: string | null; location: string | null; show_date: string | null; show_time: string | null;
  seller_phone_verified: boolean; seller_id?: string; status?: string; created_at?: string;
}

const clean = (v: string | null | undefined) => (v ?? '').trim().replace(/[%_,()\\*]/g, ' ').slice(0, 80);

/**
 * Marketplace browse query shared by the /marketplace page (SSR) and GET /api/listings.
 * Only ACTIVE listings and marketplace-safe columns are ever returned.
 */
export async function queryMarketplace(opts: { q?: string | null; movie?: string | null; location?: string | null; language?: string | null; page?: number }) {
  const page = Math.max(1, Number(opts.page ?? 1) || 1);
  const q = clean(opts.q), movie = clean(opts.movie), location = clean(opts.location), language = clean(opts.language);
  let query = createAdminClient()
    .from('marketplace_listings_view')
    .select('listing_id, resale_price, platform_fee, original_price, seat_label, verification_status, movie_id, movie_title, language, poster_url, theatre_name, location, show_date, show_time, seller_phone_verified, seller_id, status, created_at', { count: 'exact' })
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false });
  if (q) query = query.or(`movie_title.ilike.%${q}%,theatre_name.ilike.%${q}%,location.ilike.%${q}%,language.ilike.%${q}%`);
  if (movie) query = query.ilike('movie_title', `%${movie}%`);
  if (location) query = query.ilike('location', `%${location}%`);
  if (language && language.toLowerCase() !== 'all') query = query.ilike('language', language);
  const { data, count, error } = await query.range((page - 1) * MARKETPLACE_PAGE_SIZE, page * MARKETPLACE_PAGE_SIZE - 1);
  return { rows: (data ?? []) as MarketplaceRow[], total: count ?? 0, page, pageSize: MARKETPLACE_PAGE_SIZE, error };
}

/** SSR-safe variant: never throws, returns an empty list if the database is unreachable. */
const cachedQuery = unstable_cache(
  async (q: string, language: string) => {
    const r = await queryMarketplace({ q, language });
    if (r.error) throw new Error(r.error.message);
    return { rows: r.rows };
  },
  ['marketplace-v1'],
  { revalidate: 15 } // a traffic spike reads this cache instead of hitting Postgres; purchases always re-check live status
);

export async function getMarketplaceSafe(opts: Parameters<typeof queryMarketplace>[0]) {
  try {
    if (!opts.movie && !opts.location && (opts.page ?? 1) === 1) {
      const c = await cachedQuery((opts.q ?? '').trim().slice(0, 80), opts.language ?? 'all');
      return { rows: c.rows, failed: false };
    }
    const r = await queryMarketplace(opts);
    if (r.error) { console.error('[marketplace] ssr query failed:', r.error.message); return { rows: [] as MarketplaceRow[], failed: true }; }
    return { rows: r.rows, failed: false };
  } catch (e) {
    console.error('[marketplace] ssr unavailable:', (e as Error).message);
    return { rows: [] as MarketplaceRow[], failed: true };
  }
}
