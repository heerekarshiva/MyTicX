import 'server-only';

export interface PaymentIntent {
  id: string;
  clientSecretOrToken: string;
  amount: number;
}

export interface PaymentVerificationResult {
  verified: boolean;
  providerPaymentId: string;
  amount: number;
}

export interface PaymentProvider {
  createIntent(orderId: string, amount: number): Promise<PaymentIntent>;
  /** Called from the webhook/verification route — never trust client-reported success. */
  verifyPayment(payload: unknown, signature: string | null): Promise<PaymentVerificationResult>;
}

/**
 * Development payment simulator. Clearly non-production: it never talks to
 * a real payment network. It exists so the full order → payment → transfer
 * pipeline can be exercised end-to-end before a real provider (Razorpay,
 * Stripe, etc.) is wired in. Swap PAYMENT_PROVIDER and implement a matching
 * adapter — the rest of the app only depends on the PaymentProvider interface.
 */
class DevSimulatorPaymentProvider implements PaymentProvider {
  async createIntent(orderId: string, amount: number): Promise<PaymentIntent> {
    return { id: `sim_${orderId}`, clientSecretOrToken: `dev_${orderId}_${Date.now()}`, amount };
  }

  async verifyPayment(payload: any): Promise<PaymentVerificationResult> {
    // In development mode we accept the simulated payload but this is the
    // exact seam where real signature verification (HMAC against
    // PAYMENT_WEBHOOK_SECRET) must happen for any real provider.
    return {
      verified: Boolean(payload?.simulateSuccess),
      providerPaymentId: payload?.paymentId ?? `sim_${Date.now()}`,
      amount: Number(payload?.amount ?? 0)
    };
  }
}

/**
 * Builds a standard UPI "intent" deep link (opens any UPI app — PhonePe,
 * GPay, Paytm, etc. — with the amount pre-filled). This is NOT a payment
 * gateway integration: nobody's app calls you back to say "paid". It only
 * pre-fills the payment screen. Verifying the payment still requires either
 * (a) a real aggregator (Razorpay/Cashfree/PhonePe Business — they give you
 * a webhook + signature, same shape as PaymentProvider above), or (b) the
 * manual UTR-submit + seller-confirm flow in app/api/payments/manual/*.
 */
export function buildUpiIntentLink(params: { upiId: string; payeeName: string; amount: number; note: string }): string {
  const q = new URLSearchParams({
    pa: params.upiId,
    pn: params.payeeName,
    am: params.amount.toFixed(2),
    cu: 'INR',
    tn: params.note
  });
  return `upi://pay?${q.toString()}`;
}

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER ?? 'dev_simulator';
  if (process.env.APP_ENV === 'production' || process.env.NODE_ENV === 'production') {
    throw new Error('The dev payment simulator is disabled in production.');
  }
  switch (provider) {
    case 'dev_simulator':
    default:
      // TODO: add RazorpayPaymentProvider / StripePaymentProvider here,
      // implementing real signature verification in verifyPayment().
      return new DevSimulatorPaymentProvider();
  }
}
