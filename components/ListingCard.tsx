import { ShieldCheck, BadgeCheck } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import type { MarketplaceListing } from '@/types';
import { formatTime12h } from '@/lib/utils';

export function ListingCard({ listing, onBuy, buying }: {
  listing: MarketplaceListing;
  onBuy?: (id: string) => void;
  buying?: boolean;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-navy-900">{listing.movieTitle}</h3>
          <p className="text-sm text-slate-500">{listing.theatreName}, {listing.location}</p>
        </div>
        <Badge tone={listing.discountPct > 0 ? 'success' : 'neutral'}>{listing.discountPct}% lower</Badge>
      </div>

      <p className="text-sm text-slate-600">{listing.showDate} • {formatTime12h(listing.showTime)}{listing.seatLabel ? ` • Seat ${listing.seatLabel}` : ''}</p>

      <div className="flex items-end justify-between border-t border-slate-100 pt-3">
        <div>
          <p className="text-xs text-slate-400 line-through">Original ₹{listing.originalPrice.toFixed(0)}</p>
          <p className="text-xl font-bold text-navy-900">₹{listing.resalePrice.toFixed(0)}</p>
        </div>
        <Button size="sm" disabled={buying} onClick={() => onBuy?.(listing.id)}>
          {buying ? 'Processing…' : 'Buy Ticket'}
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          {listing.verificationStatus === 'PROVIDER_VERIFIED' ? 'Provider verified' : listing.verificationStatus === 'DOCUMENT_VERIFIED' ? 'Document verified' : 'Pending verification'}
        </span>
        {listing.sellerVerified && (
          <span className="inline-flex items-center gap-1">
            <BadgeCheck className="h-3.5 w-3.5 text-brand-blue" /> Seller verified
          </span>
        )}
      </div>
    </Card>
  );
}
