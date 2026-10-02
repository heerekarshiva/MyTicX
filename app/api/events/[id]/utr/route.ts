import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser, sameOrigin, limited, fail, json, notify } from '@/lib/events/server';
import { submitEventUtrSchema } from '@/lib/validation/event-schemas';

// "I paid — here's my UTR." Moves PENDING_PAYMENT -> SUBMITTED (PAYMENT_PROCESSING).
// It can NEVER confirm: only the event owner/admin verifying the payment does.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const user = await requireUser();
  if (!user) return fail('Please log in.', 401);
  if (limited(req, 'utr', user.id, 10)) return fail('Too many attempts.', 429);
  const parsed = submitEventUtrSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Invalid input');

  const admin = createAdminClient();
  const { data: reg } = await admin.from('event_registrations').select('*, events!inner(created_by, title)').eq('id', parsed.data.registrationId).eq('event_id', params.id).maybeSingle();
  if (!reg || reg.user_id !== user.id) return fail('Registration not found.', 404);
  if (reg.status === 'CONFIRMED') return fail('This registration is already confirmed.', 409);
  if (reg.status === 'CANCELLED') return fail('This registration was cancelled. Register again.', 409);
  const { error } = await admin.from('event_registrations').update({ status: 'SUBMITTED', utr: parsed.data.utr }).eq('id', reg.id);
  if (error) return fail('Could not submit payment reference.', 500);
  await notify((reg as any).events.created_by, 'EVENT_PAYMENT_SUBMITTED', 'Payment to verify', `A participant submitted a payment reference for ${(reg as any).events.title}.`);
  return json({ ok: true });
}
