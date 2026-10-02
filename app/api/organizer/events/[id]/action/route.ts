import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireOrganizer, loadOwnedEvent, sameOrigin, fail, json, withEffective, notify } from '@/lib/events/server';
import { replaceFields } from '@/lib/events/event-input';

const schema = z.object({ action: z.enum(['publish', 'unpublish', 'cancel', 'duplicate']), reason: z.string().trim().max(300).optional() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  const { ctx } = g;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail('Invalid action.');
  const ev = await loadOwnedEvent(ctx, params.id);
  if (!ev) return fail('Event not found.', 404);
  const eff = withEffective(ev).status;

  switch (p.data.action) {
    case 'publish': {
      if (eff !== 'DRAFT') return fail('Only drafts can be published.', 409);
      if (!ev.start_at || new Date(ev.registration_closes_at ?? ev.start_at).getTime() <= Date.now())
        return fail('This event starts too soon to publish. Edit the date/time first.', 409);
      const { count } = await ctx.admin.from('event_fields').select('id', { count: 'exact', head: true }).eq('event_id', ev.id);
      if (!count) return fail('Add participant fields before publishing.', 409);
      await ctx.admin.from('events').update({ status: 'PUBLISHED', is_active: true, published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', ev.id);
      await ctx.admin.rpc('sync_event_statuses');
      return json({ ok: true });
    }
    case 'unpublish': {
      if (!['PUBLISHED', 'REGISTRATION_OPEN'].includes(eff)) return fail('Only a published event with open registration can be unpublished.', 409);
      await ctx.admin.from('events').update({ status: 'DRAFT', is_active: false, updated_at: new Date().toISOString() }).eq('id', ev.id);
      return json({ ok: true });
    }
    case 'cancel': {
      if (['COMPLETED', 'CANCELLED'].includes(eff)) return fail('This event is already finished.', 409);
      await ctx.admin.from('events').update({ status: 'CANCELLED', is_active: false, cancelled_at: new Date().toISOString(), cancel_reason: p.data.reason ?? null, updated_at: new Date().toISOString() }).eq('id', ev.id);
      const { data: regs } = await ctx.admin.from('event_registrations').select('user_id').eq('event_id', ev.id).neq('status', 'CANCELLED');
      await Promise.all((regs ?? []).map(r => notify(r.user_id, 'EVENT_CANCELLED', 'Event cancelled', `${ev.title} has been cancelled by the organizer.`)));
      return json({ ok: true });
    }
    case 'duplicate': {
      const { id, created_at, updated_at, published_at, cancelled_at, cancel_reason, status, is_active, start_at, end_at, registration_closes_at, registration_opens_at, event_date, event_time, ...rest } = ev;
      const { data: copy, error } = await ctx.admin.from('events').insert({
        ...rest, title: `${ev.title} (copy)`, created_by: ctx.user.id, status: 'DRAFT', is_active: false,
        start_at: null, end_at: null, registration_closes_at: null, event_date: null, event_time: null
      }).select().single();
      if (error || !copy) return fail('Could not duplicate the event.', 500);
      const { data: fields } = await ctx.admin.from('event_fields').select('definition_id, field_key, label, field_type, placeholder, options, validation, is_required, sort_order').eq('event_id', ev.id);
      await replaceFields(copy.id, fields ?? []);
      return json({ ok: true, eventId: copy.id });
    }
  }
}
