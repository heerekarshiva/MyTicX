-- ============================================================================
-- Migration: switch phone verification to Supabase Auth's built-in email OTP
-- Run this against your existing Supabase project (SQL editor or `supabase
-- db push`) after deploying the updated app code.
--
-- Phone verification no longer stores its own OTP codes. Codes are now
-- generated, emailed, expired and checked by Supabase Auth itself (free,
-- via supabase.auth.signInWithOtp / verifyOtp) — see
-- app/api/phone/send-otp/route.ts and app/api/phone/verify-otp/route.ts.
-- This drops the now-unused local table and its policy.
-- ============================================================================

drop policy if exists phone_verif_no_client on phone_verifications;
drop table if exists phone_verifications;

-- Reminder (no SQL needed): in the Supabase dashboard, go to
-- Authentication -> Email Templates -> "Magic Link" and add {{ .Token }} to
-- the template body so the OTP email actually shows a 6-digit code.
