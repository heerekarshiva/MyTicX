import 'server-only';
import { createHash, timingSafeEqual } from 'crypto';

// PhonePe Payment Gateway — Standard Checkout (API v2, OAuth based).
// Docs: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/integration-steps
//
// PHONEPE_ENV=sandbox  -> https://api-preprod.phonepe.com/apis/pg-sandbox
// PHONEPE_ENV=production -> https://api.phonepe.com/apis/pg  (+ identity-manager for the auth token)

const isProdEnv = () => (process.env.PHONEPE_ENV ?? 'sandbox') === 'production';
const AUTH_URL = () => isProdEnv()
  ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
  : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';
const PG_BASE = () => isProdEnv()
  ? 'https://api.phonepe.com/apis/pg'
  : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

export function phonepeConfigured(): boolean {
  return !!(process.env.PHONEPE_CLIENT_ID && process.env.PHONEPE_CLIENT_SECRET && process.env.PHONEPE_CLIENT_VERSION);
}

let cached: { token: string; expiresAt: number } | null = null;

async function getAuthToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiresAt - 60 > now) return cached.token;
  const body = new URLSearchParams({
    client_id: process.env.PHONEPE_CLIENT_ID!,
    client_version: process.env.PHONEPE_CLIENT_VERSION!,
    client_secret: process.env.PHONEPE_CLIENT_SECRET!,
    grant_type: 'client_credentials'
  });
  const res = await fetch(AUTH_URL(), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`PhonePe auth failed (${res.status})`);
  cached = { token: json.access_token, expiresAt: Number(json.expires_at ?? now + 600) };
  return cached.token;
}

/** Creates a hosted-checkout payment. merchantOrderId = our orders.id (UUID, hyphens allowed, < 63 chars). */
export async function createPhonePePayment(p: { merchantOrderId: string; amountRupees: number; redirectUrl: string; expireAfterSeconds?: number }) {
  const token = await getAuthToken();
  const res = await fetch(`${PG_BASE()}/checkout/v2/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${token}` },
    cache: 'no-store',
    body: JSON.stringify({
      merchantOrderId: p.merchantOrderId,
      amount: Math.round(p.amountRupees * 100), // paise, minimum 100
      expireAfter: p.expireAfterSeconds ?? 900,
      paymentFlow: { type: 'PG_CHECKOUT', message: 'MyTICX ticket purchase', merchantUrls: { redirectUrl: p.redirectUrl } }
    })
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.redirectUrl) throw new Error(`PhonePe create payment failed (${res.status}): ${json?.code ?? json?.message ?? ''}`);
  return { phonepeOrderId: String(json.orderId), redirectUrl: String(json.redirectUrl) };
}

export type PhonePeState = 'PENDING' | 'COMPLETED' | 'FAILED' | string;

/** Source of truth for a payment. Always call this before marking anything paid. */
export async function getPhonePeOrderStatus(merchantOrderId: string): Promise<{ state: PhonePeState; amountPaise: number; transactionId: string | null }> {
  const token = await getAuthToken();
  const res = await fetch(`${PG_BASE()}/checkout/v2/order/${encodeURIComponent(merchantOrderId)}/status?details=false`, {
    headers: { Authorization: `O-Bearer ${token}` }, cache: 'no-store'
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`PhonePe status failed (${res.status})`);
  return {
    state: json.state,
    amountPaise: Number(json.amount ?? 0),
    transactionId: json.paymentDetails?.[0]?.transactionId ?? json.orderId ?? null
  };
}

/** Webhook auth (SHA mode): PhonePe sends Authorization = SHA256("username:password") using the values you set in the dashboard. */
export function verifyPhonePeWebhookAuth(authHeader: string | null): boolean {
  const user = process.env.PHONEPE_WEBHOOK_USERNAME;
  const pass = process.env.PHONEPE_WEBHOOK_PASSWORD;
  if (!user || !pass || !authHeader) return false;
  const expected = createHash('sha256').update(`${user}:${pass}`).digest('hex');
  const got = authHeader.replace(/^SHA256\s+/i, '').trim().toLowerCase();
  const a = Buffer.from(expected); const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Refund a captured payment back to the buyer (PhonePe Standard Checkout v2). Idempotent on merchantRefundId. */
export async function refundPhonePePayment(p: { merchantOrderId: string; amountPaise: number }): Promise<{ ok: boolean; state?: string; error?: string }> {
  try {
    const token = await getAuthToken();
    const res = await fetch(`${PG_BASE()}/payments/v2/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${token}` },
      cache: 'no-store',
      body: JSON.stringify({ merchantRefundId: `rf_${p.merchantOrderId}`, originalMerchantOrderId: p.merchantOrderId, amount: p.amountPaise })
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: `${res.status} ${json?.code ?? json?.message ?? ''}` };
    return { ok: true, state: json.state };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
