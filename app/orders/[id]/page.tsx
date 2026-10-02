'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';
import { Star } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { buildUpiIntentLinkClient } from '@/lib/ticket/upi-client';

interface OrderResponse {
  order: { id: string; total_amount: number; status: string };
  phonepeEnabled?: boolean;
  isBuyer: boolean;
  isSeller: boolean;
  sellerUpi: { upiId: string | null; payeeName: string } | null;
  proof: { id: string; status: 'SUBMITTED' | 'CONFIRMED' | 'REJECTED'; utr: string } | null;
}

export default function OrderPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<OrderResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [utr, setUtr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [existingReview, setExistingReview] = useState<{ rating: number; comment: string | null } | null | undefined>(undefined);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/orders/${id}`);
    const json = await res.json();
    if (res.ok) setData(json);
  }

  useEffect(() => { load(); }, [id]);

  async function payWithPhonePe() {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/phonepe/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id })
      });
      const json = await res.json();
      if (!res.ok || !json.redirectUrl) { setError(json.error ?? 'Could not start the payment.'); return; }
      window.location.href = json.redirectUrl;
    } finally {
      setPaying(false);
    }
  }

  // Back from PhonePe (?pp=return): the webhook may lag, so verify server-side and poll for up to ~60s.
  useEffect(() => {
    if (typeof window === 'undefined' || new URLSearchParams(window.location.search).get('pp') !== 'return') return;
    let tries = 0; let stop = false;
    setChecking(true);
    const tick = async () => {
      if (stop) return;
      tries++;
      try {
        const r = await fetch(`/api/payments/phonepe/status?orderId=${id}`);
        const j = await r.json();
        if (j.state === 'PAID') { await load(); setChecking(false); return; }
        if (j.state === 'REFUNDED') { setError('Payment was received but this ticket was sold to someone else. A full refund has been started and reaches your account in a few working days.'); setChecking(false); await load(); return; }
        if (j.state === 'FAILED') { setError('Payment failed or was cancelled. You can try again.'); setChecking(false); return; }
      } catch { /* keep polling */ }
      if (tries < 12) setTimeout(tick, 5000); else setChecking(false);
    };
    tick();
    return () => { stop = true; };
  }, [id]);

  useEffect(() => {
    if (data?.isBuyer && (data.order.status === 'PAID' || data.order.status === 'TRANSFERRED')) {
      fetch(`/api/reviews?orderId=${id}`).then(r => r.json()).then(d => setExistingReview(d.review ?? null));
    }
  }, [data, id]);

  async function submitReview() {
    if (rating < 1) { setReviewError('Pick a star rating.'); return; }
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, rating, comment })
      });
      const json = await res.json();
      if (!res.ok) { setReviewError(json.error ?? 'Could not submit review.'); return; }
      setExistingReview({ rating, comment });
    } finally {
      setReviewSubmitting(false);
    }
  }

  useEffect(() => {
    if (data?.isBuyer && data.sellerUpi?.upiId) {
      const link = buildUpiIntentLinkClient({
        upiId: data.sellerUpi.upiId,
        payeeName: data.sellerUpi.payeeName,
        amount: data.order.total_amount,
        note: `MyTICX order ${data.order.id.slice(0, 8)}`
      });
      QRCode.toDataURL(link, { width: 240 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
    }
  }, [data]);

  async function submitUtr() {
    if (!utr.trim()) { setError('Enter the UTR / reference number from your UPI app.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/manual/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, utr })
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not submit.'); return; }
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmReceived() {
    if (!data?.proof) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/manual/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: data.proof.id })
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Could not confirm.'); return; }
      await load();
    } finally {
      setConfirming(false);
    }
  }

  if (!data) {
    return <div><Navbar authed /><div className="container-page py-10 text-sm text-slate-500">Loading order…</div></div>;
  }

  const isPaid = data.order.status === 'PAID' || data.order.status === 'TRANSFERRED';

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar authed />
      <div className="container-page max-w-lg py-8">
        <h1 className="text-xl font-bold text-navy-900">Order payment</h1>
        <p className="mt-1 text-sm text-slate-500">Total: ₹{Number(data.order.total_amount).toFixed(2)}</p>

        {isPaid && (
          <Card className="mt-4 bg-emerald-50">
            <p className="text-sm font-medium text-emerald-700">Payment confirmed. Your order is complete.</p>
          </Card>
        )}

        {isPaid && data.isBuyer && existingReview !== undefined && (
          <Card className="mt-4 space-y-3">
            <h2 className="text-sm font-semibold text-navy-900">Rate the seller</h2>
            {existingReview ? (
              <div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(n => <Star key={n} className={`h-5 w-5 ${n <= existingReview.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />)}
                </div>
                {existingReview.comment && <p className="mt-2 text-sm text-slate-600">{existingReview.comment}</p>}
                <p className="mt-1 text-xs text-slate-400">Thanks for the feedback — the chat with this seller has been cleared.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star`}>
                      <Star className={`h-7 w-7 transition ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
                    </button>
                  ))}
                </div>
                <Input placeholder="Optional comment (no contact details)" value={comment} onChange={e => setComment(e.target.value)} />
                {reviewError && <p className="text-sm text-rose-600">{reviewError}</p>}
                <Button className="w-full" onClick={submitReview} disabled={reviewSubmitting}>{reviewSubmitting ? 'Submitting…' : 'Submit review'}</Button>
                <p className="text-xs text-slate-400">Submitting clears your chat with this seller — the deal is done.</p>
              </>
            )}
          </Card>
        )}

        {!isPaid && data.isBuyer && data.phonepeEnabled && (
          <Card className="mt-4 space-y-3">
            {checking ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">Confirming your payment with PhonePe… please don't close this page.</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">Pay ₹{Number(data.order.total_amount).toFixed(2)} securely with PhonePe (UPI, cards, net banking). Your ticket is released as soon as the payment is confirmed.</p>
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <Button className="w-full" onClick={payWithPhonePe} disabled={paying}>{paying ? 'Redirecting…' : 'Pay with PhonePe'}</Button>
              </>
            )}
          </Card>
        )}

        {!isPaid && data.isBuyer && !data.phonepeEnabled && (
          <Card className="mt-4 space-y-4">
            {!data.sellerUpi?.upiId ? (
              <p className="text-sm text-rose-600">The seller hasn't added a UPI ID to their profile yet, so payment can't be collected right now.</p>
            ) : !data.proof ? (
              <>
                <p className="text-sm text-slate-600">Scan with any UPI app (PhonePe, GPay, Paytm…) to pay ₹{Number(data.order.total_amount).toFixed(2)}.</p>
                {qrDataUrl && <img src={qrDataUrl} alt="UPI payment QR code" className="mx-auto h-60 w-60" />}
                <p className="text-xs text-slate-500">
                  This is a personal UPI payment, not a payment gateway — MyTICX can't automatically detect
                  that it went through. After paying, enter the UTR / reference number your UPI app shows you;
                  the seller will confirm receipt before the ticket is transferred.
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium text-navy-900">UTR / reference number</label>
                  <Input value={utr} onChange={e => setUtr(e.target.value)} placeholder="e.g. 402812345678" />
                </div>
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <Button className="w-full" onClick={submitUtr} disabled={submitting}>{submitting ? 'Submitting…' : "I've paid — submit reference"}</Button>
              </>
            ) : data.proof.status === 'SUBMITTED' ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
                Reference {data.proof.utr} submitted. Waiting for the seller to confirm they received the payment.
              </p>
            ) : data.proof.status === 'REJECTED' ? (
              <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">The seller said this payment wasn't received. Contact them before trying again.</p>
            ) : null}
          </Card>
        )}

        {!isPaid && data.isSeller && data.phonepeEnabled && (
          <Card className="mt-4"><p className="text-sm text-slate-500">Waiting for the buyer to pay via PhonePe. You'll be notified when it's confirmed.</p></Card>
        )}

        {!isPaid && data.isSeller && !data.phonepeEnabled && (
          <Card className="mt-4 space-y-3">
            {!data.proof ? (
              <p className="text-sm text-slate-500">Waiting for the buyer to pay and submit a reference number.</p>
            ) : data.proof.status === 'SUBMITTED' ? (
              <>
                <p className="text-sm text-slate-600">Buyer submitted reference number: <strong>{data.proof.utr}</strong></p>
                <p className="text-xs text-slate-500">
                  Check this against your own UPI app / bank statement before confirming — only confirm if you
                  actually see ₹{Number(data.order.total_amount).toFixed(2)} received with this reference.
                </p>
                {error && <p className="text-sm text-rose-600">{error}</p>}
                <Button className="w-full" onClick={confirmReceived} disabled={confirming}>{confirming ? 'Confirming…' : "I've received this payment"}</Button>
              </>
            ) : (
              <p className="text-sm text-emerald-700">Confirmed.</p>
            )}
          </Card>
        )}
      </div>
      <MobileBottomNav />
    </div>
  );
}
