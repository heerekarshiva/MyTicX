import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, fail, json } from '@/lib/events/server';
import { effectiveStatus, PAYMENT_LABEL } from '@/lib/events/lifecycle';

export async function GET() {
  const user = await requireUser();
  if (!user) return fail('Please log in.', 401);
  const admin = createAdminClient();
  const { data } = await admin.from('event_registrations')
    .select('id, status, amount, registration_code, check_in_token, created_at, events!inner(id, title, venue, poster_url, start_at, end_at, status, registration_opens_at, registration_closes_at)')
    .eq('user_id', user.id).neq('status', 'CANCELLED').order('created_at', { ascending: false });
  const { data: cis } = await admin.from('check_ins').select('registration_id, checked_in_at').in('registration_id', (data ?? []).map(r => r.id));
  const ci = new Map((cis ?? []).map(c => [c.registration_id, c.checked_in_at]));
  return json({ registrations: (data ?? []).map((r: any) => ({
    id: r.id, code: r.registration_code, paymentStatus: PAYMENT_LABEL[r.status] ?? r.status, rawStatus: r.status, amount: r.amount,
    qrToken: r.status === 'CONFIRMED' ? r.check_in_token : null, checkedInAt: ci.get(r.id) ?? null,
    event: { ...r.events, status: effectiveStatus(r.events) }
  })) });
}
