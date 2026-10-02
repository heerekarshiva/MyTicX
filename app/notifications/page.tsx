'use client';
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { EmptyState } from '@/components/EmptyState';
import { Card } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';

interface Notification { id: string; title: string; body: string | null; type: string; read: boolean; created_at: string; }

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="pb-20 lg:pb-0">
      <Navbar authed />
      <div className="container-page max-w-2xl py-8">
        <h1 className="text-xl font-bold text-navy-900">Notifications</h1>
        <div className="mt-6 space-y-2">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {!loading && items.length === 0 && <EmptyState title="You're all caught up." subtitle="Notifications about your listings and purchases will show up here." />}
          {items.map(n => (
            <Card key={n.id} className={`flex items-start gap-3 ${n.read ? 'opacity-70' : ''}`}>
              <Bell className="mt-0.5 h-4 w-4 text-brand-blue" />
              <div>
                <p className="text-sm font-medium text-navy-900">{n.title}</p>
                {n.body && <p className="text-sm text-slate-500">{n.body}</p>}
                <p className="mt-1 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
