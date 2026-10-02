import { NextRequest } from 'next/server';
import { requireOrganizer, loadOwnedEvent, sameOrigin, fail, json, withEffective } from '@/lib/events/server';
import { eventInputSchema, buildEvent, replaceFields } from '@/lib/events/event-input';
import { canEditSchedule } from '@/lib/events/lifecycle';

export async function GET(_r: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  const ev = await loadOwnedEvent(g.ctx, params.id);
  if (!ev) return fail('Event not found.', 404);
  const { data: fields } = await g.ctx.admin.from('event_fields').select('*').eq('event_id', ev.id).order('sort_order');
  const { count } = await g.ctx.admin.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', ev.id).neq('status', 'CANCELLED');
  return json({ event: withEffective(ev), fields: fields ?? [], registrationCount: count ?? 0 });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  const { ctx } = g;
  const ev = await loadOwnedEvent(ctx, params.id);
  if (!ev) return fail('Event not found.', 404);
  const eff = withEffective(ev).status;
  if (['COMPLETED', 'CANCELLED'].includes(eff)) return fail(`A ${eff.toLowerCase()} event can no longer be edited.`, 409);

  const parsed = eventInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid input', 400);

  const scheduleLocked = !canEditSchedule(ev);
  const { count } = await ctx.admin.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', ev.id).neq('status', 'CANCELLED');
  const hasRegs = (count ?? 0) > 0;
  // Changing price after people registered would break existing payments.
  if (hasRegs && (parsed.data.registrationType !== ev.registration_type || (parsed.data.registrationType === 'PAID' && Number(parsed.data.price) !== Number(ev.amount)))) {
    return fail('Registration type and price cannot change once people have registered.', 409);
  }
  const built = await buildEvent({ ...parsed.data, publish: ev.status !== 'DRAFT' }, { scheduleLocked, existing: ev });
  if ('error' in built) return fail(built.error!, 400);

  const { data: updated, error } = await ctx.admin.from('events').update(built.event).eq('id', ev.id).select().single();
  if (error) return fail('Could not save changes.', 500);
  if (!hasRegs) await replaceFields(ev.id, built.fields!);
  await ctx.admin.rpc('sync_event_statuses');
  return json({ event: withEffective(updated), fieldsLocked: hasRegs, scheduleLocked });
}
