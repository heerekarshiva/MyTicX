import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireOrganizer, sameOrigin, limited, fail, json } from '@/lib/events/server';
import { resolveScan } from '@/lib/events/organizer';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  if (limited(req, 'checkin', g.ctx.user.id, 120)) return fail('Too many requests.', 429);
  const p = z.object({ eventId: z.string().uuid(), token: z.string().max(300) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return fail('Invalid request.');
  const r = await resolveScan(g.ctx, p.data.eventId as string, p.data.token as string);
  if ('error' in r) return fail(r.error as string, r.status as number);

  const { data: row, error } = await g.ctx.admin.from('check_ins').insert({
    event_id: r.ev.id, registration_id: r.reg.id, participant_id: r.reg.user_id, organizer_id: g.ctx.user.id
  }).select('checked_in_at').single();
  if (error) {
    if (error.code === '23505') { // UNIQUE(registration_id): duplicate check-in is impossible at DB level
      const { data: prev } = await g.ctx.admin.from('check_ins').select('checked_in_at').eq('registration_id', r.reg.id).single();
      return json({ ok: false, alreadyCheckedIn: true, checkedInAt: prev?.checked_in_at }, 409);
    }
    return fail('Could not record the check-in.', 500);
  }
  return json({ ok: true, checkedInAt: row.checked_in_at });
}
