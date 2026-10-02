import { requireAdminCtx, lazySync, fail, json, withEffective } from '@/lib/events/server';

export async function GET() {
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  await lazySync();
  const a = g.ctx.admin;
  const [{ data: evs, error }, { data: regs }, { count: checkIns }] = await Promise.all([
    a.from('events').select('id, status, start_at, end_at, registration_opens_at, registration_closes_at'),
    a.from('event_registrations').select('status, amount').neq('status', 'CANCELLED'),
    a.from('check_ins').select('id', { count: 'exact', head: true })
  ]);
  if (error) return fail('Could not load stats. Has migration 0008 been run?', 500);
  const st = (evs ?? []).map(e => withEffective(e as any).status);
  const c = (...s: string[]) => st.filter(x => s.includes(x)).length;
  const now = Date.now();
  return json({
    totalEvents: st.length, activeEvents: c('PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING'),
    registrationOpen: c('REGISTRATION_OPEN'), registrationClosed: c('REGISTRATION_CLOSED'),
    upcoming: (evs ?? []).filter(e => e.start_at && new Date(e.start_at).getTime() > now && !['DRAFT', 'CANCELLED', 'SUSPENDED'].includes(e.status)).length,
    completed: c('COMPLETED'), cancelled: c('CANCELLED'), totalRegistrations: regs?.length ?? 0,
    paidRegistrations: (regs ?? []).filter(r => Number(r.amount) > 0 && r.status === 'CONFIRMED').length,
    freeRegistrations: (regs ?? []).filter(r => Number(r.amount) === 0).length, checkIns: checkIns ?? 0
  });
}
