import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { effectiveStatus, isDiscoverable } from './lifecycle';

// Server-side reads for PUBLIC event pages (SSR / sitemap). Mirrors the public API routes:
// no participant data, organizer email or payment details ever leave this module.

const LIST_COLUMNS =
  'id, event_type, title, description, venue, city, college_name, organizer_name, start_at, end_at, registration_closes_at, registration_opens_at, registration_type, amount, poster_url, capacity, status, updated_at';

export interface PublicEventSummary {
  id: string; event_type: string | null; title: string; description: string | null; venue: string | null; city: string | null;
  college_name: string | null; organizer_name: string | null; start_at: string; end_at: string | null;
  registration_closes_at: string | null; registration_opens_at: string | null; registration_type: 'FREE' | 'PAID';
  amount: number | null; poster_url: string | null; capacity: number | null; status: string; updated_at: string | null;
}

export async function getPlatformTimezone(): Promise<string> {
  try {
    const { data } = await createAdminClient().from('platform_settings').select('value').eq('key', 'timezone').maybeSingle();
    return typeof data?.value === 'string' && data.value ? data.value : 'Asia/Kolkata';
  } catch { return 'Asia/Kolkata'; }
}

/** Upcoming events still open (or about to open) for registration. Never throws. */
export async function getPublicEvents(): Promise<PublicEventSummary[]> {
  try {
    const { data, error } = await createAdminClient().from('events').select(LIST_COLUMNS)
      .in('status', ['PUBLISHED', 'REGISTRATION_OPEN']).gt('start_at', new Date().toISOString()).order('start_at', { ascending: true });
    if (error) { console.error('[events] public list failed:', error.message); return []; }
    return ((data ?? []) as unknown as PublicEventSummary[]).filter(e => isDiscoverable(e as any));
  } catch (e) {
    console.error('[events] public list unavailable:', (e as Error).message);
    return [];
  }
}

export type EventPageData =
  | { state: 'missing' }
  | { state: 'error' }
  | { state: 'private' } // draft: only the owner/admin may see it, the client fetches it with their session
  | { state: 'ok'; detail: any; indexable: boolean };

const UUID = /^[0-9a-f-]{36}$/i;

/** Public event page payload, shaped exactly like GET /api/events/[id] for an anonymous visitor. */
export async function getEventPageData(id: string): Promise<EventPageData> {
  if (!UUID.test(id)) return { state: 'missing' };
  try {
    const admin = createAdminClient();
    const { data: ev, error } = await admin.from('events').select('*').eq('id', id).maybeSingle();
    if (error) return { state: 'error' };
    if (!ev) return { state: 'missing' };
    const status = effectiveStatus(ev);
    if (status === 'DRAFT') return { state: 'private' };

    const [{ data: fields }, tz] = await Promise.all([
      admin.from('event_fields').select('id, field_key, label, field_type, placeholder, options, validation, is_required').eq('event_id', ev.id).order('sort_order'),
      getPlatformTimezone()
    ]);
    let spotsLeft: number | null = null;
    if (ev.capacity) {
      const { count } = await admin.from('event_registrations').select('id', { count: 'exact', head: true })
        .eq('event_id', ev.id).in('status', ['PENDING_PAYMENT', 'SUBMITTED', 'CONFIRMED']);
      spotsLeft = Math.max(0, ev.capacity - (count ?? 0));
    }
    return {
      state: 'ok',
      indexable: status === 'REGISTRATION_OPEN' || status === 'PUBLISHED' || status === 'REGISTRATION_CLOSED',
      detail: {
        timezone: tz, spotsLeft, fields: fields ?? [], registration: null, payment: null, isOwner: false,
        event: {
          id: ev.id, event_type: ev.event_type, title: ev.title, description: ev.description, details: ev.details, venue: ev.venue, city: ev.city,
          college_name: ev.college_name, organizer_name: ev.organizer_name, poster_url: ev.poster_url, start_at: ev.start_at, end_at: ev.end_at,
          registration_closes_at: ev.registration_closes_at, registration_type: ev.registration_type, amount: ev.amount, capacity: ev.capacity, status
        }
      }
    };
  } catch (e) {
    console.error('[events] page data unavailable:', (e as Error).message);
    return { state: 'error' };
  }
}
