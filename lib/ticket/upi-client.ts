// Client-safe copy of buildUpiIntentLink from lib/providers/payment-provider.ts
// (that file is marked 'server-only' and can't be imported into client
// components). Keep the two in sync if you change the UPI link format.
export function buildUpiIntentLinkClient(params: { upiId: string; payeeName: string; amount: number; note: string }): string {
  const q = new URLSearchParams({
    pa: params.upiId,
    pn: params.payeeName,
    am: params.amount.toFixed(2),
    cu: 'INR',
    tn: params.note
  });
  return `upi://pay?${q.toString()}`;
}
