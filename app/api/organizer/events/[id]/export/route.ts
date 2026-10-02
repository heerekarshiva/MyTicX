import { NextRequest, NextResponse } from 'next/server';
import { requireOrganizer, loadOwnedEvent, fail, csvCell, limited } from '@/lib/events/server';
import { loadParticipants } from '@/lib/events/organizer';

// CSV with a UTF-8 BOM opens directly in Excel. Only the fields this event
// was configured to collect are exported.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireOrganizer();
  if ('res' in g) return g.res;
  if (limited(req, 'export', g.ctx.user.id, 20)) return fail('Too many exports. Try again shortly.', 429);
  const ev = await loadOwnedEvent(g.ctx, params.id);
  if (!ev) return fail('Event not found.', 404);
  const { data: fields } = await g.ctx.admin.from('event_fields').select('field_key, label').eq('event_id', ev.id).order('sort_order');
  const parts = await loadParticipants(g.ctx, ev.id);
  const header = ['Registration ID', ...(fields ?? []).map(f => f.label), 'Registered At', 'Payment Status', 'Check-in Status', 'Check-in Time'];
  const rows = parts.filter((p: any) => p.rawStatus !== 'CANCELLED').map((p: any) => [
    p.registrationCode, ...(fields ?? []).map(f => p.answers[f.field_key] ?? ''), p.createdAt, ev.registration_type === 'FREE' ? 'FREE' : p.paymentStatus,
    p.checkedInAt ? 'CHECKED IN' : 'NOT CHECKED IN', p.checkedInAt ?? ''
  ]);
  const csv = '\uFEFF' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const safe = ev.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${safe}-participants.csv"`, 'Cache-Control': 'no-store' } });
}
