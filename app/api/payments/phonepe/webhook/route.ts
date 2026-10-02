import { NextRequest, NextResponse } from 'next/server';
import { verifyPhonePeWebhookAuth } from '@/lib/providers/phonepe';
import { settlePhonePeOrder } from '@/lib/payments/settle';

// Set this URL in PhonePe Business Dashboard -> Developer Settings -> Webhook (SHA auth, events:
// checkout.order.completed + checkout.order.failed). Must be public HTTPS and answer 2xx within ~3s.
export async function POST(req: NextRequest) {
  if (!verifyPhonePeWebhookAuth(req.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body: any = await req.json().catch(() => null);
  const merchantOrderId = body?.payload?.merchantOrderId;
  if (!merchantOrderId || typeof merchantOrderId !== 'string') return NextResponse.json({ ok: true });

  // Ignore the body's claim of success: re-check with PhonePe's Order Status API, amount-check, then finalize.
  try { await settlePhonePeOrder(merchantOrderId); } catch (e) { console.error('[phonepe] webhook settle error', e); return NextResponse.json({ error: 'retry' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
