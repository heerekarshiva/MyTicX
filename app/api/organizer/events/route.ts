import { NextRequest } from 'next/server';
import { requireOrganizer, sameOrigin, fail, json, withEffective, lazySync, notify } from '@/lib/events/server';
import { eventInputSchema, buildEvent, replaceFields } from '@/lib/events/event-input';

export async function GET() {
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  const { ctx } = g;
  await lazySync();
  let q = ctx.admin.from('events').select('*').order('created_at', { ascending: false });
  if (!ctx.isAdmin) q = q.eq('created_by', ctx.user.id); else q = q.eq('created_by', ctx.user.id);
  const { data: events, error } = await q;
  if (error) return fail('Could not load events. Has migration 0008 been run?', 500);
  const ids = (events ?? []).map(e => e.id);
  const counts: Record<string, { total: number; paid: number; checkedIn: number }> = {};
  if (ids.length) {
    const { data: regs } = await ctx.admin.from('event_registrations').select('id, event_id, status').in('event_id', ids).in('status', ['PENDING_PAYMENT', 'SUBMITTED', 'CONFIRMED']);
    const { data: cis } = await ctx.admin.from('check_ins').select('event_id').in('event_id', ids);
    for (const r of regs ?? []) { const c = (counts[r.event_id] ??= { total: 0, paid: 0, checkedIn: 0 }); c.total++; if (r.status === 'CONFIRMED') c.paid++; }
    for (const c of cis ?? []) { (counts[c.event_id] ??= { total: 0, paid: 0, checkedIn: 0 }).checkedIn++; }
  }
  return json({ events: (events ?? []).map(e => ({ ...withEffective(e), counts: counts[e.id] ?? { total: 0, paid: 0, checkedIn: 0 } })) });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  const { ctx } = g;
  const parsed = eventInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid input', 400);
  const built = await buildEvent(parsed.data);
  if ('error' in built) return fail(built.error!, 400);

  const status = parsed.data.publish ? 'PUBLISHED' : 'DRAFT';
  const { data: event, error } = await ctx.admin.from('events').insert({
    ...built.event, created_by: ctx.user.id, status, is_active: parsed.data.publish,
    published_at: parsed.data.publish ? new Date().toISOString() : null
  }).select().single();
  if (error || !event) { console.error('[organizer/events] insert', error?.message); return fail('Could not create the event.', 500); }
  await replaceFields(event.id, built.fields!);
  if (parsed.data.publish) { await ctx.admin.rpc('sync_event_statuses'); await notify(ctx.user.id, 'EVENT_PUBLISHED', 'Event published', `${event.title} is live.`); }
  return json({ event: withEffective(event) });
}
