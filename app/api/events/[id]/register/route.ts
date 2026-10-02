import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, sameOrigin, limited, getSettings, fail, json, newToken, newRegCode, notify } from '@/lib/events/server';
import { effectiveStatus } from '@/lib/events/lifecycle';
import { validateAnswers, type FieldConfig } from '@/lib/events/fields';

const ERR: Record<string, [string, number]> = {
  EVENT_NOT_FOUND: ['Event not found.', 404], EVENT_NOT_OPEN: ['This event is not open for registration.', 409],
  NOT_OPEN_YET: ['Registration has not opened yet.', 409], REGISTRATION_CLOSED: ['Registration Closed', 409],
  ALREADY_REGISTERED: ['You are already registered for this event.', 409], EVENT_FULL: ['This event is full.', 409]
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const user = await requireUser();
  if (!user) return fail('Please log in to register.', 401);
  if (limited(req, 'register', user.id, 10)) return fail('Too many attempts. Please wait a minute.', 429);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return fail('Event not found.', 404);

  const admin = createAdminClient();
  const { data: ev } = await admin.from('events').select('*').eq('id', params.id).maybeSingle();
  if (!ev) return fail('Event not found.', 404);
  // Fast pre-check; the Postgres function re-checks atomically against the DB clock.
  if (effectiveStatus(ev) !== 'REGISTRATION_OPEN') return fail('Registration Closed', 409, { code: 'REGISTRATION_CLOSED' });

  const body = await req.json().catch(() => null);
  const { data: fieldRows } = await admin.from('event_fields').select('*').eq('event_id', ev.id).order('sort_order');
  const fields = (fieldRows ?? []) as (FieldConfig & { id: string })[];
  const v = validateAnswers(fields, body?.answers ?? {});
  if (!v.ok) return fail('Please fix the highlighted fields.', 422, { fieldErrors: v.errors });

  const settings = await getSettings();
  // Release stale unpaid holds so abandoned checkouts don't block capacity.
  const hold = Number(settings.pending_payment_hold_minutes) || 30;
  await admin.from('event_registrations').update({ status: 'CANCELLED' }).eq('event_id', ev.id).eq('status', 'PENDING_PAYMENT').lt('created_at', new Date(Date.now() - hold * 60_000).toISOString());

  const paid = ev.registration_type === 'PAID' && Number(ev.amount) > 0;
  const answers = fields.map(f => ({ event_field_id: f.id, field_key: f.field_key, label: f.label, value: v.values[f.field_key] }));
  const { data: reg, error } = await admin.rpc('register_for_event', {
    p_event_id: ev.id, p_user_id: user.id, p_status: paid ? 'PENDING_PAYMENT' : 'CONFIRMED', p_amount: paid ? ev.amount : 0,
    p_code: newRegCode(), p_token: newToken(), p_answers: answers
  });
  if (error) {
    const key = Object.keys(ERR).find(k => error.message.includes(k));
    if (key) return fail(ERR[key][0], ERR[key][1], { code: key });
    console.error('[events/register]', error.message);
    return fail('Could not register. Make sure migration 0008 has been run.', 500);
  }

  if (settings.notify_organizer_on_registration) {
    await notify(ev.created_by, 'EVENT_REGISTRATION', 'New registration', `${v.values.full_name || 'A participant'} registered for ${ev.title}.`);
  }
  if (!paid) await notify(user.id, 'EVENT_REGISTERED', 'Registration confirmed', `You're registered for ${ev.title}. Your QR pass is ready.`);
  return json({ registration: { id: reg.id, status: reg.status, registration_code: reg.registration_code, amount: reg.amount } });
}
