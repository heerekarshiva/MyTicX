import Link from 'next/link';
import { CalendarDays, MapPin, Ticket } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Footer } from '@/components/Footer';
import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { JsonLd } from '@/components/JsonLd';
import { fmtDate, fmtTime } from '@/lib/events/time';
import { getPublicEvents, getPlatformTimezone } from '@/lib/events/public';
import { breadcrumbJsonLd } from '@/lib/events/schema';
import { pageMeta } from '@/lib/seo';
import { abs } from '@/lib/site';

export const revalidate = 60;

export const metadata = pageMeta({
  title: 'Upcoming Events – Register Online for College & Community Events',
  description: 'Discover upcoming college fests, workshops and community events open for registration on MyTICX. Free and paid events, instant QR entry pass.',
  path: '/events'
});

export default async function EventsPage() {
  const [events, tz] = await Promise.all([getPublicEvents(), getPlatformTimezone()]);

  const schema = [
    breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Events', path: '/events' }]),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: events.slice(0, 30).map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/events/${e.id}`), name: e.title }))
    }
  ];

  return (
    <div className="pb-20 lg:pb-0">
      <JsonLd data={schema} />
      <Navbar />
      <main className="container-page py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-navy-900">Upcoming events</h1>
            <p className="mt-1 text-sm text-slate-500">Open for registration — organized on MyTICX.</p>
          </div>
          <Link href="/my-registrations" className="flex items-center gap-1 text-sm font-medium text-brand-blue"><Ticket className="h-4 w-4" /> My registrations</Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.length === 0 && <div className="sm:col-span-2 lg:col-span-3"><EmptyState title="No events open for registration." subtitle="Check back soon." /></div>}
          {events.map(ev => (
            <Link key={ev.id} href={`/events/${ev.id}`} className="block rounded-xl2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue">
              <Card className="h-full overflow-hidden !p-0 transition hover:-translate-y-0.5">
                <div className="h-36 w-full overflow-hidden bg-brand-gradient-soft">
                  {ev.poster_url && <img src={ev.poster_url} alt={`${ev.title} poster`} loading="lazy" decoding="async" className="h-full w-full object-cover" />}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2"><h2 className="font-semibold text-navy-900">{ev.title}</h2>{ev.event_type && <Badge tone="info">{ev.event_type}</Badge>}</div>
                  {ev.college_name && <p className="mt-0.5 text-xs text-slate-500">{ev.college_name}</p>}
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" /> <time dateTime={ev.start_at}>{fmtDate(ev.start_at, tz)} • {fmtTime(ev.start_at, tz)}</time></p>
                  {(ev.venue || ev.city) && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3.5 w-3.5" /> {[ev.venue, ev.city].filter(Boolean).join(', ')}</p>}
                  <p className="mt-3 text-lg font-bold text-navy-900">{ev.registration_type === 'PAID' ? `₹${Number(ev.amount).toFixed(0)}` : 'Free'}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
      <MobileBottomNav />
    </div>
  );
}
