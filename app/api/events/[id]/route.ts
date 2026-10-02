import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, getSettings, fail, json, lazySync } from '@/lib/events/server';
import { effectiveStatus } from '@/lib/events/lifecycle';

// Public event page data. Includes the caller's OWN registration (and QR token
// only once payment is confirmed). Never returns other participants' data.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return fail('Event not found.', 404);
  await lazySync();
  const admin = createAdminClient();
  const user = await requireUser();
  const { data: ev } = await admin.from('events').select('*').eq('id', params.id).maybeSingle();
  if (!ev) return fail('Event not found.', 404);
  const status = effectiveStatus(ev);
  const isOwner = !!user && ev.created_by === user.id;
  let isAdmin = false;
  if (user) isAdmin = (await admin.from('profiles').select('role').eq('id', user.id).single()).data?.role === 'admin';
  if (status === 'DRAFT' && !isOwner && !isAdmin) return fail('Event not found.', 404);

  const [{ data: fields }, settings] = await Promise.all([
    admin.from('event_fields').select('id, field_key, label, field_type, placeholder, options, validation, is_required').eq('event_id', ev.id).order('sort_order'),
    getSettings()
  ]);

  let registration: any = null, payment: any = null;
  if (user) {
    const { data: r } = await admin.from('event_registrations').select('id, status, utr, amount, registration_code, check_in_token, created_at').eq('event_id', ev.id).eq('user_id', user.id).maybeSingle();
    if (r && r.status !== 'CANCELLED') {
      const { check_in_token, ...rest } = r;
      registration = { ...rest, qrToken: r.status === 'CONFIRMED' ? check_in_token : null };
      if (['PENDING_PAYMENT', 'SUBMITTED', 'REJECTED'].includes(r.status)) payment = { upiId: ev.organizer_upi_id, payeeName: ev.organizer_payee_name };
      const { data: ci } = await admin.from('check_ins').select('checked_in_at').eq('registration_id', r.id).maybeSingle();
      registration.checkedInAt = ci?.checked_in_at ?? null;
    }
  }

  let spotsLeft: number | null = null;
  if (ev.capacity) {
    const { count } = await admin.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', ev.id).in('status', ['PENDING_PAYMENT', 'SUBMITTED', 'CONFIRMED']);
    spotsLeft = Math.max(0, ev.capacity - (count ?? 0));
  }
  return json({
    timezone: settings.timezone, spotsLeft, fields: fields ?? [], registration, payment, isOwner,
    event: {
      id: ev.id, event_type: ev.event_type, title: ev.title, description: ev.description, details: ev.details, venue: ev.venue, city: ev.city,
      college_name: ev.college_name, organizer_name: ev.organizer_name, poster_url: ev.poster_url, start_at: ev.start_at, end_at: ev.end_at,
      registration_closes_at: ev.registration_closes_at, registration_type: ev.registration_type, amount: ev.amount, capacity: ev.capacity, status
    }
  });
}
