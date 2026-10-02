import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireOrganizer, sameOrigin, limited, fail, json } from '@/lib/events/server';
import { resolveScan } from '@/lib/events/organizer';
import { maskPhone } from '@/lib/events/fields';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  if (limited(req, 'scan', g.ctx.user.id, 120)) return fail('Scanning too fast. Wait a moment.', 429);
  const p = z.object({ eventId: z.string().uuid(), token: z.string().max(300) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return fail('Invalid request.');
  const r = await resolveScan(g.ctx, p.data.eventId as string, p.data.token as string);
  if ('error' in r) return fail(r.error as string, r.status as number);

  const [{ data: fields }, { data: vals }, { data: ci }] = await Promise.all([
    g.ctx.admin.from('event_fields').select('field_key, label, field_type').eq('event_id', r.ev.id).order('sort_order'),
    g.ctx.admin.from('registration_field_values').select('field_key, label, value').eq('registration_id', r.reg.id),
    g.ctx.admin.from('check_ins').select('checked_in_at').eq('registration_id', r.reg.id).maybeSingle()
  ]);
  const v = new Map((vals ?? []).map(x => [x.field_key, x.value ?? '']));
  const details = (fields ?? []).map(f => ({ label: f.label, value: f.field_type === 'phone' ? maskPhone(v.get(f.field_key) ?? '') : (v.get(f.field_key) ?? '') }));
  return json({
    registrationCode: r.reg.registration_code, name: v.get('full_name') || r.reg.profiles?.full_name || 'Participant', event: r.ev.title,
    details, paymentStatus: r.ev.registration_type === 'FREE' ? 'FREE' : 'PAID',
    checkedIn: !!ci, checkedInAt: ci?.checked_in_at ?? null
  });
}
