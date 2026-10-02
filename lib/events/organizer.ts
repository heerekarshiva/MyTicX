import 'server-only';
import { loadOwnedEvent } from './server';
import { PAYMENT_LABEL } from './lifecycle';

export async function loadParticipants(ctx: any, eventId: string) {
  const { data: regs } = await ctx.admin.from('event_registrations')
    .select('id, user_id, amount, status, utr, registration_code, created_at, confirmed_at, profiles:user_id(full_name)')
    .eq('event_id', eventId).order('created_at', { ascending: false });
  const ids = (regs ?? []).map((r: any) => r.id);
  const values: Record<string, Record<string, string>> = {};
  if (ids.length) {
    const { data: vals } = await ctx.admin.from('registration_field_values').select('registration_id, field_key, value').in('registration_id', ids);
    for (const v of vals ?? []) (values[v.registration_id] ??= {})[v.field_key] = v.value ?? '';
  }
  const { data: cis } = await ctx.admin.from('check_ins').select('registration_id, checked_in_at').eq('event_id', eventId);
  const ci = new Map((cis ?? []).map((c: any) => [c.registration_id, c.checked_in_at]));
  return (regs ?? []).map((r: any) => ({
    id: r.id, registrationCode: r.registration_code, name: values[r.id]?.full_name || r.profiles?.full_name || 'Participant',
    createdAt: r.created_at, amount: r.amount, utr: r.utr, rawStatus: r.status, paymentStatus: PAYMENT_LABEL[r.status] ?? r.status,
    checkedInAt: ci.get(r.id) ?? null, answers: values[r.id] ?? {}
  }));
}


export const tokenFrom = (raw: string) => {
  const t = raw.trim().split('/').filter(Boolean).pop() ?? '';
  return /^[A-Za-z0-9_-]{20,80}$/.test(t) ? t : null;
};

/** Shared by /scan and /check-in so both run the identical authorization chain. */
export async function resolveScan(ctx: any, eventId: string, rawToken: string) {
  const token = tokenFrom(rawToken);
  if (!token) return { error: 'This is not a MyTICX pass.', status: 400 as const };
  const ev = await loadOwnedEvent(ctx, eventId);                       // 6. organizer may access this event
  if (!ev) return { error: 'Event not found.', status: 404 as const };
  if (ev.status === 'CANCELLED' || ev.status === 'SUSPENDED') return { error: 'This event is cancelled.', status: 409 as const };
  const { data: reg } = await ctx.admin.from('event_registrations').select('*, profiles:user_id(full_name)').eq('check_in_token', token).maybeSingle(); // 1+2. token valid, registration exists
  if (!reg) return { error: 'Invalid pass — no registration found.', status: 404 as const };
  if (reg.event_id !== ev.id) return { error: 'This pass is for a different event.', status: 409 as const };       // 3. belongs to this event
  if (reg.status !== 'CONFIRMED') return { error: reg.status === 'CANCELLED' ? 'This registration was cancelled.' : 'Payment is not confirmed for this pass.', status: 402 as const }; // 4. paid / confirmed
  return { ev, reg };
}

