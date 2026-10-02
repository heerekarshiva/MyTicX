import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { retryOpenRefunds } from '@/lib/payments/settle';

// Call every minute from any scheduler (Render cron job, GitHub Actions, cron-job.org):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/sync-events
// Even if it never runs, registration is still enforced by the DB clock at
// registration time and status is derived on read — this just keeps stored statuses fresh.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const admin = createAdminClient();
  const { error } = await admin.rpc('sync_event_statuses');
  const rel = await admin.rpc('release_expired_reservations');
  await admin.rpc('purge_rate_limits');
  let refunded = 0;
  try { refunded = await retryOpenRefunds(); } catch (e) { console.error('[cron] refund retry failed', e); }
  if (rel.error) console.error('[cron] release_expired_reservations failed', rel.error.message);
  return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ ok: true, released: rel.data ?? 0, refundsRetried: refunded });
}
