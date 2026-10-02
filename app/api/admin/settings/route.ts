import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdminCtx, sameOrigin, getSettings, fail, json } from '@/lib/events/server';

const schema = z.object({
  registration_cutoff_minutes: z.coerce.number().int().min(0).max(1440),
  timezone: z.string().refine(tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } }, 'Unknown timezone'),
  organizer_auto_approve: z.boolean(), allow_paid_events: z.boolean(), max_price: z.coerce.number().min(1).max(10_000_000),
  max_poster_mb: z.coerce.number().min(1).max(20), max_custom_fields: z.coerce.number().int().min(0).max(60),
  pending_payment_hold_minutes: z.coerce.number().int().min(5).max(1440), notify_organizer_on_registration: z.boolean(),
  organize_nav_enabled: z.boolean(), organize_nav_label: z.string().trim().min(2).max(40)
}).partial();

export async function GET() {
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  return json({ settings: await getSettings() });
}
export async function PATCH(req: NextRequest) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireAdminCtx(); if ('res' in g) return g.res;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(p.error.issues[0]?.message ?? 'Invalid settings');
  const rows = Object.entries(p.data).map(([key, value]) => ({ key, value: value as any, updated_by: g.ctx.user.id, updated_at: new Date().toISOString() }));
  if (rows.length) { const { error } = await g.ctx.admin.from('platform_settings').upsert(rows); if (error) return fail('Could not save settings.', 500); }
  return json({ settings: await getSettings() });
}
