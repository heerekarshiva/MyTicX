import 'server-only';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Every admin route calls this first. Never trust a client-side role check
// alone — this re-verifies profiles.role = 'admin' server-side using the
// caller's own session, independent of middleware.ts.
export async function requireAdmin() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' as const, status: 401 as const, user: null, admin: null };

  const admin = createAdminClient();
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return { error: 'Admin access required' as const, status: 403 as const, user: null, admin: null };

  return { error: null, status: 200 as const, user, admin };
}
