import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Liveness + light DB check for Render / uptime monitors.
export const dynamic = 'force-dynamic';
export async function GET() {
  let db = true;
  try { const { error } = await createAdminClient().from('platform_settings').select('key').limit(1); db = !error; } catch { db = false; }
  return NextResponse.json({ ok: db, db, time: new Date().toISOString() }, { status: db ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
