'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShieldCheck, BadgeCheck } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { PriceBreakdown } from '@/components/PriceBreakdown';
import { ConsentModal } from '@/components/ConsentModal';
import { ChatThread } from '@/components/ChatThread';
import { createClient } from '@/lib/supabase/client';
import { formatTime12h } from '@/lib/utils';

interface ListingDetail {
  listing_id: string;
  resale_price: number;
  platform_fee: number;
  original_price: number;
  seat_label: string | null;
  verification_status: string;
  movie_title: string | null;
  language: string | null;
  poster_url: string | null;
  theatre_name: string | null;
  location: string | null;
  show_date: string | null;
  show_time: string | null;
  seller_phone_verified: boolean;
  seller_id: string;
  status?: string;
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchased, setPurchased] = useState(false);

  useEffect(() => {
    fetch(`/api/listings/${id}`).then(r => r.json()).then(d => setListing(d.listing ?? null)).catch(() => setListing(null));
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [id]);

  async function confirmPurchase() {
    setBuying(true);
    setError(null);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ listingId: id, acceptedRisk: true })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not complete the purchase.'); setShowConsent(false);
        if (data.soldOut || res.status === 409) fetch(`/api/listings/${id}`).then(r => r.json()).then(d => setListing(d.listing ?? null));
        return;
      }
      setShowConsent(false);
      // Reservation succeeded — the order still needs to be paid. Send the
      // buyer to the order page to pay (UPI QR) and submit their reference.
      const orderId = data.order?.order_id ?? data.order?.id;
      if (orderId) { router.push(`/orders/${orderId}`); return; }
      setPurchased(true);
    } finally {
      setBuying(false);
    }
  }

  if (!listing) {
    return <div><Navbar /><div className="container-page py-10 text-sm text-slate-500">Loading listing… If it never loads, this ticket may have been removed. <a className="underline" href="/marketplace">Browse other tickets</a></div></div>;
  }

  const isOwnListing = userId === listing.seller_id;
  const unavailable = !!listing.status && listing.status !== 'ACTIVE';
  const soldOut = listing.status === 'SOLD' || listing.status === 'CANCELLED' || listing.status === 'EXPIRED';
  function startBuy() {
    if (!userId) { router.push(`/login?redirectTo=${encodeURIComponent(`/listing/${id}`)}`); return; }
    setShowConsent(true);
  }

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar authed={!!userId} />
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <Card>
            {listing.poster_url && <div className="-m-5 mb-4 h-40 w-[calc(100%+2.5rem)] bg-cover bg-center" style={{ backgroundImage: `url(${listing.poster_url})` }} />}
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-navy-900">{listing.movie_title}</h1>
                <p className="text-sm text-slate-500">{listing.theatre_name}, {listing.location}</p>
              </div>
              <Badge tone={listing.verification_status === 'PROVIDER_VERIFIED' ? 'success' : 'info'}>
                {listing.verification_status === 'PROVIDER_VERIFIED' ? 'Provider verified' : listing.verification_status === 'DOCUMENT_VERIFIED' ? 'Document verified' : 'Pending verification'}
              </Badge>
            </div>
            {listing.language && <Badge tone="neutral" className="mt-2">{listing.language}</Badge>}
            <p className="mt-2 text-sm text-slate-600">{listing.show_date} • {formatTime12h(listing.show_time)}{listing.seat_label ? ` • Seat ${listing.seat_label}` : ''}</p>

            <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Ticket checked against show database</span>
              {listing.seller_phone_verified && <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5 text-brand-blue" /> Seller phone verified</span>}
            </div>

            <div className="mt-5">
              <PriceBreakdown ticketPrice={listing.resale_price} platformFee={listing.platform_fee} />
            </div>

            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            {purchased ? (
              <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                Purchase confirmed! Your ticket transfer is being processed — check My Tickets shortly.
              </p>
            ) : unavailable ? (
              <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">
                <p className="font-semibold">{soldOut ? 'Sold out' : 'Another buyer is paying for this ticket'}</p>
                <p className="mt-0.5 text-slate-500">{soldOut ? 'This ticket has been sold and can no longer be bought.' : 'It will be available again if their payment is not completed in a few minutes.'}</p>
                <a href="/marketplace" className="mt-2 inline-block font-medium text-brand-blue underline">Browse other tickets</a>
              </div>
            ) : isOwnListing ? (
              <p className="mt-4 text-sm text-slate-400">This is your own listing.</p>
            ) : (
              <Button className="mt-4 w-full sm:w-auto" onClick={startBuy}>Buy Ticket</Button>
            )}
          </Card>
        </div>

        {!isOwnListing && userId && (
          <div>
            <p className="mb-2 text-sm font-medium text-navy-900">Message the seller</p>
            <ChatThread listingId={listing.listing_id} currentUserId={userId} otherUserId={listing.seller_id} otherUserLabel="Seller" />
          </div>
        )}
      </div>

      <ConsentModal
        open={showConsent}
        role="buyer"
        loading={buying}
        onCancel={() => setShowConsent(false)}
        onAccept={confirmPurchase}
      />
      <MobileBottomNav />
    </div>
  );
}
