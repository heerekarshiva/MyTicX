'use client';
// Browser client — uses only the public anon key. Row Level Security is
// what actually protects data; the anon key alone grants nothing extra.
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
