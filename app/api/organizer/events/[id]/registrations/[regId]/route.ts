import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireOrganizer, loadOwnedEvent, sameOrigin, fail, json, notify } from '@/lib/events/server';

// Server-side payment verification for the manual-UPI architecture: the
// event owner checks the UTR against their own UPI app/bank, then confirms.
// Only this step (never the browser) moves a registration to CONFIRMED/PAID.
export async function POST(req: NextRequest, { params }: { params: { id: string; regId: string } }) {
  if (!sameOrigin(req)) return fail('Bad origin.', 403);
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  const { ctx } = g;
  const p = z.object({ action: z.enum(['confirm', 'reject']) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return fail('Invalid request.');
  const ev = await loadOwnedEvent(ctx, params.id);
  if (!ev) return fail('Event not found.', 404);
  const { data: reg } = await ctx.admin.from('event_registrations').select('*').eq('id', params.regId).eq('event_id', ev.id).maybeSingle();
  if (!reg) return fail('Registration not found.', 404);
  if (reg.status !== 'SUBMITTED') return fail('Nothing to verify — the participant has not submitted a payment reference.', 409);
  const confirm = p.data.action === 'confirm';
  await ctx.admin.from('event_registrations').update({ status: confirm ? 'CONFIRMED' : 'REJECTED', confirmed_at: confirm ? new Date().toISOString() : null }).eq('id', reg.id);
  await notify(reg.user_id, confirm ? 'EVENT_PAYMENT_CONFIRMED' : 'EVENT_PAYMENT_REJECTED',
    confirm ? 'Registration confirmed' : 'Payment not confirmed',
    confirm ? `You're registered for ${ev.title}. Your QR pass is ready.` : `Your payment for ${ev.title} could not be confirmed. Contact the organizer.`);
  return json({ ok: true });
}
