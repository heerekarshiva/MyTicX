import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

// Minimal in-memory rate limiter. Fine for a single Node instance / demo;
// a production deployment with multiple instances should back this with
// Redis (Upstash) or a Postgres table instead, but the call-site interface
// below would stay identical.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/**
 * Shared (Postgres-backed) limiter for money / OTP / abuse-sensitive routes. Works across any number of
 * instances and survives deploys. If the DB call fails we fall back to the in-memory limiter (fail-soft, never fail-open to 500).
 */
export async function checkRateLimitShared(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const { data, error } = await createAdminClient().rpc('rate_limit_hit', { p_key: key, p_limit: limit, p_window_seconds: Math.ceil(windowMs / 1000) });
    if (error) throw error;
    return data === true;
  } catch {
    return checkRateLimit(key, limit, windowMs);
  }
}
