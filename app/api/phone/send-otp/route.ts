import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { phoneSchema } from '@/lib/validation/schemas';
import { checkRateLimitShared } from '@/lib/rate-limit';

// Phone verification is delivered as an email OTP through Supabase Auth's
// built-in (free) email OTP flow — see
// https://supabase.com/docs/guides/auth/passwordless-login/auth-email-otp
//
// Why this replaced the old custom implementation: there is no reliable
// free SMS API for India, so this project was already emailing a code to
// the user's account email as a stand-in for phone verification. Doing
// that with our own crypto + a custom `phone_verifications` table + raw
// SMTP/nodemailer meant we owned code generation, hashing, expiry, and
// delivery ourselves. Supabase Auth already does all of that for free,
// tested, and rate-limited — so this route now just asks Supabase to send
// the code, and lib/providers/sms-provider.ts / the old phone_verifications
// table are gone.
//
// One-time setup required in the Supabase dashboard (free, no paid add-on):
//   1. Authentication -> Email Templates -> "Magic Link" -> add {{ .Token }}
//      to the template body so the email actually shows the code.
//   2. Authentication -> Providers -> Email -> "Email OTP Length" -> set
//      this to 6. Supabase projects can default to anywhere from 6-10
//      digits here; this app's OTP input and validation (otpSchema in
//      lib/validation/schemas.ts, OtpInput.tsx) both assume 6. If this
//      dashboard setting is left at 8+, the email will show an 8-digit
//      code that the 6-box UI can never fit, and every code will read as
//      "incorrect" — that mismatch, not a code bug, is what was causing
//      the reported OTP failures.
// For real production traffic, also set a custom SMTP sender under
// Authentication -> Emails -> SMTP Settings (Supabase's shared mailer is
// rate-limited and meant for low volume / testing) — a free tier like
// Brevo (300 emails/day) works fine and costs nothing.
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = phoneSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 });

  // Extra per-user guard on top of whatever rate limit your Supabase project
  // enforces (default: one OTP per 60 seconds per email).
  if (!(await checkRateLimitShared(`send-otp:${user.id}`, 3, 10 * 60_000))) {
    return NextResponse.json({ error: 'Too many code requests. Please wait a few minutes and try again.' }, { status: 429 });
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: user.email,
    // Never let this create a brand-new account — it must only re-verify
    // the already-signed-in user.
    options: { shouldCreateUser: false }
  });

  if (error) {
    console.error('[send-otp] Supabase signInWithOtp failed:', error.message);
    return NextResponse.json({ error: 'Could not send the verification code. Please try again shortly.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true, expiresInMinutes: 60, sentTo: user.email });
}
