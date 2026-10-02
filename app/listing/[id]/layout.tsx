import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { JsonLd } from '@/components/JsonLd';
import { pageMeta, NOINDEX } from '@/lib/seo';
import { abs } from '@/lib/site';
import { breadcrumbJsonLd } from '@/lib/events/schema';

// Public listing page. Cached briefly so a traffic spike (or a crawler) can't hammer the database.
export const revalidate = 30;

async function getListing(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const { data } = await createAdminClient()
      .from('marketplace_listings_view')
      .select('listing_id, resale_price, platform_fee, original_price, movie_title, language, poster_url, theatre_name, location, show_date, show_time, status')
      .eq('listing_id', id).maybeSingle();
    return data;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const l = await getListing(params.id);
  if (!l) return NOINDEX;
  const title = `${l.movie_title ?? 'Movie ticket'}${l.theatre_name ? ` at ${l.theatre_name}` : ''}${l.location ? `, ${l.location}` : ''} – ₹${Number(l.resale_price).toFixed(0)}`;
  const description = `Verified resale ticket for ${l.movie_title ?? 'a movie'}${l.language ? ` (${l.language})` : ''}${l.show_date ? ` on ${l.show_date}` : ''}. Buy for ₹${Number(l.resale_price).toFixed(0)} on MyTICX.`;
  const meta = pageMeta({ title, description, path: `/listing/${params.id}`, image: l.poster_url });
  // Sold / reserved / expired tickets stay out of search results so people never land on a dead listing.
  return l.status === 'ACTIVE' ? meta : { ...meta, robots: { index: false, follow: true } };
}

export default async function Layout({ children, params }: { children: React.ReactNode; params: { id: string } }) {
  const l = await getListing(params.id);
  const schema = l ? [
    breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Marketplace', path: '/marketplace' }, { name: l.movie_title ?? 'Ticket', path: `/listing/${params.id}` }]),
    {
      '@context': 'https://schema.org', '@type': 'Product',
      name: `${l.movie_title ?? 'Movie ticket'}${l.theatre_name ? ` – ${l.theatre_name}` : ''}`,
      image: l.poster_url || undefined,
      description: `Resale movie ticket${l.language ? ` (${l.language})` : ''}${l.show_date ? `, show date ${l.show_date}` : ''}.`,
      offers: {
        '@type': 'Offer', url: abs(`/listing/${params.id}`), priceCurrency: 'INR', price: Number(l.resale_price),
        availability: l.status === 'ACTIVE' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut'
      }
    }
  ] : null;
  return <>{schema && <JsonLd data={schema} />}{children}</>;
}
