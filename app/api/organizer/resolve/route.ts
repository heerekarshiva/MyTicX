import { NextRequest } from 'next/server';
import { requireOrganizer, loadOwnedEvent, limited, fail, json } from '@/lib/events/server';
import { tokenFrom } from '@/lib/events/organizer';

// Maps a scanned/opened pass link to the event it belongs to — but only for
// that event's own organizer (or admin). Everyone else gets the same generic 404.
export async function GET(req: NextRequest) {
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  if (limited(req, 'resolve', g.ctx.user.id, 60)) return fail('Too many requests.', 429);
  const token = tokenFrom(new URL(req.url).searchParams.get('token') ?? '');
  if (!token) return fail('Invalid pass.', 404);
  const { data: reg } = await g.ctx.admin.from('event_registrations').select('event_id').eq('check_in_token', token).maybeSingle();
  const ev = reg ? await loadOwnedEvent(g.ctx, reg.event_id) : null;
  return ev ? json({ eventId: ev.id }) : fail('Invalid pass.', 404);
}
