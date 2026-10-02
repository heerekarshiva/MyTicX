'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';

interface MyListing {
  id: string;
  resale_price: number;
  status: string;
  created_at: string;
  tickets: { seat_label: string | null; original_price: number } | null;
}

const toneFor = (status: string) =>
  status === 'ACTIVE' ? 'success' : status === 'SOLD' ? 'info' : status === 'PENDING_VERIFICATION' ? 'warning' : 'neutral';

export default function MyListingsPage() {
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('ticket_listings')
        .select('id, resale_price, status, created_at, tickets(seat_label, original_price)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });
      setListings((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar authed />
      <div className="container-page py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-navy-900">My Listings</h1>
          <Link href="/sell" className="text-sm font-medium text-brand-blue">+ Sell a ticket</Link>
        </div>

        <div className="mt-6 space-y-3">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {!loading && listings.length === 0 && (
            <EmptyState title="You haven't listed any tickets yet." subtitle="List an unused ticket to recover some value from it." />
          )}
          {listings.map(l => (
            <Card key={l.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-navy-900">Seat {l.tickets?.seat_label ?? '—'}</p>
                <p className="text-sm text-slate-500">₹{l.resale_price.toFixed(0)} (original ₹{l.tickets?.original_price?.toFixed(0)})</p>
              </div>
              <Badge tone={toneFor(l.status) as any}>{l.status.replace('_', ' ')}</Badge>
            </Card>
          ))}
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
