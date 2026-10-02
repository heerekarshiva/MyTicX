import { abs } from '@/lib/site';

/** schema.org Event JSON-LD (eligible for Google's event rich results). */
export function eventJsonLd(ev: any, detail: { spotsLeft?: number | null } = {}) {
  const paid = ev.registration_type === 'PAID';
  const full = detail.spotsLeft === 0;
  const open = ev.status === 'REGISTRATION_OPEN' || ev.status === 'PUBLISHED';
  const url = abs(`/events/${ev.id}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': `${url}#event`,
    name: ev.title,
    description: ev.description || ev.details || undefined,
    url,
    startDate: ev.start_at,
    endDate: ev.end_at || undefined,
    eventStatus: ev.status === 'CANCELLED' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: ev.poster_url ? [ev.poster_url] : undefined,
    location: {
      '@type': 'Place',
      name: ev.venue || ev.college_name || ev.city || 'Venue to be announced',
      address: { '@type': 'PostalAddress', streetAddress: ev.venue || undefined, addressLocality: ev.city || undefined, addressCountry: 'IN' }
    },
    organizer: { '@type': 'Organization', name: ev.organizer_name || ev.college_name || 'MyTICX', url: abs('/') },
    maximumAttendeeCapacity: ev.capacity || undefined,
    isAccessibleForFree: !paid,
    offers: {
      '@type': 'Offer',
      url,
      price: paid ? Number(ev.amount ?? 0) : 0,
      priceCurrency: 'INR',
      availability: full ? 'https://schema.org/SoldOut' : open ? 'https://schema.org/InStock' : undefined,
      validThrough: ev.registration_closes_at || ev.start_at || undefined
    }
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) }))
  };
}
