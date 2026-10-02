import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyPhoneOtpSchema } from '@/lib/validation/schemas';
import { checkRateLimitShared } from '@/lib/rate-limit';

// Verifies the code Supabase Auth just emailed (see send-otp/route.ts) and,
// on success, saves the phone number the user entered. Supabase itself
// enforces the code's correctness, expiry (default 1 hour, configurable in
// Authentication -> Providers -> Email -> "OTP expiry") and attempt limits
// server-side — there is no local otp_hash / phone_verifications table to
// maintain anymore.
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = verifyPhoneOtpSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid phone number and the 8-digit code' }, { status: 400 });

  // Local guard against hammering this endpoint; Supabase also caps invalid
  // attempts against the code itself.
  if (!(await checkRateLimitShared(`verify-otp:${user.id}`, 5, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 });
  }

  const { error } = await supabase.auth.verifyOtp({
    email: user.email,
    token: parsed.data.otp,
    type: 'email'
  });

  if (error) {
    return NextResponse.json({ error: 'Incorrect or expired code.' }, { status: 400 });
  }

  // The OTP checked out — Supabase just reconfirmed control of the account
  // email, which is what this flow uses as a stand-in for phone ownership.
  // Persist the phone number the user entered as verified.
  const admin = createAdminClient();
  const { error: dbError } = await admin
    .from('profiles')
    .update({ phone: parsed.data.phone, phone_verified: true })
    .eq('id', user.id);

  if (dbError) {
    console.error('[verify-otp] failed to save phone:', dbError.message);
    return NextResponse.json({ error: 'Verified, but could not save your phone number. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
