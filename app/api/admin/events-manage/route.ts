import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdminCtx, sameOrigin, lazySync, fail, json, withEffective, notify } from '@/lib/events/server';

export async function GET() {
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  await lazySync();
  const a = g.ctx.admin;
  const { data: evs, error } = await a.from('events').select('*').order('created_at', { ascending: false });
  if (error) return fail('Could not load events.', 500);
  const { data: regs } = await a.from('event_registrations').select('event_id, status').neq('status', 'CANCELLED');
  const { data: cis } = await a.from('check_ins').select('event_id');
  const rc: Record<string, number> = {}, cc: Record<string, number> = {};
  for (const r of regs ?? []) rc[r.event_id] = (rc[r.event_id] ?? 0) + 1;
  for (const c of cis ?? []) cc[c.event_id] = (cc[c.event_id] ?? 0) + 1;
  const { data: list } = await a.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emails = new Map((list?.users ?? []).map(u => [u.id, u.email ?? '']));
  return json({ events: (evs ?? []).map(e => ({ ...withEffective(e), organizer_account_email: emails.get(e.created_by) ?? '', registrations: rc[e.id] ?? 0, checkIns: cc[e.id] ?? 0 })) });
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  const p = z.object({ eventId: z.string().uuid(), action: z.enum(['suspend', 'unsuspend', 'cancel', 'delete']), reason: z.string().trim().max(300).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return fail('Invalid request.');
  const a = g.ctx.admin;
  const { data: ev } = await a.from('events').select('id, title, status, created_by').eq('id', p.data.eventId).maybeSingle();
  if (!ev) return fail('Event not found.', 404);
  const now = new Date().toISOString();
  if (p.data.action === 'suspend') await a.from('events').update({ status: 'SUSPENDED', is_active: false, updated_at: now }).eq('id', ev.id);
  else if (p.data.action === 'unsuspend') { await a.from('events').update({ status: 'PUBLISHED', is_active: true, updated_at: now }).eq('id', ev.id); await a.rpc('sync_event_statuses'); }
  else if (p.data.action === 'cancel') {
    await a.from('events').update({ status: 'CANCELLED', is_active: false, cancelled_at: now, cancel_reason: p.data.reason ?? 'Cancelled by MyTICX admin', updated_at: now }).eq('id', ev.id);
    await notify(ev.created_by, 'EVENT_CANCELLED', 'Event cancelled by admin', `${ev.title} was cancelled by MyTICX admin.`);
  } else {
    // Safe delete: only events with no registrations. Otherwise cancel to keep records.
    const { count } = await a.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', ev.id);
    if (count) return fail('This event has registrations and cannot be deleted. Cancel it instead.', 409);
    await a.from('events').delete().eq('id', ev.id);
  }
  return json({ ok: true });
}
