import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdminCtx, sameOrigin, fail, json } from '@/lib/events/server';

export async function GET() {
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  const a = g.ctx.admin;
  const { data: orgs } = await a.from('event_organizers').select('*, profiles:user_id(full_name)').order('created_at', { ascending: false });
  const { data: evs } = await a.from('events').select('id, created_by');
  const evOwner = new Map((evs ?? []).map(e => [e.id, e.created_by]));
  const { data: regs } = await a.from('event_registrations').select('event_id').neq('status', 'CANCELLED');
  const eventsBy: Record<string, number> = {}, regsBy: Record<string, number> = {};
  for (const e of evs ?? []) eventsBy[e.created_by] = (eventsBy[e.created_by] ?? 0) + 1;
  for (const r of regs ?? []) { const o = evOwner.get(r.event_id); if (o) regsBy[o] = (regsBy[o] ?? 0) + 1; }
  // Emails live in auth.users (service role only).
  const emails = new Map<string, string>();
  const { data: list } = await a.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of list?.users ?? []) emails.set(u.id, u.email ?? '');
  return json({ items: (orgs ?? []).map((o: any) => ({ userId: o.user_id, name: o.display_name || o.profiles?.full_name || '—', email: emails.get(o.user_id) ?? '', status: o.status, organization: o.organization, suspendedReason: o.suspended_reason, createdAt: o.created_at, events: eventsBy[o.user_id] ?? 0, registrations: regsBy[o.user_id] ?? 0 })) });
}

export async function PATCH(req: NextRequest) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  const p = z.object({ userId: z.string().uuid(), status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']), reason: z.string().trim().max(300).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return fail('Invalid request.');
  const { error } = await g.ctx.admin.from('event_organizers').upsert({ user_id: p.data.userId, status: p.data.status, suspended_reason: p.data.status === 'SUSPENDED' ? p.data.reason ?? null : null, updated_at: new Date().toISOString() });
  if (error) return fail('Could not update the organizer.', 500);
  if (p.data.status === 'SUSPENDED') // suspended organizers' events stop taking registrations
    await g.ctx.admin.from('events').update({ status: 'SUSPENDED', is_active: false }).eq('created_by', p.data.userId).in('status', ['PUBLISHED', 'REGISTRATION_OPEN']);
  return json({ ok: true });
}
