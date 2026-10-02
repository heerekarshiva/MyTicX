import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EventClient from './EventClient';
import { JsonLd } from '@/components/JsonLd';
import { getEventPageData } from '@/lib/events/public';
import { breadcrumbJsonLd, eventJsonLd } from '@/lib/events/schema';
import { fmtDate } from '@/lib/events/time';
import { NOINDEX, pageMeta } from '@/lib/seo';

export const revalidate = 60;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const r = await getEventPageData(params.id);
  if (r.state !== 'ok') return { ...NOINDEX, title: 'Event' };
  const { event: ev, timezone: tz } = r.detail;
  const when = ev.start_at ? fmtDate(ev.start_at, tz) : '';
  const place = [ev.venue, ev.city].filter(Boolean).join(', ');
  const price = ev.registration_type === 'PAID' ? `₹${Number(ev.amount).toFixed(0)} registration` : 'Free registration';
  const title = clip(`${ev.title}${when ? ` – ${when}` : ''}${ev.city ? `, ${ev.city}` : ''}`, 70);
  const description = clip(
    (ev.description as string | null)?.replace(/\s+/g, ' ').trim() ||
      `Register for ${ev.title}${ev.college_name ? ` at ${ev.college_name}` : ''}${when ? ` on ${when}` : ''}${place ? ` · ${place}` : ''}. ${price} on MyTICX with an instant QR entry pass.`,
    160
  );
  return pageMeta({ title, description, path: `/events/${params.id}`, image: ev.poster_url, noindex: !r.indexable });
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const r = await getEventPageData(params.id);
  if (r.state === 'missing') notFound(); // real HTTP 404 so Google drops removed events

  return (
    <>
      {r.state === 'ok' && (
        <JsonLd data={[
          eventJsonLd(r.detail.event, { spotsLeft: r.detail.spotsLeft }),
          breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Events', path: '/events' }, { name: r.detail.event.title, path: `/events/${params.id}` }])
        ]} />
      )}
      <EventClient id={params.id} initial={r.state === 'ok' ? r.detail : null} />
    </>
  );
}
