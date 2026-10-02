import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { effectiveStatus, DEFAULT_CUTOFF_MINUTES } from './lifecycle';

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
export const fail = (error: string, status = 400, extra?: object) => NextResponse.json({ error, ...extra }, { status });

/** Platform settings (admin-controlled). Defaults mirror the migration seed. */
const DEFAULTS: Record<string, any> = {
  registration_cutoff_minutes: DEFAULT_CUTOFF_MINUTES, timezone: 'Asia/Kolkata', currency: 'INR',
  organizer_auto_approve: true, allow_paid_events: true, max_price: 100000, max_poster_mb: 5, max_custom_fields: 20,
  pending_payment_hold_minutes: 30, notify_organizer_on_registration: true, organize_nav_enabled: true,
  organize_nav_label: 'Organize Your Event'
};
export async function getSettings(): Promise<typeof DEFAULTS> {
  try {
    const { data } = await createAdminClient().from('platform_settings').select('key, value');
    const out = { ...DEFAULTS };
    for (const r of data ?? []) out[r.key] = r.value;
    return out;
  } catch { return { ...DEFAULTS }; }
}

/** CSRF defence for cookie-authenticated mutations: Origin/Host must match. */
export function sameOrigin(req: NextRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients; cookies still required
  try { return new URL(origin).host === (req.headers.get('x-forwarded-host') ?? req.headers.get('host')); } catch { return false; }
}

export function limited(req: NextRequest, bucket: string, userId: string | null, limit: number, windowMs = 60_000): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  return !checkRateLimit(`${bucket}:${userId ?? ip}`, limit, windowMs);
}

export async function requireUser() {
  const { data: { user } } = await createServerSupabaseClient().auth.getUser();
  return user;
}

export type Ctx = { user: { id: string; email?: string | null }; admin: ReturnType<typeof createAdminClient>; isAdmin: boolean; organizerOk: boolean };

/** Signed-in user + role resolution, entirely server-side. */
export async function getCtx(): Promise<Ctx | null> {
  const user = await requireUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';
  const { data: org } = await admin.from('event_organizers').select('status').eq('user_id', user.id).maybeSingle();
  return { user, admin, isAdmin, organizerOk: isAdmin || org?.status === 'ACTIVE' };
}

/** Organizer gate. Auto-enrols the caller when the admin setting allows it. */
export async function requireOrganizer(): Promise<{ ctx: Ctx } | { res: NextResponse }> {
  const ctx = await getCtx();
  if (!ctx) return { res: fail('Please log in.', 401) };
  if (ctx.organizerOk) return { ctx };
  const { data: org } = await ctx.admin.from('event_organizers').select('status').eq('user_id', ctx.user.id).maybeSingle();
  if (org?.status === 'SUSPENDED') return { res: fail('Your organizer account is suspended. Contact MyTICX support.', 403) };
  const settings = await getSettings();
  if (!org && settings.organizer_auto_approve) {
    const { data: p } = await ctx.admin.from('profiles').select('full_name').eq('id', ctx.user.id).single();
    await ctx.admin.from('event_organizers').insert({ user_id: ctx.user.id, status: 'ACTIVE', display_name: p?.full_name ?? null });
    return { ctx: { ...ctx, organizerOk: true } };
  }
  if (!org) await ctx.admin.from('event_organizers').insert({ user_id: ctx.user.id, status: 'PENDING', display_name: null });
  return { res: fail('Your organizer account is awaiting admin approval.', 403) };
}

export async function requireAdminCtx(): Promise<{ ctx: Ctx } | { res: NextResponse }> {
  const ctx = await getCtx();
  if (!ctx) return { res: fail('Please log in.', 401) };
  if (!ctx.isAdmin) return { res: fail('Admin access required.', 403) };
  return { ctx };
}

/** Ownership check: never trust an eventId from the client. Admin may access any event. */
export async function loadOwnedEvent(ctx: Ctx, eventId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  let q = ctx.admin.from('events').select('*').eq('id', eventId);
  if (!ctx.isAdmin) q = q.eq('created_by', ctx.user.id);
  const { data } = await q.maybeSingle();
  return data;
}

/** Secure random, URL-safe, 256-bit QR token. Contains no personal data. */
export const newToken = () => randomBytes(32).toString('base64url');
export const newRegCode = () => 'TX-' + randomBytes(4).toString('hex').toUpperCase();

export const withEffective = <T extends { status: string; start_at: string | null; end_at: string | null; registration_opens_at: string | null; registration_closes_at: string | null }>(e: T) =>
  ({ ...e, status: effectiveStatus(e) });

/** Opportunistic sync so stored status stays fresh even without cron. */
export async function lazySync() { try { await createAdminClient().rpc('sync_event_statuses'); } catch { /* migration pending */ } }

export async function notify(userId: string, type: string, title: string, body: string) {
  try { await createAdminClient().from('notifications').insert({ user_id: userId, type, title, body }); } catch { /* best-effort */ }
}

export const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
};
