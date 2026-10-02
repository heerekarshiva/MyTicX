import 'server-only';
import { createClient } from '@supabase/supabase-js';

// SERVICE ROLE client. Bypasses RLS entirely — this file must never be
// imported from any 'use client' component, and the key must never be
// exposed via a NEXT_PUBLIC_ env var. Used only inside route handlers /
// server actions for operations that must be authoritative: ticket
// verification, purchase reservation, payment finalization, admin actions.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase admin client is not configured (missing service role key).');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
