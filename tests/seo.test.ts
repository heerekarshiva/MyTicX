import { describe, it, expect } from 'vitest';
import { eventJsonLd, breadcrumbJsonLd } from '@/lib/events/schema';
import { pageMeta, NOINDEX } from '@/lib/seo';
import { abs } from '@/lib/site';

const base = {
  id: 'e1', title: 'TechFest', description: 'Hackathon', venue: 'Hall', city: 'Hyderabad', college_name: 'CBIT', organizer_name: 'Club',
  poster_url: 'https://x/y.jpg', start_at: '2026-10-20T04:30:00Z', end_at: '2026-10-21T04:30:00Z', registration_closes_at: '2026-10-20T04:00:00Z',
  registration_type: 'PAID', amount: 199, capacity: 100, status: 'REGISTRATION_OPEN'
};

describe('event structured data', () => {
  it('maps a paid open event to a valid schema.org Event with an in-stock INR offer', () => {
    const j: any = eventJsonLd(base, { spotsLeft: 10 });
    expect(j['@type']).toBe('Event');
    expect(j.offers.price).toBe(199);
    expect(j.offers.priceCurrency).toBe('INR');
    expect(j.offers.availability).toBe('https://schema.org/InStock');
    expect(j.isAccessibleForFree).toBe(false);
    expect(j.eventStatus).toBe('https://schema.org/EventScheduled');
  });
  it('marks a full event SoldOut, a free event free, and a cancelled event EventCancelled', () => {
    expect((eventJsonLd(base, { spotsLeft: 0 }) as any).offers.availability).toBe('https://schema.org/SoldOut');
    const free: any = eventJsonLd({ ...base, registration_type: 'FREE', amount: null });
    expect(free.offers.price).toBe(0);
    expect(free.isAccessibleForFree).toBe(true);
    expect((eventJsonLd({ ...base, status: 'CANCELLED' }) as any).eventStatus).toBe('https://schema.org/EventCancelled');
  });
  it('builds an ordered breadcrumb with absolute URLs', () => {
    const b: any = breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Events', path: '/events' }]);
    expect(b.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
    expect(b.itemListElement[1].item).toBe(abs('/events'));
    expect(b.itemListElement[1].item.startsWith('http')).toBe(true);
  });
});

describe('page metadata', () => {
  it('sets a per-page canonical and never inherits "/"', () => {
    const m: any = pageMeta({ title: 'T', description: 'D', path: '/faq' });
    expect(m.alternates.canonical).toBe('/faq');
    expect(m.openGraph.url).toBe('/faq');
    expect(m.robots).toBeUndefined();
  });
  it('supports noindex and per-page images', () => {
    expect((pageMeta({ title: 'T', description: 'D', path: '/x', noindex: true }) as any).robots.index).toBe(false);
    expect((pageMeta({ title: 'T', description: 'D', path: '/x', image: 'https://i/p.jpg' }) as any).openGraph.images[0].url).toBe('https://i/p.jpg');
    expect((NOINDEX as any).robots.index).toBe(false);
  });
});
