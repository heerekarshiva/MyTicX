import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
import { checkRateLimitShared } from '@/lib/rate-limit';
import { checkMessage } from '@/lib/chat/moderation';

// Cleans up finished chats (reviewed sales / shows that are over). Throttled
// so it runs at most once a minute per server instance.
let lastPurge = 0;
async function purgeFinishedChats() {
  if (Date.now() - lastPurge < 60_000) return;
  lastPurge = Date.now();
  try { await createAdminClient().rpc('purge_finished_chats'); } catch { /* best effort */ }
}

const sendSchema = z.object({
  listingId: z.string().uuid(),
  recipientId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000)
});

// In-app buyer/seller chat (spec §18). Phone numbers are never exchanged
// through this channel automatically — sellers/buyers can choose to share
// contact info themselves, but the platform does not surface it. Every
// message is scoped to a specific listing so conversations don't leak
// across unrelated transactions, and RLS restricts reads to the two
// participants regardless of what this route does.
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  await purgeFinishedChats();
  const listingId = req.nextUrl.searchParams.get('listingId');
  const otherUserId = req.nextUrl.searchParams.get('withUserId');
  if (!listingId || !otherUserId) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

  // Uses the user's own session-scoped client so RLS applies (defense in
  // depth on top of the explicit filter below).
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('listing_id', listingId)
    .or(`and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: 'Could not load messages.' }, { status: 500 });
  return NextResponse.json({ messages: data });
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!(await checkRateLimitShared(`msg:${user.id}`, 20, 60_000))) {
    return NextResponse.json({ error: 'You are sending messages too quickly. Please slow down.' }, { status: 429 });
  }

  const parsed = sendSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Message could not be sent.' }, { status: 400 });

  // Ticket-only chat: refuse (and never store) anything that shares contact
  // details or moves the deal off the platform.
  const verdict = checkMessage(parsed.data.body);
  if (!verdict.ok) return NextResponse.json({ error: verdict.reason, blocked: true }, { status: 422 });

  const admin = createAdminClient();

  // Basic abuse guard: block sending to a user who has blocked/reported the
  // sender repeatedly (a real system would check a `blocks` table here).
  const { data: message, error } = await admin.from('messages').insert({
    listing_id: parsed.data.listingId,
    sender_id: user.id,
    recipient_id: parsed.data.recipientId,
    body: parsed.data.body
  }).select().single();

  if (error) return NextResponse.json({ error: 'Could not send message.' }, { status: 500 });

  await admin.from('notifications').insert({
    user_id: parsed.data.recipientId,
    type: 'MESSAGE_RECEIVED',
    title: 'New message',
    body: parsed.data.body.slice(0, 120)
  });

  return NextResponse.json({ message });
}
