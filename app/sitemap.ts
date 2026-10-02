import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';
import { getPublicEvents } from '@/lib/events/public';
import { createAdminClient } from '@/lib/supabase/admin';

// Regenerated at most once an hour; a DB outage never breaks the sitemap, it just omits events.
export const revalidate = 900;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']) =>
    ({ url: `${SITE.url}${path}`, lastModified: now, changeFrequency, priority });

  const entries: MetadataRoute.Sitemap = [
    page('/', 1, 'daily'),
    page('/marketplace', 0.9, 'hourly'),
    page('/events', 0.9, 'hourly'),
    page('/suggestions', 0.6, 'weekly'),
    page('/how-it-works', 0.7, 'monthly'),
    page('/faq', 0.7, 'monthly'),
    page('/about', 0.5, 'monthly'),
    page('/contact', 0.4, 'yearly'),
    page('/terms', 0.3, 'yearly'),
    page('/privacy', 0.3, 'yearly')
  ];

  const events = await getPublicEvents();
  for (const e of events) {
    entries.push({ url: `${SITE.url}/events/${e.id}`, lastModified: e.updated_at ? new Date(e.updated_at) : now, changeFrequency: 'daily', priority: 0.8 });
  }
  try {
    const { data } = await createAdminClient().from('marketplace_listings_view').select('listing_id, created_at').eq('status', 'ACTIVE').order('created_at', { ascending: false }).limit(1000);
    for (const l of data ?? []) entries.push({ url: `${SITE.url}/listing/${l.listing_id}`, lastModified: l.created_at ? new Date(l.created_at) : now, changeFrequency: 'daily', priority: 0.6 });
  } catch { /* sitemap must never fail because of the DB */ }
  return entries;
}
