'use client';
import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { createClient } from '@/lib/supabase/client';

interface PurchasedOrder {
  id: string;
  status: string;
  ticket_price: number;
  total_amount: number;
  created_at: string;
  ticket_listings: { tickets: { seat_label: string | null } } | null;
}

export default function MyTicketsPage() {
  const [orders, setOrders] = useState<PurchasedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('orders')
        .select('id, status, ticket_price, total_amount, created_at, ticket_listings(tickets(seat_label))')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });
      setOrders((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar authed />
      <div className="container-page py-8">
        <h1 className="text-xl font-bold text-navy-900">My Tickets</h1>
        <p className="mt-1 text-sm text-slate-500">Tickets you've purchased through MyTICX.</p>

        <div className="mt-6 space-y-3">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {!loading && orders.length === 0 && (
            <EmptyState title="No purchased tickets yet." subtitle="Browse the marketplace to find a discounted seat." />
          )}
          {orders.map(order => (
            <Card key={order.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-navy-900">Order {order.id.slice(0, 8)}</p>
                <p className="text-sm text-slate-500">Seat {order.ticket_listings?.tickets?.seat_label ?? '—'}</p>
                <p className="text-xs text-slate-400">Total paid: ₹{order.total_amount.toFixed(0)}</p>
              </div>
              <Badge tone={order.status === 'PAID' || order.status === 'TRANSFERRED' ? 'success' : 'warning'}>{order.status}</Badge>
            </Card>
          ))}
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
