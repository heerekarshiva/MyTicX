import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/supabase/require-admin';
import { confirmEventRegSchema } from '@/lib/validation/event-schemas';

// Admin confirms (or rejects) a submitted UTR after checking it against their
// own UPI app / bank statement — same manual-verification pattern as ticket
// order payments, no payment-gateway API involved.
export async function POST(req: NextRequest, { params }: { params: { regId: string } }) {
  const { error, status, user, admin } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const parsed = confirmEventRegSchema.safeParse({ ...(await req.json()), registrationId: params.regId });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });

  const { data: reg } = await admin.from('event_registrations').select('*, events!inner(created_by, title)').eq('id', params.regId).single();
  if (!reg || (reg as any).events.created_by !== user!.id) return NextResponse.json({ error: 'Registration not found.' }, { status: 404 });
  if (reg.status !== 'SUBMITTED') return NextResponse.json({ error: 'Nothing to confirm — no payment reference submitted yet.' }, { status: 409 });

  const newStatus = parsed.data.action === 'confirm' ? 'CONFIRMED' : 'REJECTED';
  const { error: dbErr } = await admin.from('event_registrations').update({
    status: newStatus,
    confirmed_at: newStatus === 'CONFIRMED' ? new Date().toISOString() : null
  }).eq('id', params.regId);
  if (dbErr) return NextResponse.json({ error: 'Could not update the registration.' }, { status: 500 });

  await admin.from('notifications').insert({
    user_id: reg.user_id,
    type: newStatus === 'CONFIRMED' ? 'EVENT_PAYMENT_CONFIRMED' : 'EVENT_PAYMENT_REJECTED',
    title: newStatus === 'CONFIRMED' ? 'Registration confirmed' : 'Payment not confirmed',
    body: newStatus === 'CONFIRMED'
      ? `You're registered for ${(reg as any).events.title}.`
      : `Your payment for ${(reg as any).events.title} could not be confirmed. Contact the organizer.`
  });

  return NextResponse.json({ ok: true });
}
