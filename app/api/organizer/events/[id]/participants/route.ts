import { NextRequest } from 'next/server';
import { requireOrganizer, loadOwnedEvent, fail, json } from '@/lib/events/server';
import { loadParticipants } from '@/lib/events/organizer';

// Participant data is only ever returned here (owner/admin) — never on public routes.
export async function GET(_r: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  const ev = await loadOwnedEvent(g.ctx, params.id);
  if (!ev) return fail('Event not found.', 404);
  const { data: fields } = await g.ctx.admin.from('event_fields').select('field_key, label, field_type').eq('event_id', ev.id).order('sort_order');
  return json({ event: { id: ev.id, title: ev.title, registration_type: ev.registration_type, amount: ev.amount }, fields: fields ?? [], participants: await loadParticipants(g.ctx, ev.id) });
}
